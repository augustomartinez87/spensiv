import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { getMonthlyBalance, getCashFlowProjection } from '@/lib/balance'
import { formatPeriod } from '@/lib/periods'

export const dashboardRouter = router({
  /**
   * Balance mensual completo (Ingresos - Egresos)
   */
  getMonthlyBalance: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/), // "2025-01"
      })
    )
    .query(async ({ ctx, input }) => {
      return getMonthlyBalance(ctx.user.id, input.period)
    }),

  /**
   * Proyección de flujo de caja
   */
  getBalanceProjection: protectedProcedure
    .input(
      z.object({
        startPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        months: z.number().min(1).max(12).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startPeriod = input.startPeriod || formatPeriod(new Date())
      return getCashFlowProjection(
        ctx.user.id,
        startPeriod,
        input.months || 6
      )
    }),

  /**
   * Resumen del mes actual
   */
  getCurrentMonth: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const startDate = startOfMonth(now)
    const endDate = endOfMonth(now)

    // Obtener transacciones y cuotas en paralelo
    const period = formatPeriod(now) // "2025-01"

    const [transactions, installments] = await Promise.all([
      ctx.prisma.transaction.findMany({
        where: {
          userId: ctx.user.id,
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
          isVoided: false,
        },
      }),
      ctx.prisma.installment.findMany({
        where: {
          billingCycle: {
            period,
            card: {
              userId: ctx.user.id,
            },
          },
          transaction: {
            isVoided: false,
          },
        },
        include: {
          transaction: {
            include: {
              card: true,
              category: true,
            },
          },
        },
      })
    ])

    const totalSpent = transactions.reduce(
      (sum, t) => sum + Number(t.totalAmount),
      0
    )

    const totalImpact = installments.reduce(
      (sum, inst) => sum + Number(inst.amount),
      0
    )

    const byCard = installments.reduce(
      (acc, inst) => {
        const cardName = inst.transaction.card?.name || 'Sin tarjeta'
        acc[cardName] = (acc[cardName] || 0) + Number(inst.amount)
        return acc
      },
      {} as Record<string, number>
    )

    const byCategory = installments.reduce(
      (acc, inst) => {
        const catName = inst.transaction.category?.name || 'Sin categoría'
        acc[catName] = (acc[catName] || 0) + Number(inst.amount)
        return acc
      },
      {} as Record<string, number>
    )

    return {
      period,
      totalSpent, // Compras del mes
      totalImpact, // Cuotas que impactan
      transactionCount: transactions.length,
      installmentCount: installments.length,
      byCard,
      byCategory,
    }
  }),

  /**
   * Deuda total
   */
  getTotalDebt: protectedProcedure.query(async ({ ctx }) => {
    const cards = await ctx.prisma.creditCard.findMany({
      where: {
        userId: ctx.user.id,
        isActive: true,
      },
      include: {
        billingCycles: {
          where: {
            status: { in: ['open', 'closed'] },
          },
        },
      },
    })

    const totalDebt = cards.reduce((sum, card) => {
      return (
        sum +
        card.billingCycles.reduce(
          (cycleSum, cycle) => cycleSum + Number(cycle.totalAmount || 0),
          0
        )
      )
    }, 0)

    return {
      amount: totalDebt,
      cardCount: cards.length,
    }
  }),

  /**
   * Próximos vencimientos
   */
  getUpcomingPayments: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()

    const cycles = await ctx.prisma.billingCycle.findMany({
      where: {
        card: {
          userId: ctx.user.id,
          isActive: true,
        },
        dueDate: {
          gte: now,
        },
        status: { in: ['open', 'closed'] },
      },
      include: {
        card: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 5,
    })

    return cycles.map((cycle) => ({
      card: cycle.card,
      amount: Number(cycle.totalAmount || 0),
      dueDate: cycle.dueDate,
      period: cycle.period,
      daysUntil: Math.ceil(
        (cycle.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
  }),

  /**
   * Proyección de cashflow (próximos N meses)
   */
  getCashflowProjection: protectedProcedure
    .input(
      z.object({
        months: z.number().min(1).max(12).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const months = input?.months || 6
      const now = new Date()
      const projection = []

      for (let i = 0; i < months; i++) {
        const monthDate = addMonths(now, i)
        const period = formatPeriod(monthDate)

        const installments = await ctx.prisma.installment.findMany({
          where: {
            billingCycle: {
              period,
              card: {
                userId: ctx.user.id,
              },
            },
            transaction: {
              isVoided: false,
            },
          },
          include: {
            transaction: {
              include: {
                card: true,
              },
            },
          },
        })

        const totalAmount = installments.reduce(
          (sum, inst) => sum + Number(inst.amount),
          0
        )

        const byCard = installments.reduce(
          (acc, inst) => {
            const cardName = inst.transaction.card?.name || 'Sin tarjeta'
            acc[cardName] = (acc[cardName] || 0) + Number(inst.amount)
            return acc
          },
          {} as Record<string, number>
        )

        projection.push({
          period,
          totalAmount,
          installmentCount: installments.length,
          byCard,
        })
      }

      return projection
    }),
})
