import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'

export const cardsRouter = router({
  /**
   * Listar todas las tarjetas del usuario
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.creditCard.findMany({
      where: {
        userId: ctx.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }),

  /**
   * Obtener una tarjeta por ID
   */
  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const card = await ctx.prisma.creditCard.findUnique({
        where: {
          id: input,
        },
      })

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      return card
    }),

  /**
   * Crear nueva tarjeta
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        bank: z.string().min(1),
        brand: z.enum(['visa', 'mastercard', 'amex']),
        last4: z.string().length(4).optional(),
        closingDay: z.number().min(1).max(31),
        dueDay: z.number().min(1).max(31),
        creditLimit: z.number().positive().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.creditCard.create({
        data: {
          userId: ctx.user.id,
          ...input,
        },
      })
    }),

  /**
   * Actualizar tarjeta
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        bank: z.string().min(1).optional(),
        brand: z.enum(['visa', 'mastercard', 'amex']).optional(),
        last4: z.string().length(4).optional(),
        closingDay: z.number().min(1).max(31).optional(),
        dueDay: z.number().min(1).max(31).optional(),
        creditLimit: z.number().positive().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const card = await ctx.prisma.creditCard.findUnique({
        where: { id },
      })

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      return ctx.prisma.creditCard.update({
        where: { id },
        data,
      })
    }),

  /**
   * Eliminar tarjeta
   */
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.prisma.creditCard.findUnique({
        where: { id: input },
      })

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      return ctx.prisma.creditCard.delete({
        where: { id: input },
      })
    }),

  /**
   * Obtener resumen de deuda por tarjeta
   */
  getDebtSummary: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const card = await ctx.prisma.creditCard.findUnique({
        where: { id: input },
        include: {
          billingCycles: {
            where: {
              status: { in: ['open', 'closed'] },
            },
            include: {
              installments: {
                where: {
                  isPaid: false,
                  transaction: {
                    isVoided: false,
                  },
                },
              },
            },
          },
        },
      })

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      const totalDebt = card.billingCycles.reduce((sum, cycle) => {
        return sum + Number(cycle.totalAmount || 0)
      }, 0)

      const nextPayment = card.billingCycles
        .filter((c) => c.status === 'closed' || c.status === 'open')
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]

      return {
        card,
        totalDebt,
        nextPayment: nextPayment
          ? {
              amount: Number(nextPayment.totalAmount || 0),
              dueDate: nextPayment.dueDate,
            }
          : null,
      }
    }),
})
