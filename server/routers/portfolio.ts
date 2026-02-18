import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { calculatePersonScore, calculateExpectedValue } from '@/lib/loan-scoring'

export const portfolioRouter = router({
  getMetrics: protectedProcedure
    .input(z.object({ fciRate: z.number().min(0).default(0.40) }))
    .query(async ({ ctx, input }) => {
      const loans = await ctx.prisma.loan.findMany({
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
      })

      const totalCapital = loans.reduce((s, l) => s + Number(l.capital), 0)

      // Capital by person
      const capitalByPerson = new Map<string, { name: string; capital: number; personId: string | null }>()
      for (const loan of loans) {
        const key = loan.personId || `unnamed_${loan.borrowerName}`
        const name = loan.person?.name || loan.borrowerName
        const existing = capitalByPerson.get(key) || { name, capital: 0, personId: loan.personId }
        existing.capital += Number(loan.capital)
        capitalByPerson.set(key, existing)
      }

      // Top 3 exposures
      const exposures = [...capitalByPerson.values()]
        .map((e) => ({
          ...e,
          percentage: totalCapital > 0 ? (e.capital / totalCapital) * 100 : 0,
        }))
        .sort((a, b) => b.capital - a.capital)
        .slice(0, 3)

      // High risk capital (persons with score < 4)
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
          if (s && s.score < 4) highRiskCapital += Number(loan.capital)
        }
      }

      // Overdue capital (unpaid installments > 15 days past due)
      const now = new Date()
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
      let overdueCapital = 0
      for (const loan of loans) {
        for (const inst of loan.loanInstallments) {
          if (!inst.isPaid && new Date(inst.dueDate) < fifteenDaysAgo) {
            overdueCapital += Number(inst.amount)
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
          (s, i) => s + Number(i.interest),
          0
        )
        totalEV += calculateExpectedValue(
          Number(loan.capital),
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
      }
    }),

  getConcentrationAlerts: protectedProcedure.query(async ({ ctx }) => {
    const loans = await ctx.prisma.loan.findMany({
      where: { userId: ctx.user.id, status: 'active' },
      include: { person: true },
    })

    const totalCapital = loans.reduce((s, l) => s + Number(l.capital), 0)
    if (totalCapital === 0) return []

    const capitalByPerson = new Map<string, { name: string; capital: number; personId: string | null }>()
    for (const loan of loans) {
      const key = loan.personId || `unnamed_${loan.borrowerName}`
      const name = loan.person?.name || loan.borrowerName
      const existing = capitalByPerson.get(key) || { name, capital: 0, personId: loan.personId }
      existing.capital += Number(loan.capital)
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
    const loans = await ctx.prisma.loan.findMany({
      where: { userId: ctx.user.id, status: 'active' },
      select: { capital: true, startDate: true },
      orderBy: { startDate: 'asc' },
    })

    const byMonth = new Map<string, number>()
    for (const loan of loans) {
      const key = `${loan.startDate.getFullYear()}-${String(loan.startDate.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) || 0) + Number(loan.capital))
    }

    return [...byMonth.entries()]
      .map(([month, capital]) => ({ month, capital }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }),

  getRiskBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const persons = await ctx.prisma.person.findMany({
      where: { userId: ctx.user.id },
      include: {
        loans: {
          where: { status: 'active' },
          select: { capital: true },
        },
      },
    })

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
      const capital = person.loans.reduce((s, l) => s + Number(l.capital), 0)
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
