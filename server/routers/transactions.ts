import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import {
  createTransactionWithInstallments,
  recalculateBillingCycleTotals,
  voidTransaction,
  unvoidTransaction,
} from '@/lib/installment-engine'
import { ensureExpenseTaxonomyForUser } from '@/lib/expense-category-seeding'
import {
  getCanonicalExpenseCategoryName,
  getCanonicalExpenseSubcategoryName,
  getExpenseCategoryMappingByName,
  getExpenseSubcategoryCandidatesByName,
  isMasterExpenseCategory,
  isMasterExpenseSubcategory,
  normalizeExpenseCategoryText,
  sortCategoriesByExpenseTaxonomy,
  sortSubcategoriesByExpenseTaxonomy,
} from '@/lib/expense-categories'

const categoryNameInputSchema = z.string().min(1).max(80)
const subcategoryNameInputSchema = z.string().min(1).max(80)

function sameNormalizedValue(a: string, b: string): boolean {
  return normalizeExpenseCategoryText(a) === normalizeExpenseCategoryText(b)
}

function resolveSubcategoryNormalizationTarget(
  rawCategoryName: string,
  rawSubcategoryName: string
): { category: string; subcategory: string } | null {
  const categoryName = rawCategoryName.trim()
  const subcategoryName = rawSubcategoryName.trim()

  if (!categoryName || !subcategoryName) return null

  const canonicalCategoryName = getCanonicalExpenseCategoryName(categoryName)
  const canonicalSubcategoryInCurrentCategory = getCanonicalExpenseSubcategoryName(
    canonicalCategoryName,
    subcategoryName
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
      mappedBySubcategoryName.category
    )

    return {
      category: mappedCategoryName,
      subcategory: getCanonicalExpenseSubcategoryName(
        mappedCategoryName,
        mappedBySubcategoryName.subcategory
      ),
    }
  }

  const mappedByCategoryName = getExpenseCategoryMappingByName(categoryName)
  if (!mappedByCategoryName) return null

  const mappedCategoryName = getCanonicalExpenseCategoryName(mappedByCategoryName.category)
  const canonicalInMappedCategory = getCanonicalExpenseSubcategoryName(
    mappedCategoryName,
    subcategoryName
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
        candidate.subcategory
      ),
    }
  }

  const preferredCandidate = subcategoryCandidates.find((candidate) =>
    sameNormalizedValue(candidate.category, mappedCategoryName)
  )

  if (preferredCandidate) {
    const preferredCategoryName = getCanonicalExpenseCategoryName(preferredCandidate.category)

    return {
      category: preferredCategoryName,
      subcategory: getCanonicalExpenseSubcategoryName(
        preferredCategoryName,
        preferredCandidate.subcategory
      ),
    }
  }

  if (mappedByCategoryName.subcategory) {
    return {
      category: mappedCategoryName,
      subcategory: getCanonicalExpenseSubcategoryName(
        mappedCategoryName,
        mappedByCategoryName.subcategory
      ),
    }
  }

  return null
}

