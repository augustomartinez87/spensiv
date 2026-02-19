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
   * Deuda total - Calcula la suma REAL de todas las cuotas pendientes de todas las tarjetas
   * Incluye: cuotas pendientes del período actual + cuotas futuras pendientes
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
          include: {
            installments: {
              where: {
                isPaid: false,
              },
            },
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
   * Balances por tarjeta - Devuelve el balance real de cada tarjeta (todas las cuotas pendientes)
   * y el balance del período actual (solo cuotas de este mes)
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
            // Only select fields we need — no installments include
            select: {
              id: true,
              period: true,
              totalAmount: true,
              dueDate: true,
              status: true,
            },
          },
        },
      })

      const cardBalances = cards.map((card) => {
        // Balance total: todas las cuotas pendientes (uses cached totalAmount)
        const totalBalance = card.billingCycles.reduce(
          (sum, cycle) => sum + Number(cycle.totalAmount || 0),
          0
        )

        // Balance del período actual: solo cuotas de este mes
        const currentPeriodBalance = card.billingCycles
          .filter((cycle) => cycle.period === currentPeriod)
          .reduce((sum, cycle) => sum + Number(cycle.totalAmount || 0), 0)

        // Próximo vencimiento
        const nextDueCycle = card.billingCycles
          .filter((cycle) => cycle.status === 'open' || cycle.status === 'closed')
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]

        return {
          id: card.id,
          name: card.name,
          bank: card.bank,
          brand: card.brand,
          last4: card.last4,
          creditLimit: card.creditLimit ? Number(card.creditLimit) : null,
          closingDay: card.closingDay,
          dueDay: card.dueDay,
          totalBalance,
          currentPeriodBalance,
          nextDueDate: nextDueCycle?.dueDate || null,
          nextDueAmount: nextDueCycle ? Number(nextDueCycle.totalAmount || 0) : 0,
          cycleCount: card.billingCycles.length,
        }
      })

      // Calcular deuda total real (suma de todos los balances)
      const totalDebt = cardBalances.reduce((sum, card) => sum + card.totalBalance, 0)

      // Get third-party amounts per card
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

      // Build all period strings upfront
      const periods = Array.from({ length: months }, (_, i) =>
        formatPeriod(addMonths(now, i))
      )

      // Single query for all periods instead of N+1 loop
      const allInstallments = await ctx.prisma.installment.findMany({
        where: {
          billingCycle: {
            period: { in: periods },
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
          billingCycle: {
            select: { period: true },
          },
        },
      })

      // Group by period in JS
      const byPeriod = new Map<string, typeof allInstallments>()
      for (const period of periods) {
        byPeriod.set(period, [])
      }
      for (const inst of allInstallments) {
        const period = inst.billingCycle.period
        byPeriod.get(period)?.push(inst)
      }

      return periods.map((period) => {
        const installments = byPeriod.get(period) || []

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

        return {
          period,
          totalAmount,
          installmentCount: installments.length,
          byCard,
        }
      })
    }),
})
