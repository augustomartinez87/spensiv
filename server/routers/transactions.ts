import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
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
  normalizeExpenseCategoryText,
  sortCategoriesByExpenseTaxonomy,
  sortSubcategoriesByExpenseTaxonomy,
} from '@/lib/expense-categories'
import {
  normalizeExpenseCategories,
  transferBudgetLimits,
} from '../services/category.service'

const categoryNameInputSchema = z.string().min(1).max(80)
const subcategoryNameInputSchema = z.string().min(1).max(80)

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
      const where: Prisma.TransactionWhereInput = {
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
        totalAmount: z.number().positive().optional(),
        purchaseDate: z.date().optional(),
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

      if (
        transaction.paymentMethod === 'credit_card' &&
        (data.totalAmount !== undefined || data.purchaseDate !== undefined)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se puede modificar monto o fecha de gastos con tarjeta de crédito.',
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
          ...(data.totalAmount !== undefined && { totalAmount: data.totalAmount }),
          ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate }),
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

        await transferBudgetLimits(
          ctx.prisma,
          ctx.user.id,
          category.budgetLimits,
          replacementCategory.id,
        )
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
    return normalizeExpenseCategories(ctx.prisma, ctx.user.id)
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
      const where: Prisma.TransactionWhereInput = {
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
              billingCycle: {
                select: { dueDate: true },
              },
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
              dueDate: i.billingCycle.dueDate,
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

})
