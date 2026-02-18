import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { calculatePersonScore, calculateExpectedValue } from '@/lib/loan-scoring'
import { getDolarMep, pesify } from '@/lib/dolar'

export const portfolioRouter = router({
  getMetrics: protectedProcedure
    .input(z.object({ fciRate: z.number().min(0).default(0.40) }))
    .query(async ({ ctx, input }) => {
      const [loans, mepRate] = await Promise.all([
        ctx.prisma.loan.findMany({
          where: { userId: ctx.user.id, status: 'active' },
          include: {
            person: true,
            loanInstallments: {
              select: {
                amount: true,
                interest: true,
                isPaid: true,
                dueDate: true,
              },
            },
          },
        }),
        getDolarMep(),
      ])

      const totalCapital = loans.reduce(
        (s, l) => s + pesify(Number(l.capital), l.currency, mepRate),
        0
      )

      // Capital by person (pesified)
      const capitalByPerson = new Map<string, { name: string; capital: number; personId: string | null }>()
      for (const loan of loans) {
        const key = loan.personId || `unnamed_${loan.borrowerName}`
        const name = loan.person?.name || loan.borrowerName
        const existing = capitalByPerson.get(key) || { name, capital: 0, personId: loan.personId }
        existing.capital += pesify(Number(loan.capital), loan.currency, mepRate)
        capitalByPerson.set(key, existing)
      }

      // All exposures (not just top 3)
      const exposures = [...capitalByPerson.values()]
        .map((e) => ({
          ...e,
          percentage: totalCapital > 0 ? (e.capital / totalCapital) * 100 : 0,
        }))
        .sort((a, b) => b.capital - a.capital)

      // High risk capital
      const persons = await ctx.prisma.person.findMany({
        where: { userId: ctx.user.id },
      })

      const personScores = new Map<string, ReturnType<typeof calculatePersonScore>>()
      for (const p of persons) {
        personScores.set(p.id, calculatePersonScore(p))
      }

      let highRiskCapital = 0
      for (const loan of loans) {
        if (loan.personId) {
          const s = personScores.get(loan.personId)
          if (s && s.score < 4) highRiskCapital += pesify(Number(loan.capital), loan.currency, mepRate)
        }
      }

      // Overdue capital (>15 days)
      const now = new Date()
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
      let overdueCapital = 0
      for (const loan of loans) {
        for (const inst of loan.loanInstallments) {
          if (!inst.isPaid && new Date(inst.dueDate) < fifteenDaysAgo) {
            overdueCapital += pesify(Number(inst.amount), loan.currency, mepRate)
          }
        }
      }

      // Total expected value
      let totalEV = 0
      for (const loan of loans) {
        const defaultProb = loan.personId
          ? (personScores.get(loan.personId)?.defaultProbability ?? 0.18)
          : 0.18
        const totalInterest = loan.loanInstallments.reduce(
          (s, i) => s + pesify(Number(i.interest), loan.currency, mepRate),
          0
        )
        totalEV += calculateExpectedValue(
          pesify(Number(loan.capital), loan.currency, mepRate),
          totalInterest,
          defaultProb
        )
      }

      return {
        totalCapital,
        activeLoansCount: loans.length,
        overdueCapital,
        totalEV,
        exposures,
        highRiskCapital,
        highRiskPercentage: totalCapital > 0 ? (highRiskCapital / totalCapital) * 100 : 0,
        mepRate,
      }
    }),

  getConcentrationAlerts: protectedProcedure.query(async ({ ctx }) => {
    const [loans, mepRate] = await Promise.all([
      ctx.prisma.loan.findMany({
        where: { userId: ctx.user.id, status: 'active' },
        include: { person: true },
      }),
      getDolarMep(),
    ])

    const totalCapital = loans.reduce(
      (s, l) => s + pesify(Number(l.capital), l.currency, mepRate),
      0
    )
    if (totalCapital === 0) return []

    const capitalByPerson = new Map<string, { name: string; capital: number; personId: string | null }>()
    for (const loan of loans) {
      const key = loan.personId || `unnamed_${loan.borrowerName}`
      const name = loan.person?.name || loan.borrowerName
      const existing = capitalByPerson.get(key) || { name, capital: 0, personId: loan.personId }
      existing.capital += pesify(Number(loan.capital), loan.currency, mepRate)
      capitalByPerson.set(key, existing)
    }

    return [...capitalByPerson.values()]
      .map((e) => ({
        ...e,
        percentage: (e.capital / totalCapital) * 100,
      }))
      .filter((e) => e.percentage > 12)
      .sort((a, b) => b.percentage - a.percentage)
  }),

  getEvolutionData: protectedProcedure.query(async ({ ctx }) => {
    const [loans, mepRate] = await Promise.all([
      ctx.prisma.loan.findMany({
        where: { userId: ctx.user.id, status: 'active' },
        select: { capital: true, startDate: true, currency: true },
        orderBy: { startDate: 'asc' },
      }),
      getDolarMep(),
    ])

    const byMonth = new Map<string, number>()
    for (const loan of loans) {
      const key = `${loan.startDate.getFullYear()}-${String(loan.startDate.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) || 0) + pesify(Number(loan.capital), loan.currency, mepRate))
    }

    return [...byMonth.entries()]
      .map(([month, capital]) => ({ month, capital }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }),

  getRiskBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const [persons, mepRate] = await Promise.all([
      ctx.prisma.person.findMany({
        where: { userId: ctx.user.id },
        include: {
          loans: {
            where: { status: 'active' },
            select: { capital: true, currency: true },
          },
        },
      }),
      getDolarMep(),
    ])

    const breakdown = { bajo: 0, medio: 0, alto: 0, critico: 0 }
    const personsByCategory: {
      name: string
      score: number
      category: string
      capital: number
      id: string
    }[] = []

    for (const person of persons) {
      const scoreResult = calculatePersonScore(person)
      const capital = person.loans.reduce(
        (s, l) => s + pesify(Number(l.capital), l.currency, mepRate),
        0
      )
      breakdown[scoreResult.category] += capital
      personsByCategory.push({
        name: person.name,
        score: scoreResult.score,
        category: scoreResult.category,
        capital,
        id: person.id,
      })
    }

    return {
      breakdown,
      persons: personsByCategory.sort((a, b) => a.score - b.score),
    }
  }),
})
