import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import {
  createTransactionWithInstallments,
  voidTransaction,
  unvoidTransaction,
} from '@/lib/installment-engine'

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
      return ctx.prisma.transaction.delete({
        where: { id: input },
      })
    }),

  /**
   * Obtener categorías del usuario
   */
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.category.findMany({
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
      })

      if (!installment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cuota no encontrada',
        })
      }

      return ctx.prisma.installment.update({
        where: { id: input.installmentId },
        data: { isPaid: true, paidAt: new Date() },
      })
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
      })

      if (!installment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cuota no encontrada',
        })
      }

      return ctx.prisma.installment.update({
        where: { id: input.installmentId },
        data: { isPaid: false, paidAt: null },
      })
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
        name: z.string().min(1),
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

      return ctx.prisma.subCategory.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
        },
      })
    }),

  /**
   * Eliminar subcategoría (las transacciones quedan con subcategoryId: null)
   */
  deleteSubcategory: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const subcategory = await ctx.prisma.subCategory.findFirst({
        where: {
          id: input,
          category: { userId: ctx.user.id },
        },
      })

      if (!subcategory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subcategoría no encontrada',
        })
      }

      // Desvincular transacciones
      await ctx.prisma.transaction.updateMany({
        where: { subcategoryId: input },
        data: { subcategoryId: null },
      })

      return ctx.prisma.subCategory.delete({
        where: { id: input },
      })
    }),

  /**
   * Buscar o crear subcategoría por nombre (para importer)
   */
  getOrCreateSubcategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        name: z.string().min(1),
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

      const existing = await ctx.prisma.subCategory.findUnique({
        where: {
          categoryId_name: {
            categoryId: input.categoryId,
            name: input.name,
          },
        },
      })

      if (existing) return existing

      return ctx.prisma.subCategory.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
        },
      })
    }),
})
