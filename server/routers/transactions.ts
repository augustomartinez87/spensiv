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
   * Crear transacción con cuotas
   */
  create: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        description: z.string().min(1),
        totalAmount: z.number().positive(),
        purchaseDate: z.date(),
        installments: z.number().min(1).max(60),
        categoryId: z.string().optional(),
        expenseType: z
          .enum(['structural', 'emotional_recurrent', 'emotional_impulsive'])
          .optional(),
        isForThirdParty: z.boolean().optional(),
        thirdPartyId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
          const cardName = t.card.name
          acc[cardName] = (acc[cardName] || 0) + Number(t.totalAmount)
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

      return {
        total,
        count: transactions.length,
        byCategory,
        byCard,
        byExpenseType,
      }
    }),
})
