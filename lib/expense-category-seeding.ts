import { PrismaClient } from '@prisma/client'
import {
  EXPENSE_CATEGORY_TAXONOMY,
  normalizeExpenseCategoryText,
} from './expense-categories'

export async function ensureExpenseTaxonomyForUser(prisma: PrismaClient, userId: string) {
  const existingCategories = await prisma.category.findMany({
    where: { userId },
    include: {
      subcategories: {
        select: { id: true, name: true },
      },
    },
  })

  const categoryIdByNormalizedName = new Map(
    existingCategories.map((category) => [
      normalizeExpenseCategoryText(category.name),
      category.id,
    ])
  )

  const existingSubcategoryKeys = new Set(
    existingCategories.flatMap((category) =>
      category.subcategories.map(
        (subcategory) =>
          `${normalizeExpenseCategoryText(category.name)}::${normalizeExpenseCategoryText(subcategory.name)}`
      )
    )
  )

  const categoriesToCreate = EXPENSE_CATEGORY_TAXONOMY.filter(
    (entry) => !categoryIdByNormalizedName.has(normalizeExpenseCategoryText(entry.name))
  )

  const createdCategories = await Promise.all(
    categoriesToCreate.map((entry) =>
      prisma.category.upsert({
        where: {
          userId_name: {
            userId,
            name: entry.name,
          },
        },
        update: {},
        create: {
          userId,
          name: entry.name,
        },
      })
    )
  )

  for (const category of createdCategories) {
    categoryIdByNormalizedName.set(normalizeExpenseCategoryText(category.name), category.id)
  }

  const subcategoriesToCreate = EXPENSE_CATEGORY_TAXONOMY.flatMap((entry) => {
    const normalizedCategoryName = normalizeExpenseCategoryText(entry.name)
    const categoryId = categoryIdByNormalizedName.get(normalizedCategoryName)
    if (!categoryId) return []

    return entry.subcategories
      .filter((subcategoryName) => {
        const key = `${normalizedCategoryName}::${normalizeExpenseCategoryText(subcategoryName)}`
        return !existingSubcategoryKeys.has(key)
      })
      .map((subcategoryName) => ({
        categoryId,
        subcategoryName,
      }))
  })

  if (subcategoriesToCreate.length > 0) {
    await Promise.all(
      subcategoriesToCreate.map((entry) =>
        prisma.subCategory.upsert({
          where: {
            categoryId_name: {
              categoryId: entry.categoryId,
              name: entry.subcategoryName,
            },
          },
          update: {},
          create: {
            categoryId: entry.categoryId,
            name: entry.subcategoryName,
          },
        })
      )
    )
  }

  const createdSubcategories = subcategoriesToCreate.length

  const totalSubcategories = EXPENSE_CATEGORY_TAXONOMY.reduce(
    (total, entry) => total + entry.subcategories.length,
    0
  )

  return {
    totalCategories: EXPENSE_CATEGORY_TAXONOMY.length,
    totalSubcategories,
    createdCategories: createdCategories.length,
    createdSubcategories,
  }
}
