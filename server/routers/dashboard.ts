import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { subMonths } from 'date-fns'
import { getMonthlyBalance, getMonthlyTotals, getCashFlowProjection } from '@/lib/balance'
import { formatPeriod } from '@/lib/periods'
import { getDolarMep } from '@/lib/dolar'
import { computeCardBalances } from '@/lib/card-analytics'

export const dashboardRouter = router({
  getMepRate: protectedProcedure.query(async () => {
    try {
      return { rate: await getDolarMep() }
    } catch {
      return { rate: null }
    }
  }),
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
   * Proyeccion de flujo de caja
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
   * Evolución mensual: ingresos y egresos de los últimos N meses
   */
  getEvolutionData: protectedProcedure
    .input(z.object({ months: z.number().min(2).max(12).default(6) }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const base = new Date(now.getFullYear(), now.getMonth(), 1)
      const periods: string[] = []
      for (let i = input.months - 1; i >= 0; i--) {
        periods.push(formatPeriod(subMonths(base, i)))
      }
      const results = await Promise.all(
        periods.map((period) => getMonthlyTotals(ctx.user.id, period))
      )
      return results.map((r) => ({
        period: r.period,
        income: r.totalIncome,
        expense: r.totalExpense,
        balance: r.balance,
      }))
    }),

  /**
   * Balances por tarjeta.
   */
  getCardBalances: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const currentPeriod = input?.period || formatPeriod(new Date())

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
            include: {
              installments: {
                where: {
                  isPaid: false,
                  transaction: {
                    isVoided: false,
                  },
                },
                select: {
                  amount: true,
                },
              },
            },
          },
        },
      })

      const { cards: cardBalances, totalDebt } = computeCardBalances(cards, currentPeriod)

      const thirdPartyByCard = await ctx.prisma.thirdPartyPurchase.groupBy({
        by: ['cardId'],
        where: {
          userId: ctx.user.id,
          status: 'active',
        },
        _sum: { totalAmount: true },
      })

      const thirdPartyMap = new Map(
        thirdPartyByCard.map((tp) => [tp.cardId, Number(tp._sum.totalAmount || 0)])
      )

      const cardsWithThirdParty = cardBalances.map((card) => ({
        ...card,
        thirdPartyAmount: thirdPartyMap.get(card.id) || 0,
      }))

      return {
        cards: cardsWithThirdParty,
        totalDebt,
        cardCount: cards.length,
      }
    }),

})
