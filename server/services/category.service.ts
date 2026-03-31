import type { PrismaClient } from '@prisma/client'
import {
  getCanonicalExpenseCategoryName,
  getCanonicalExpenseSubcategoryName,
  getExpenseCategoryMappingByName,
  getExpenseSubcategoryCandidatesByName,
  isMasterExpenseCategory,
  isMasterExpenseSubcategory,
  normalizeExpenseCategoryText,
} from '@/lib/expense-categories'
import { ensureExpenseTaxonomyForUser } from '@/lib/expense-category-seeding'

function sameNormalizedValue(a: string, b: string): boolean {
  return normalizeExpenseCategoryText(a) === normalizeExpenseCategoryText(b)
}

/**
 * Resolves where a subcategory should live according to the master taxonomy.
 * Returns the canonical category + subcategory names, or null if no mapping found.
 */
export function resolveSubcategoryNormalizationTarget(
  rawCategoryName: string,
  rawSubcategoryName: string,
): { category: string; subcategory: string } | null {
  const categoryName = rawCategoryName.trim()
  const subcategoryName = rawSubcategoryName.trim()

  if (!categoryName || !subcategoryName) return null

  const canonicalCategoryName = getCanonicalExpenseCategoryName(categoryName)
  const canonicalSubcategoryInCurrentCategory = getCanonicalExpenseSubcategoryName(
    canonicalCategoryName,
    subcategoryName,
  )

  if (
    isMasterExpenseSubcategory(canonicalCategoryName, canonicalSubcategoryInCurrentCategory)
  ) {
    return {
      category: canonicalCategoryName,
      subcategory: canonicalSubcategoryInCurrentCategory,
    }
  }

  const mappedBySubcategoryName = getExpenseCategoryMappingByName(subcategoryName)
  if (mappedBySubcategoryName?.subcategory) {
    const mappedCategoryName = getCanonicalExpenseCategoryName(
      mappedBySubcategoryName.category,
    )

    return {
      category: mappedCategoryName,
      subcategory: getCanonicalExpenseSubcategoryName(
        mappedCategoryName,
        mappedBySubcategoryName.subcategory,
      ),
    }
  }

  const mappedByCategoryName = getExpenseCategoryMappingByName(categoryName)
  if (!mappedByCategoryName) return null

  const mappedCategoryName = getCanonicalExpenseCategoryName(mappedByCategoryName.category)
  const canonicalInMappedCategory = getCanonicalExpenseSubcategoryName(
    mappedCategoryName,
    subcategoryName,
  )

  if (isMasterExpenseSubcategory(mappedCategoryName, canonicalInMappedCategory)) {
    return {
      category: mappedCategoryName,
      subcategory: canonicalInMappedCategory,
    }
  }

  const subcategoryCandidates = getExpenseSubcategoryCandidatesByName(subcategoryName)

  if (subcategoryCandidates.length === 1) {
    const candidate = subcategoryCandidates[0]
    const candidateCategoryName = getCanonicalExpenseCategoryName(candidate.category)

    return {
      category: candidateCategoryName,
      subcategory: getCanonicalExpenseSubcategoryName(
        candidateCategoryName,
        candidate.subcategory,
      ),
    }
  }

  const preferredCandidate = subcategoryCandidates.find((candidate) =>
    sameNormalizedValue(candidate.category, mappedCategoryName),
  )

  if (preferredCandidate) {
    const preferredCategoryName = getCanonicalExpenseCategoryName(preferredCandidate.category)

    return {
      category: preferredCategoryName,
      subcategory: getCanonicalExpenseSubcategoryName(
        preferredCategoryName,
        preferredCandidate.subcategory,
      ),
    }
  }

  if (mappedByCategoryName.subcategory) {
    return {
      category: mappedCategoryName,
      subcategory: getCanonicalExpenseSubcategoryName(
        mappedCategoryName,
        mappedByCategoryName.subcategory,
      ),
    }
  }

  return null
}

/**
 * Transfers budget limits from one category to another, merging amounts if the
 * target already has a limit.
 */
