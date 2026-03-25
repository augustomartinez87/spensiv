import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { calculatePersonScore, calculateExpectedValue } from '@/lib/loan-scoring'
import { getDolarMep, pesify } from '@/lib/dolar'
import { calculateIRR, monthlyToAnnualRate } from '@/lib/loan-calculator'
import { formatPeriod } from '@/lib/periods'

export const portfolioRouter = router({
  getMetrics: protectedProcedure
    .input(z.object({ fciRate: z.number().min(0).default(0.40) }))
    .query(async ({ ctx, input }) => {
      const [loans, mepRate] = await Promise.all([
        ctx.prisma.loan.findMany({
          where: { userId: ctx.user.id, status: 'active', direction: 'lender' },
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

      // Top 1 / Top 3 concentration
      const top1Percentage = exposures.length > 0 ? exposures[0].percentage : 0
      const top3Percentage = exposures.slice(0, 3).reduce((s, e) => s + e.percentage, 0)

      // High risk capital — only fetch persons referenced by active loans
      const personIds = [...new Set(loans.map((l) => l.personId).filter(Boolean))] as string[]
      const persons = personIds.length > 0
        ? await ctx.prisma.person.findMany({
            where: { id: { in: personIds } },
          })
        : []

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
        top1Percentage,
        top3Percentage,
        highRiskCapital,
        highRiskPercentage: totalCapital > 0 ? (highRiskCapital / totalCapital) * 100 : 0,
        mepRate,
      }
    }),

  getYieldMetrics: protectedProcedure
    .input(z.object({ fciRate: z.number().min(0).default(0.40) }))
    .query(async ({ ctx, input }) => {
      const [loans, mepRate] = await Promise.all([
        ctx.prisma.loan.findMany({
          where: { userId: ctx.user.id, status: 'active', direction: 'lender' },
          include: {
            loanInstallments: {
              select: {
                amount: true,
                interest: true,
                principal: true,
                isPaid: true,
                dueDate: true,
                number: true,
              },
              orderBy: { number: 'asc' },
            },
          },
        }),
        getDolarMep(),
      ])

      if (loans.length === 0) {
        return {
          weightedYield: 0,
          spread: 0,
          interestCollected: 0,
          interestProjected: 0,
          interestRatio: 0,
          weightedDuration: 0,
          activeLoansCount: 0,
        }
      }

      let totalWeightedIRR = 0
      let totalWeightForIRR = 0
      let totalWeightedDuration = 0
      let totalWeightForDuration = 0
      let interestCollected = 0
      let interestProjected = 0

      for (const loan of loans) {
        const capital = pesify(Number(loan.capital), loan.currency, mepRate)
        if (!Number.isFinite(capital) || capital <= 0) {
          continue
        }
        const installments = loan.loanInstallments

        // Interest collected vs projected
        for (const inst of installments) {
          const intArs = pesify(Number(inst.interest), loan.currency, mepRate)
          if (!Number.isFinite(intArs)) continue
          interestProjected += intArs
          if (inst.isPaid) interestCollected += intArs
        }

        // IRR: cash flows = [-capital, payment1, payment2, ...]
        // Use actual paid amounts for past, scheduled for future
        const cashFlows = [-capital]
        for (const inst of installments) {
          const payment = pesify(Number(inst.amount), loan.currency, mepRate)
          if (Number.isFinite(payment)) cashFlows.push(payment)
        }

        if (cashFlows.length > 1) {
          const hasPositive = cashFlows.some((value) => value > 0)
          const hasNegative = cashFlows.some((value) => value < 0)
          if (hasPositive && hasNegative) {
            try {
              const monthlyIRR = calculateIRR(cashFlows)
              if (isFinite(monthlyIRR) && monthlyIRR > -1) {
                const annualIRR = monthlyToAnnualRate(monthlyIRR)
                totalWeightedIRR += annualIRR * capital
                totalWeightForIRR += capital
              }
            } catch {
              // Skip loans with non-solvable IRR instead of failing the entire endpoint.
            }
          }
        }

        // Weighted duration (term in months)
        const termMonths = installments.length
        totalWeightedDuration += termMonths * capital
        totalWeightForDuration += capital
      }

      const weightedYield = totalWeightForIRR > 0 ? totalWeightedIRR / totalWeightForIRR : 0
      const spread = weightedYield - input.fciRate
      const weightedDuration = totalWeightForDuration > 0 ? totalWeightedDuration / totalWeightForDuration : 0

      return {
        weightedYield,
        spread,
        interestCollected,
        interestProjected,
        interestRatio: interestProjected > 0 ? interestCollected / interestProjected : 0,
        weightedDuration,
        activeLoansCount: loans.length,
      }
    }),

  getCashFlowProjection: protectedProcedure.query(async ({ ctx }) => {
    const [loans, mepRate] = await Promise.all([
      ctx.prisma.loan.findMany({
        where: { userId: ctx.user.id, status: 'active' },
        include: {
          loanInstallments: {
            where: { isPaid: false },
            select: {
              amount: true,
              interest: true,
              principal: true,
              dueDate: true,
            },
          },
        },
      }),
      getDolarMep(),
    ])

    const byMonth = new Map<string, { principal: number; interest: number }>()

    // Generate next 12 months as keys
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = formatPeriod(d)
      byMonth.set(key, { principal: 0, interest: 0 })
    }

    for (const loan of loans) {
      for (const inst of loan.loanInstallments) {
        const due = new Date(inst.dueDate)
        const key = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`
        const bucket = byMonth.get(key)
        if (bucket) {
          bucket.principal += pesify(Number(inst.principal), loan.currency, mepRate)
          bucket.interest += pesify(Number(inst.interest), loan.currency, mepRate)
        }
      }
    }

    return [...byMonth.entries()]
      .map(([month, data]) => ({
        month,
        principal: data.principal,
        interest: data.interest,
        total: data.principal + data.interest,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
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
      .map((e) => {
        const percentage = (e.capital / totalCapital) * 100
        return {
          ...e,
          percentage,
          severity: percentage > 30 ? 'critical' as const : 'warning' as const,
        }
      })
      .filter((e) => e.percentage >= 20)
      .sort((a, b) => b.percentage - a.percentage)
  }),

  getRiskBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const [persons, mepRate] = await Promise.all([
      ctx.prisma.person.findMany({
        where: { userId: ctx.user.id },
        include: {
          loans: {
            where: { status: 'active', direction: 'lender' },
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