export const transactionsRouter = router({
  /**
   * Crear transacción
   * Soporta: credit_card (con cuotas), cash, transfer
   */
  create: protectedProcedure
    .input(
      z.object({
        paymentMethod: z.enum(['credit_card', 'debit_card', 'cash', 'transfer']),
        cardId: z.string().optional(), // Solo requerido si paymentMethod = 'credit_card'
        description: z.string().min(1),
        totalAmount: z.number().positive(),
        purchaseDate: z.date(),
        installments: z.number().min(1).max(60).default(1), // Solo aplica a credit_card
        categoryId: z.string().optional(),
        subcategoryId: z.string().optional(),
        expenseType: z
          .enum(['structural', 'emotional_recurrent', 'emotional_impulsive'])
          .optional(),
        isForThirdParty: z.boolean().optional(),
        thirdPartyId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validar que si es tarjeta, tenga cardId
      if (input.paymentMethod === 'credit_card' && !input.cardId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Se requiere seleccionar una tarjeta para pagos con tarjeta de crédito',
        })
      }
      return createTransactionWithInstallments({
        userId: ctx.user.id,
        ...input,
      })
    }),

  /**
   * Listar transacciones
   */
  list: protectedProcedure
    .input(
      z
        .object({
          cardId: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          includeVoided: z.boolean().optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.user.id,
      }

      if (input?.cardId) {
        where.cardId = input.cardId
      }

      if (input?.startDate || input?.endDate) {
        where.purchaseDate = {}
        if (input.startDate) where.purchaseDate.gte = input.startDate
        if (input.endDate) where.purchaseDate.lte = input.endDate
      }

      if (!input?.includeVoided) {
        where.isVoided = false
      }

      return ctx.prisma.transaction.findMany({
        where,
        include: {
          card: true,
          category: true,
          subcategory: true,
          installmentsList: {
            include: {
              billingCycle: true,
            },
            orderBy: {
              installmentNumber: 'asc',
            },
          },
        },
        orderBy: {
          purchaseDate: 'desc',
        },
        take: input?.limit || 50,
      })
    }),

  /**
   * Obtener transacción por ID
   */
  getById: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const transaction = await ctx.prisma.transaction.findUnique({
      where: { id: input },
      include: {
        card: true,
        category: true,
        subcategory: true,
        installmentsList: {
          include: {
            billingCycle: true,
          },
          orderBy: {
            installmentNumber: 'asc',
          },
        },
      },
    })

    if (!transaction || transaction.userId !== ctx.user.id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Transacción no encontrada',
      })
    }

    return transaction
  }),

  /**
   * Anular transacción
   */
  void: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const transaction = await ctx.prisma.transaction.findUnique({
      where: { id: input },
    })

    if (!transaction || transaction.userId !== ctx.user.id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Transacción no encontrada',
      })
    }

    return voidTransaction(input)
  }),

  /**
   * Desanular transacción
   */
  unvoid: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.prisma.transaction.findUnique({
        where: { id: input },
      })

      if (!transaction || transaction.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transacción no encontrada',
        })
      }

      return unvoidTransaction(input)
    }),

  /**
   * Actualizar transacción (solo datos básicos)
   * No se pueden modificar: monto, cuotas, tarjeta, fecha
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        description: z.string().min(1).optional(),
        categoryId: z.string().optional().nullable(),
        subcategoryId: z.string().optional().nullable(),
        expenseType: z
          .enum(['structural', 'emotional_recurrent', 'emotional_impulsive'])
          .optional()
          .nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const transaction = await ctx.prisma.transaction.findUnique({
        where: { id },
      })

      if (!transaction || transaction.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transacción no encontrada',
        })
      }

      return ctx.prisma.transaction.update({
        where: { id },
        data: {
          description: data.description,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId,
          expenseType: data.expenseType,
          notes: data.notes,
        },
      })
    }),

  /**
   * Eliminar transacción permanentemente
   * A diferencia de "anular", esto borra el registro completamente
   */
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.prisma.transaction.findUnique({
        where: { id: input },
        include: {
          installmentsList: true,
        },
      })

      if (!transaction || transaction.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transacción no encontrada',
        })
      }

      // Primero eliminar las cuotas asociadas
      if (transaction.installmentsList.length > 0) {
        await ctx.prisma.installment.deleteMany({
          where: { transactionId: input },
        })
      }

      // Luego eliminar la transacción
      const deleted = await ctx.prisma.transaction.delete({
        where: { id: input },
      })

      if (transaction.cardId) {
        await recalculateBillingCycleTotals(transaction.cardId)
      }

      return deleted
    }),

  /**
   * Obtener categorías del usuario
   */
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    await ensureExpenseTaxonomyForUser(ctx.prisma, ctx.user.id)

    const categories = await ctx.prisma.category.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        subcategories: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return sortCategoriesByExpenseTaxonomy(categories).map((category) => ({
      ...category,
      subcategories: sortSubcategoriesByExpenseTaxonomy(
        category.name,
        category.subcategories
      ),
    }))
  }),

  /**
   * Crear categoría de gasto
   */
  createCategory: protectedProcedure
    .input(
      z.object({
        name: categoryNameInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rawName = input.name.trim()
      if (!rawName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre de categoría inválido',
        })
      }

      const name = getCanonicalExpenseCategoryName(rawName)
      const normalizedName = normalizeExpenseCategoryText(name)

      const existingCategories = await ctx.prisma.category.findMany({
        where: { userId: ctx.user.id },
        select: { id: true, name: true },
      })

      const existing = existingCategories.find(
        (category) => normalizeExpenseCategoryText(category.name) === normalizedName
      )
      if (existing) return existing

      return ctx.prisma.category.create({
        data: {
          userId: ctx.user.id,
          name,
        },
      })
    }),

  /**
   * Editar categoría de gasto
   */
  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: categoryNameInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoría no encontrada',
        })
      }

      const rawName = input.name.trim()
      if (!rawName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre de categoría inválido',
        })
      }

      const name = getCanonicalExpenseCategoryName(rawName)
      const normalizedName = normalizeExpenseCategoryText(name)

      const existingCategories = await ctx.prisma.category.findMany({
        where: { userId: ctx.user.id },
        select: { id: true, name: true },
      })

      const duplicated = existingCategories.find(
        (existing) =>
          existing.id !== category.id &&
          normalizeExpenseCategoryText(existing.name) === normalizedName
      )

      if (duplicated) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ya existe una categoría con ese nombre',
        })
      }

      return ctx.prisma.category.update({
        where: { id: category.id },
        data: { name },
      })
    }),

  /**
   * Eliminar categoría de gasto
   * Opcionalmente permite mover transacciones a otra categoría.
   */
  deleteCategory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        replacementCategoryId: z.string().optional(),
        replacementSubcategoryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
        include: {
          budgetLimits: true,
        },
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoría no encontrada',
        })
      }

      if (
        input.replacementCategoryId &&
        input.replacementCategoryId === category.id
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La categoría destino debe ser diferente',
        })
      }

      let replacementCategory:
        | {
            id: string
            subcategories: Array<{ id: string }>
          }
        | null = null

      if (input.replacementCategoryId) {
        replacementCategory = await ctx.prisma.category.findFirst({
          where: {
            id: input.replacementCategoryId,
            userId: ctx.user.id,
          },
          select: {
            id: true,
            subcategories: {
              select: { id: true },
            },
          },
        })

        if (!replacementCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Categoría destino no encontrada',
          })
        }
      }

      let replacementSubcategoryId: string | undefined

      if (input.replacementSubcategoryId) {
        if (!replacementCategory) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Selecciona primero una categoría destino',
          })
        }

        const subcategoryExists = replacementCategory.subcategories.some(
          (subcategory) => subcategory.id === input.replacementSubcategoryId
        )

        if (!subcategoryExists) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'La subcategoría destino no pertenece a la categoría seleccionada',
          })
        }

        replacementSubcategoryId = input.replacementSubcategoryId
      }

      if (replacementCategory) {
        await ctx.prisma.transaction.updateMany({
          where: {
            userId: ctx.user.id,
            categoryId: category.id,
          },
          data: {
            categoryId: replacementCategory.id,
            subcategoryId: replacementSubcategoryId ?? null,
          },
        })

        for (const oldLimit of category.budgetLimits) {
          const existingTargetLimit = await ctx.prisma.budgetLimit.findUnique({
            where: {
              userId_categoryId: {
                userId: ctx.user.id,
                categoryId: replacementCategory.id,
              },
            },
          })

          const nextValue =
            Number(oldLimit.monthlyLimit) + Number(existingTargetLimit?.monthlyLimit || 0)

          if (existingTargetLimit) {
            await ctx.prisma.budgetLimit.update({
              where: { id: existingTargetLimit.id },
              data: { monthlyLimit: nextValue },
            })
          } else {
            await ctx.prisma.budgetLimit.create({
              data: {
                userId: ctx.user.id,
                categoryId: replacementCategory.id,
                monthlyLimit: Number(oldLimit.monthlyLimit),
              },
            })
          }
        }
      } else {
        await ctx.prisma.transaction.updateMany({
          where: {
            userId: ctx.user.id,
            categoryId: category.id,
          },
          data: {
            categoryId: null,
            subcategoryId: null,
          },
        })
      }

      await ctx.prisma.category.delete({
        where: {
          id: category.id,
        },
      })

      return { success: true }
    }),

  /**
   * Crear estructura base de categorías + subcategorías maestras
   */
  seedExpenseCategories: protectedProcedure.mutation(async ({ ctx }) => {
    return ensureExpenseTaxonomyForUser(ctx.prisma, ctx.user.id)
  }),

  /**
   * Normalizar categorías existentes hacia la estructura maestra
   * - Migra categorías legacy conocidas a categoría/subcategoría destino
   * - Reasigna subcategorías mal ubicadas según la taxonomía recomendada
   * - Transfiere límites de presupuesto
   * - Elimina categorías legacy migradas
   * - Limpia categorías/subcategorías no maestras sin uso
   */
  normalizeExpenseCategories: protectedProcedure.mutation(async ({ ctx }) => {
    const taxonomySeed = await ensureExpenseTaxonomyForUser(ctx.prisma, ctx.user.id)

    const categories = await ctx.prisma.category.findMany({
      where: {
        userId: ctx.user.id,
      },
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
      ])
    )

    const migratedCategoryIds = new Set<string>()
    let migratedTransactions = 0
    let transferredBudgetLimits = 0
    let normalizedSubcategoryTransactions = 0
    let removedSubcategories = 0

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
        normalizeExpenseCategoryText(mapping.category)
      )

      if (!targetCategory || targetCategory.id === category.id) continue

      let targetSubcategoryId: string | null = null
      if (mapping.subcategory) {
        const canonicalSubcategoryName = getCanonicalExpenseSubcategoryName(
          targetCategory.name,
          mapping.subcategory
        )
        let subcategory = targetCategory.subcategories.find(
          (sub) =>
            normalizeExpenseCategoryText(sub.name) ===
            normalizeExpenseCategoryText(canonicalSubcategoryName)
        )

        if (!subcategory) {
          subcategory = await ctx.prisma.subCategory.create({
            data: {
              categoryId: targetCategory.id,
              name: canonicalSubcategoryName,
            },
          })
          targetCategory.subcategories.push(subcategory)
        }

        targetSubcategoryId = subcategory.id
      }

      const txUpdate = await ctx.prisma.transaction.updateMany({
        where: {
          userId: ctx.user.id,
          categoryId: category.id,
        },
        data: {
          categoryId: targetCategory.id,
          subcategoryId: targetSubcategoryId,
        },
      })

      migratedTransactions += txUpdate.count
      migratedCategoryIds.add(category.id)

      for (const oldLimit of category.budgetLimits) {
        const existingTargetLimit = await ctx.prisma.budgetLimit.findUnique({
          where: {
            userId_categoryId: {
              userId: ctx.user.id,
              categoryId: targetCategory.id,
            },
          },
        })

        const mergedMonthlyLimit =
          Number(oldLimit.monthlyLimit) + Number(existingTargetLimit?.monthlyLimit || 0)

        if (existingTargetLimit) {
          await ctx.prisma.budgetLimit.update({
            where: { id: existingTargetLimit.id },
            data: { monthlyLimit: mergedMonthlyLimit },
          })
        } else {
          await ctx.prisma.budgetLimit.create({
            data: {
              userId: ctx.user.id,
              categoryId: targetCategory.id,
              monthlyLimit: Number(oldLimit.monthlyLimit),
            },
          })
        }

        await ctx.prisma.budgetLimit.delete({
          where: { id: oldLimit.id },
        })

        transferredBudgetLimits += 1
      }
    }

    let removedCategories = 0

    if (migratedCategoryIds.size > 0) {
      const deletedMigrated = await ctx.prisma.category.deleteMany({
        where: {
          userId: ctx.user.id,
          id: {
            in: Array.from(migratedCategoryIds),
          },
        },
      })
      removedCategories += deletedMigrated.count
    }

    const remainingCategories = await ctx.prisma.category.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        _count: {
          select: {
            transactions: true,
            budgetLimits: true,
          },
        },
      },
    })

    const unusedNonMasterIds = remainingCategories
      .filter(
        (category) =>
          !isMasterExpenseCategory(category.name) &&
          category._count.transactions === 0 &&
          category._count.budgetLimits === 0
      )
      .map((category) => category.id)

    if (unusedNonMasterIds.length > 0) {
      const deletedUnused = await ctx.prisma.category.deleteMany({
        where: {
          userId: ctx.user.id,
          id: { in: unusedNonMasterIds },
        },
      })
      removedCategories += deletedUnused.count
    }

    const refreshedCategories = await ctx.prisma.category.findMany({
      where: { userId: ctx.user.id },
      include: {
        subcategories: true,
      },
    })

    const refreshedCategoriesByNormalizedName = new Map(
      refreshedCategories.map((category) => [
        normalizeExpenseCategoryText(category.name),
        category,
      ])
    )

    const transactionsWithSubcategory = await ctx.prisma.transaction.findMany({
      where: {
        userId: ctx.user.id,
        subcategoryId: { not: null },
      },
      select: {
        id: true,
        categoryId: true,
        subcategoryId: true,
        category: {
          select: {
            name: true,
          },
        },
        subcategory: {
          select: {
            name: true,
          },
        },
      },
    })

    for (const transaction of transactionsWithSubcategory) {
      if (!transaction.subcategory) continue

      const normalizationTarget = resolveSubcategoryNormalizationTarget(
        transaction.category?.name || '',
        transaction.subcategory.name
      )

      if (!normalizationTarget) continue

      const targetCategory = refreshedCategoriesByNormalizedName.get(
        normalizeExpenseCategoryText(normalizationTarget.category)
      )

      if (!targetCategory) continue

      const canonicalTargetSubcategoryName = getCanonicalExpenseSubcategoryName(
        targetCategory.name,
        normalizationTarget.subcategory
      )

      let targetSubcategory = targetCategory.subcategories.find((subcategory) =>
        sameNormalizedValue(subcategory.name, canonicalTargetSubcategoryName)
      )

      if (!targetSubcategory) {
        targetSubcategory = await ctx.prisma.subCategory.create({
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

      await ctx.prisma.transaction.update({
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

    const subcategoriesForCleanup = await ctx.prisma.subCategory.findMany({
      where: {
        category: {
          userId: ctx.user.id,
        },
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    })

    const subcategoryIdsToDelete = subcategoriesForCleanup
      .filter(
        (subcategory) =>
          isMasterExpenseCategory(subcategory.category.name) &&
          !isMasterExpenseSubcategory(subcategory.category.name, subcategory.name) &&
          subcategory._count.transactions === 0
      )
      .map((subcategory) => subcategory.id)

    if (subcategoryIdsToDelete.length > 0) {
      const deletedSubcategories = await ctx.prisma.subCategory.deleteMany({
        where: {
          id: {
            in: subcategoryIdsToDelete,
          },
        },
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
  }),

  /**
   * Compras en cuotas activas (con cuotas pendientes)
   */
  getActiveInstallmentPurchases: protectedProcedure
    .input(
      z
        .object({
          cardId: z.string().optional(),
          includeThirdParty: z.boolean().optional().default(true),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.user.id,
        installments: { gt: 1 },
        isVoided: false,
        paymentMethod: 'credit_card',
      }

      if (input?.cardId) {
        where.cardId = input.cardId
      }

      if (input?.includeThirdParty === false) {
        where.isForThirdParty = false
      }

      const transactions = await ctx.prisma.transaction.findMany({
        where,
        include: {
          card: { select: { id: true, name: true, bank: true, brand: true } },
          category: { select: { id: true, name: true } },
          installmentsList: {
            orderBy: { installmentNumber: 'asc' },
            select: {
              id: true,
              installmentNumber: true,
              amount: true,
              isPaid: true,
              impactDate: true,
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
      })

      // Filter to only those with pending installments and map
      return transactions
        .filter((t) => t.installmentsList.some((i) => !i.isPaid))
        .map((t) => {
          const paidCount = t.installmentsList.filter((i) => i.isPaid).length
          const installmentAmount =
            Number(t.totalAmount) / t.installments

          return {
            id: t.id,
            description: t.description,
            totalAmount: Number(t.totalAmount),
            installments: t.installments,
            paidCount,
            pendingCount: t.installments - paidCount,
            installmentAmount,
            purchaseDate: t.purchaseDate,
            isForThirdParty: t.isForThirdParty,
            card: t.card,
            category: t.category,
            installmentsList: t.installmentsList.map((i) => ({
              ...i,
              amount: Number(i.amount),
            })),
          }
        })
    }),

  /**
   * Marcar cuota de compra como pagada
   */
  markInstallmentPaid: protectedProcedure
    .input(z.object({ installmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.installment.findFirst({
        where: {
          id: input.installmentId,
          transaction: { userId: ctx.user.id },
        },
        include: {
          transaction: {
            select: { cardId: true },
          },
        },
      })

      if (!installment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cuota no encontrada',
        })
      }

      const updated = await ctx.prisma.installment.update({
        where: { id: input.installmentId },
        data: { isPaid: true, paidAt: new Date() },
      })

      if (installment.transaction.cardId) {
        await recalculateBillingCycleTotals(installment.transaction.cardId)
      }

      return updated
    }),

  /**
   * Desmarcar cuota de compra como pagada
   */
  unmarkInstallmentPaid: protectedProcedure
    .input(z.object({ installmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.installment.findFirst({
        where: {
          id: input.installmentId,
          transaction: { userId: ctx.user.id },
        },
        include: {
          transaction: {
            select: { cardId: true },
          },
        },
      })

      if (!installment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cuota no encontrada',
        })
      }

      const updated = await ctx.prisma.installment.update({
        where: { id: input.installmentId },
        data: { isPaid: false, paidAt: null },
      })

      if (installment.transaction.cardId) {
        await recalculateBillingCycleTotals(installment.transaction.cardId)
      }

      return updated
    }),

  /**
   * Estadísticas de gastos
   */
  getStats: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const transactions = await ctx.prisma.transaction.findMany({
        where: {
          userId: ctx.user.id,
          purchaseDate: {
            gte: input.startDate,
            lte: input.endDate,
          },
          isVoided: false,
        },
        include: {
          category: true,
          subcategory: true,
          card: true,
        },
      })

      const total = transactions.reduce(
        (sum, t) => sum + Number(t.totalAmount),
        0
      )

      const byCategory = transactions.reduce(
        (acc, t) => {
          const catName = t.category?.name || 'Sin categoría'
          acc[catName] = (acc[catName] || 0) + Number(t.totalAmount)
          return acc
        },
        {} as Record<string, number>
      )

      const byCard = transactions.reduce(
        (acc, t) => {
          if (t.card) {
            const cardName = t.card.name
            acc[cardName] = (acc[cardName] || 0) + Number(t.totalAmount)
          }
          return acc
        },
        {} as Record<string, number>
      )

      const byExpenseType = transactions.reduce(
        (acc, t) => {
          const type = t.expenseType || 'sin_clasificar'
          acc[type] = (acc[type] || 0) + Number(t.totalAmount)
          return acc
        },
        {} as Record<string, number>
      )

      const bySubcategory = transactions.reduce(
        (acc, t) => {
          if (t.subcategory) {
            const catName = t.category?.name || 'Sin categoría'
            const key = `${catName} > ${t.subcategory.name}`
            acc[key] = (acc[key] || 0) + Number(t.totalAmount)
          }
          return acc
        },
        {} as Record<string, number>
      )

      return {
        total,
        count: transactions.length,
        byCategory,
        byCard,
        byExpenseType,
        bySubcategory,
      }
    }),

  /**
   * Crear subcategoría
   */
  createSubcategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        name: subcategoryNameInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar que la categoría pertenezca al usuario
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.user.id },
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoría no encontrada',
        })
      }

      const rawName = input.name.trim()
      if (!rawName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre de subcategoría inválido',
        })
      }

      const name = getCanonicalExpenseSubcategoryName(category.name, rawName)
      const normalizedName = normalizeExpenseCategoryText(name)

      const existingSubcategories = await ctx.prisma.subCategory.findMany({
        where: { categoryId: input.categoryId },
        select: { id: true, name: true },
      })

      const existing = existingSubcategories.find(
        (subcategory) => normalizeExpenseCategoryText(subcategory.name) === normalizedName
      )
      if (existing) return existing

      return ctx.prisma.subCategory.create({
        data: {
          categoryId: input.categoryId,
          name,
        },
      })
    }),

  /**
   * Editar o mover subcategoría
   */
  updateSubcategory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: subcategoryNameInputSchema,
        categoryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentSubcategory = await ctx.prisma.subCategory.findFirst({
        where: {
          id: input.id,
          category: { userId: ctx.user.id },
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (!currentSubcategory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subcategoría no encontrada',
        })
      }

      let targetCategory = currentSubcategory.category

      if (input.categoryId && input.categoryId !== currentSubcategory.categoryId) {
        const requestedCategory = await ctx.prisma.category.findFirst({
          where: {
            id: input.categoryId,
            userId: ctx.user.id,
          },
          select: {
            id: true,
            name: true,
          },
        })

        if (!requestedCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Categoría destino no encontrada',
          })
        }

        targetCategory = requestedCategory
      }

      const rawName = input.name.trim()
      if (!rawName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre de subcategoría inválido',
        })
      }

      const targetName = getCanonicalExpenseSubcategoryName(targetCategory.name, rawName)
      const normalizedTargetName = normalizeExpenseCategoryText(targetName)

      const existingSubcategories = await ctx.prisma.subCategory.findMany({
        where: {
          categoryId: targetCategory.id,
        },
        select: {
          id: true,
          name: true,
        },
      })

      const duplicate = existingSubcategories.find(
        (subcategory) =>
          subcategory.id !== currentSubcategory.id &&
          normalizeExpenseCategoryText(subcategory.name) === normalizedTargetName
      )

      if (duplicate) {
        await ctx.prisma.transaction.updateMany({
          where: {
            userId: ctx.user.id,
            subcategoryId: currentSubcategory.id,
          },
          data: {
            categoryId: targetCategory.id,
            subcategoryId: duplicate.id,
          },
        })

        await ctx.prisma.subCategory.delete({
          where: {
            id: currentSubcategory.id,
          },
        })

        const merged = await ctx.prisma.subCategory.findUnique({
          where: {
            id: duplicate.id,
          },
        })

        if (!merged) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'No se pudo resolver la subcategoría resultante',
          })
        }

        return merged
      }

      const movedCategory = targetCategory.id !== currentSubcategory.categoryId

      const updated = await ctx.prisma.subCategory.update({
        where: {
          id: currentSubcategory.id,
        },
        data: {
          name: targetName,
          categoryId: targetCategory.id,
        },
      })

      if (movedCategory) {
        await ctx.prisma.transaction.updateMany({
          where: {
            userId: ctx.user.id,
            subcategoryId: currentSubcategory.id,
          },
          data: {
            categoryId: targetCategory.id,
          },
        })
      }

      return updated
    }),

  /**
   * Eliminar subcategoría (con opción de reasignar transacciones)
   */
  deleteSubcategory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        replacementSubcategoryId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subcategory = await ctx.prisma.subCategory.findFirst({
        where: {
          id: input.id,
          category: { userId: ctx.user.id },
        },
        select: {
          id: true,
          categoryId: true,
        },
      })

      if (!subcategory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subcategoría no encontrada',
        })
      }

      if (
        input.replacementSubcategoryId &&
        input.replacementSubcategoryId === subcategory.id
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La subcategoría destino debe ser diferente',
        })
      }

      if (input.replacementSubcategoryId) {
        const replacementSubcategory = await ctx.prisma.subCategory.findFirst({
          where: {
            id: input.replacementSubcategoryId,
            category: { userId: ctx.user.id },
          },
          select: {
            id: true,
            categoryId: true,
          },
        })

        if (!replacementSubcategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Subcategoría destino no encontrada',
          })
        }

        await ctx.prisma.transaction.updateMany({
          where: {
            userId: ctx.user.id,
            subcategoryId: subcategory.id,
          },
          data: {
            categoryId: replacementSubcategory.categoryId,
            subcategoryId: replacementSubcategory.id,
          },
        })
      } else {
        await ctx.prisma.transaction.updateMany({
          where: {
            userId: ctx.user.id,
            subcategoryId: subcategory.id,
          },
          data: {
            subcategoryId: null,
          },
        })
      }

      return ctx.prisma.subCategory.delete({
        where: { id: subcategory.id },
      })
    }),

  /**
   * Buscar o crear subcategoría por nombre (para importer)
   */
  getOrCreateSubcategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        name: subcategoryNameInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.user.id },
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoría no encontrada',
        })
      }

      const rawName = input.name.trim()
      if (!rawName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre de subcategoría inválido',
        })
      }

      const name = getCanonicalExpenseSubcategoryName(category.name, rawName)
      const normalizedName = normalizeExpenseCategoryText(name)

      const existingSubcategories = await ctx.prisma.subCategory.findMany({
        where: { categoryId: input.categoryId },
        select: { id: true, name: true },
      })

      const existing = existingSubcategories.find(
        (subcategory) => normalizeExpenseCategoryText(subcategory.name) === normalizedName
      )
      if (existing) return existing

      return ctx.prisma.subCategory.create({
        data: {
          categoryId: input.categoryId,
          name,
        },
      })
    }),
})
