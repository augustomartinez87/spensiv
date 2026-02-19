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
        bank: z.string().min(1),
        brand: z.enum(['visa', 'mastercard', 'amex']),
        last4: z.string().length(4).optional(),
        closingDay: z.number().min(1).max(31),
        dueDay: z.number().min(1).max(31),
        creditLimit: z.number().positive().optional(),
        color: z.string().optional(),
        holderType: z.enum(['primary', 'additional']).default('primary'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const name = `${input.bank} ${input.brand.charAt(0).toUpperCase() + input.brand.slice(1)}`

      return ctx.prisma.creditCard.create({
        data: {
          userId: ctx.user.id,
          name,
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
        bank: z.string().min(1).optional(),
        brand: z.enum(['visa', 'mastercard', 'amex']).optional(),
        last4: z.string().length(4).optional(),
        closingDay: z.number().min(1).max(31).optional(),
        dueDay: z.number().min(1).max(31).optional(),
        creditLimit: z.number().positive().optional(),
        color: z.string().optional(),
        holderType: z.enum(['primary', 'additional']).optional(),
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

      // Re-generate name if bank or brand changes
      let name = card.name
      if (data.bank || data.brand) {
        const bank = data.bank || card.bank
        const brand = data.brand || card.brand
        name = `${bank} ${brand.charAt(0).toUpperCase() + brand.slice(1)}`
      }

      return ctx.prisma.creditCard.update({
        where: { id },
        data: {
          ...data,
          name,
        },
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

  /**
   * Obtener detalle completo de una tarjeta
   */
  getDetail: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      // Run both queries in parallel instead of sequentially
      const [card, recentTransactions] = await Promise.all([
        ctx.prisma.creditCard.findUnique({
          where: { id: input },
          include: {
            billingCycles: {
              where: {
                status: { in: ['open', 'closed'] },
              },
              select: {
                id: true,
                period: true,
                totalAmount: true,
                dueDate: true,
                status: true,
              },
            },
          },
        }),
        ctx.prisma.transaction.findMany({
          where: {
            cardId: input,
            userId: ctx.user.id,
            isVoided: false,
          },
          orderBy: {
            purchaseDate: 'desc',
          },
          take: 5,
        }),
      ])

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      // Calcular deuda total
      const totalBalance = card.billingCycles.reduce((sum, cycle) => {
        return sum + Number(cycle.totalAmount || 0)
      }, 0)

      // Calcular deuda del período actual
      const currentPeriodBalance = card.billingCycles
        .filter((cycle) => cycle.period === currentPeriod)
        .reduce((sum, cycle) => sum + Number(cycle.totalAmount || 0), 0)

      // Próximo vencimiento
      const nextDueCycle = card.billingCycles
        .filter((c) => c.status === 'open' || c.status === 'closed')
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]

      // Calcular porcentaje del límite usado
      const limitPercentage = card.creditLimit
        ? (totalBalance / Number(card.creditLimit)) * 100
        : null

      return {
        card,
        totalBalance,
        currentPeriodBalance,
        nextDueDate: nextDueCycle?.dueDate || null,
        nextDueAmount: nextDueCycle ? Number(nextDueCycle.totalAmount || 0) : 0,
        limitPercentage,
        recentTransactions,
      }
    }),

  /**
   * Listar ciclos de facturación de una tarjeta
   */
  listBillingCycles: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.billingCycle.findMany({
        where: {
          cardId: input,
          card: { userId: ctx.user.id }
        },
        orderBy: {
          period: 'desc',
        },
        take: 12,
      })
    }),

  /**
   * Actualizar fechas de un ciclo de facturación
   */
  updateBillingCycle: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        closeDate: z.date(),
        dueDate: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.billingCycle.findUnique({
        where: { id: input.id },
        include: { card: true },
      })

      if (!cycle || cycle.card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ciclo no encontrado',
        })
      }

      return ctx.prisma.billingCycle.update({
        where: { id: input.id },
        data: {
          closeDate: input.closeDate,
          dueDate: input.dueDate,
        },
      })
    }),

  /**
   * Obtener calendario de cierres para un año específico
   */
  getClosingSchedule: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        year: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verificar que la tarjeta pertenece al usuario
      const card = await ctx.prisma.creditCard.findUnique({
        where: { id: input.cardId },
      })

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      const schedules = await ctx.prisma.cardClosingSchedule.findMany({
        where: {
          cardId: input.cardId,
          year: input.year,
        },
        orderBy: {
          month: 'asc',
        },
      })

      // Devolver los valores por defecto de la tarjeta si no hay schedule configurado
      return {
        cardId: input.cardId,
        year: input.year,
        defaultClosingDay: card.closingDay,
        defaultDueDay: card.dueDay,
        schedules: schedules.map(s => ({
          month: s.month,
          closingDay: s.closingDay,
          dueDay: s.dueDay,
        })),
      }
    }),

  /**
   * Guardar calendario de cierres para un año
   */
  saveClosingSchedule: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        year: z.number(),
        schedules: z.array(
          z.object({
            month: z.number().min(1).max(12),
            closingDay: z.number().min(1).max(31),
            dueDay: z.number().min(1).max(31),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar que la tarjeta pertenece al usuario
      const card = await ctx.prisma.creditCard.findUnique({
        where: { id: input.cardId },
      })

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      // Usar transacción para guardar todos los schedules
      await ctx.prisma.$transaction(
        input.schedules.map((schedule) =>
          ctx.prisma.cardClosingSchedule.upsert({
            where: {
              cardId_year_month: {
                cardId: input.cardId,
                year: input.year,
                month: schedule.month,
              },
            },
            update: {
              closingDay: schedule.closingDay,
              dueDay: schedule.dueDay,
            },
            create: {
              cardId: input.cardId,
              year: input.year,
              month: schedule.month,
              closingDay: schedule.closingDay,
              dueDay: schedule.dueDay,
            },
          })
        )
      )

      return { success: true }
    }),

  /**
   * Eliminar un schedule específico (vuelve a usar defaults)
   */
  deleteClosingSchedule: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        year: z.number(),
        month: z.number().min(1).max(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar que la tarjeta pertenece al usuario
      const card = await ctx.prisma.creditCard.findUnique({
        where: { id: input.cardId },
      })

      if (!card || card.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tarjeta no encontrada',
        })
      }

      await ctx.prisma.cardClosingSchedule.deleteMany({
        where: {
          cardId: input.cardId,
          year: input.year,
          month: input.month,
        },
      })

      return { success: true }
    }),
})