export async function transferBudgetLimits(
  prisma: PrismaClient,
  userId: string,
  sourceBudgetLimits: Array<{ id: string; monthlyLimit: unknown }>,
  targetCategoryId: string,
) {
  let transferred = 0

  for (const oldLimit of sourceBudgetLimits) {
    const existingTargetLimit = await prisma.budgetLimit.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId: targetCategoryId,
        },
      },
    })

    const nextValue =
      Number(oldLimit.monthlyLimit) + Number(existingTargetLimit?.monthlyLimit || 0)

    if (existingTargetLimit) {
      await prisma.budgetLimit.update({
        where: { id: existingTargetLimit.id },
        data: { monthlyLimit: nextValue },
      })
    } else {
      await prisma.budgetLimit.create({
        data: {
          userId,
          categoryId: targetCategoryId,
          monthlyLimit: Number(oldLimit.monthlyLimit),
        },
      })
    }

    transferred += 1
  }

  return transferred
}

/**
 * Full expense category normalization:
 * - Migrates legacy categories to master taxonomy
 * - Reassigns misplaced subcategories
 * - Transfers budget limits
 * - Cleans up unused non-master categories/subcategories
 */
export async function normalizeExpenseCategories(prisma: PrismaClient, userId: string) {
  const taxonomySeed = await ensureExpenseTaxonomyForUser(prisma, userId)

  const categories = await prisma.category.findMany({
    where: { userId },
    include: {
      subcategories: true,
      budgetLimits: true,
      _count: {
        select: {
          transactions: true,
          budgetLimits: true,
        },
      },
    },
  })

  const categoriesByNormalizedName = new Map(
    categories.map((category) => [
      normalizeExpenseCategoryText(category.name),
      category,
    ]),
  )

  const migratedCategoryIds = new Set<string>()
  let migratedTransactions = 0
  let transferredBudgetLimits = 0
  let normalizedSubcategoryTransactions = 0
  let removedSubcategories = 0

  // ── Phase 1: Migrate legacy categories to master taxonomy ──
  for (const category of categories) {
    if (isMasterExpenseCategory(category.name)) continue

    const mappedByName = getExpenseCategoryMappingByName(category.name)
    const mapping =
      mappedByName ??
      (category._count.transactions > 0 || category._count.budgetLimits > 0
        ? {
            category: 'Lujos',
            subcategory: category.name.trim() || 'Gastos Generales',
          }
        : null)

    if (!mapping) continue

    const targetCategory = categoriesByNormalizedName.get(
      normalizeExpenseCategoryText(mapping.category),
    )

    if (!targetCategory || targetCategory.id === category.id) continue

    let targetSubcategoryId: string | null = null
    if (mapping.subcategory) {
      const canonicalSubcategoryName = getCanonicalExpenseSubcategoryName(
        targetCategory.name,
        mapping.subcategory,
      )
      let subcategory = targetCategory.subcategories.find(
        (sub) =>
          normalizeExpenseCategoryText(sub.name) ===
          normalizeExpenseCategoryText(canonicalSubcategoryName),
      )

      if (!subcategory) {
        subcategory = await prisma.subCategory.create({
          data: {
            categoryId: targetCategory.id,
            name: canonicalSubcategoryName,
          },
        })
        targetCategory.subcategories.push(subcategory)
      }

      targetSubcategoryId = subcategory.id
    }

    const txUpdate = await prisma.transaction.updateMany({
      where: { userId, categoryId: category.id },
      data: {
        categoryId: targetCategory.id,
        subcategoryId: targetSubcategoryId,
      },
    })

    migratedTransactions += txUpdate.count
    migratedCategoryIds.add(category.id)

    for (const oldLimit of category.budgetLimits) {
      const existingTargetLimit = await prisma.budgetLimit.findUnique({
        where: {
          userId_categoryId: { userId, categoryId: targetCategory.id },
        },
      })

      const mergedMonthlyLimit =
        Number(oldLimit.monthlyLimit) + Number(existingTargetLimit?.monthlyLimit || 0)

      if (existingTargetLimit) {
        await prisma.budgetLimit.update({
          where: { id: existingTargetLimit.id },
          data: { monthlyLimit: mergedMonthlyLimit },
        })
      } else {
        await prisma.budgetLimit.create({
          data: {
            userId,
            categoryId: targetCategory.id,
            monthlyLimit: Number(oldLimit.monthlyLimit),
          },
        })
      }

      await prisma.budgetLimit.delete({ where: { id: oldLimit.id } })
      transferredBudgetLimits += 1
    }
  }

  // ── Phase 2: Delete migrated categories ──
  let removedCategories = 0

  if (migratedCategoryIds.size > 0) {
    const deletedMigrated = await prisma.category.deleteMany({
      where: {
        userId,
        id: { in: Array.from(migratedCategoryIds) },
      },
    })
    removedCategories += deletedMigrated.count
  }

  // ── Phase 3: Clean up unused non-master categories ──
  const remainingCategories = await prisma.category.findMany({
    where: { userId },
    include: {
      _count: {
        select: { transactions: true, budgetLimits: true },
      },
    },
  })

  const unusedNonMasterIds = remainingCategories
    .filter(
      (category) =>
        !isMasterExpenseCategory(category.name) &&
        category._count.transactions === 0 &&
        category._count.budgetLimits === 0,
    )
    .map((category) => category.id)

  if (unusedNonMasterIds.length > 0) {
    const deletedUnused = await prisma.category.deleteMany({
      where: { userId, id: { in: unusedNonMasterIds } },
    })
    removedCategories += deletedUnused.count
  }

  // ── Phase 4: Normalize subcategory assignments ──
  const refreshedCategories = await prisma.category.findMany({
    where: { userId },
    include: { subcategories: true },
  })

  const refreshedCategoriesByNormalizedName = new Map(
    refreshedCategories.map((category) => [
      normalizeExpenseCategoryText(category.name),
      category,
    ]),
  )

  const transactionsWithSubcategory = await prisma.transaction.findMany({
    where: {
      userId,
      subcategoryId: { not: null },
    },
    select: {
      id: true,
      categoryId: true,
      subcategoryId: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
    },
  })

  for (const transaction of transactionsWithSubcategory) {
    if (!transaction.subcategory) continue

    const normalizationTarget = resolveSubcategoryNormalizationTarget(
      transaction.category?.name || '',
      transaction.subcategory.name,
    )

    if (!normalizationTarget) continue

    const targetCategory = refreshedCategoriesByNormalizedName.get(
      normalizeExpenseCategoryText(normalizationTarget.category),
    )

    if (!targetCategory) continue

    const canonicalTargetSubcategoryName = getCanonicalExpenseSubcategoryName(
      targetCategory.name,
      normalizationTarget.subcategory,
    )

    let targetSubcategory = targetCategory.subcategories.find((subcategory) =>
      sameNormalizedValue(subcategory.name, canonicalTargetSubcategoryName),
    )

    if (!targetSubcategory) {
      targetSubcategory = await prisma.subCategory.create({
        data: {
          categoryId: targetCategory.id,
          name: canonicalTargetSubcategoryName,
        },
      })
      targetCategory.subcategories.push(targetSubcategory)
    }

    const shouldUpdateCategory = transaction.categoryId !== targetCategory.id
    const shouldUpdateSubcategory = transaction.subcategoryId !== targetSubcategory.id

    if (!shouldUpdateCategory && !shouldUpdateSubcategory) continue

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        categoryId: targetCategory.id,
        subcategoryId: targetSubcategory.id,
      },
    })

    normalizedSubcategoryTransactions += 1
  }

  if (normalizedSubcategoryTransactions > 0) {
    migratedTransactions += normalizedSubcategoryTransactions
  }

  // ── Phase 5: Clean up unused non-master subcategories ──
  const subcategoriesForCleanup = await prisma.subCategory.findMany({
    where: {
      category: { userId },
    },
    include: {
      category: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
  })

  const subcategoryIdsToDelete = subcategoriesForCleanup
    .filter(
      (subcategory) =>
        isMasterExpenseCategory(subcategory.category.name) &&
        !isMasterExpenseSubcategory(subcategory.category.name, subcategory.name) &&
        subcategory._count.transactions === 0,
    )
    .map((subcategory) => subcategory.id)

  if (subcategoryIdsToDelete.length > 0) {
    const deletedSubcategories = await prisma.subCategory.deleteMany({
      where: { id: { in: subcategoryIdsToDelete } },
    })
    removedSubcategories += deletedSubcategories.count
  }

  return {
    ...taxonomySeed,
    migratedCategories: migratedCategoryIds.size,
    migratedTransactions,
    transferredBudgetLimits,
    removedCategories,
    normalizedSubcategoryTransactions,
    removedSubcategories,
  }
}
