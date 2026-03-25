import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { calculatePersonScore, calculateExpectedValue } from '@/lib/loan-scoring'
import { getDolarMep, pesify } from '@/lib/dolar'
import { calculateIRR, monthlyToAnnualRate } from '@/lib/loan-calculator'
import { formatPeriod } from '@/lib/periods'
import type { PrismaClient } from '@prisma/client'

// ── Shared data loader (single DB roundtrip) ─────────────────────────

async function loadPortfolioData(prisma: PrismaClient, userId: string) {
  const [loans, persons, mepRate] = await Promise.all([
    prisma.loan.findMany({
      where: { userId, status: 'active' },
      include: {
        person: true,
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
    prisma.person.findMany({
      where: { userId },
      include: {
        loans: {
          where: { status: 'active', direction: 'lender' },
          select: { capital: true, currency: true },
        },
      },
    }),
    getDolarMep(),
  ])

  return { loans, persons, mepRate }
}

// ── Pure computation functions ────────────────────────────────────────

function computeMetrics(
  loans: Awaited<ReturnType<typeof loadPortfolioData>>['loans'],
  persons: Awaited<ReturnType<typeof loadPortfolioData>>['persons'],
  mepRate: number,
  fciRate: number,
) {
  const lenderLoans = loans.filter((l) => l.direction === 'lender')

  const totalCapital = lenderLoans.reduce(
    (s, l) => s + pesify(Number(l.capital), l.currency, mepRate),
    0,
  )

  // Capital by person (pesified)
  const capitalByPerson = new Map<string, { name: string; capital: number; personId: string | null }>()
  for (const loan of lenderLoans) {
    const key = loan.personId || `unnamed_${loan.borrowerName}`
    const name = loan.person?.name || loan.borrowerName
    const existing = capitalByPerson.get(key) || { name, capital: 0, personId: loan.personId }
    existing.capital += pesify(Number(loan.capital), loan.currency, mepRate)
    capitalByPerson.set(key, existing)
  }

  const exposures = [...capitalByPerson.values()]
    .map((e) => ({
      ...e,
      percentage: totalCapital > 0 ? (e.capital / totalCapital) * 100 : 0,
    }))
    .sort((a, b) => b.capital - a.capital)

  const top1Percentage = exposures[0]?.percentage ?? 0
  const top3Percentage = exposures.slice(0, 3).reduce((s, e) => s + e.percentage, 0)

  // High risk capital — only score persons with active loans
  const personIds = new Set(lenderLoans.map((l) => l.personId).filter(Boolean))
  const relevantPersons = persons.filter((p) => personIds.has(p.id))

  const personScores = new Map<string, ReturnType<typeof calculatePersonScore>>()
  for (const p of relevantPersons) {
    personScores.set(p.id, calculatePersonScore(p))
  }

  let highRiskCapital = 0
  for (const loan of lenderLoans) {
    if (loan.personId) {
      const s = personScores.get(loan.personId)
      if (s && s.score < 4) highRiskCapital += pesify(Number(loan.capital), loan.currency, mepRate)
    }
  }

  // Overdue capital (>15 days)
  const now = new Date()
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
  let overdueCapital = 0
  for (const loan of lenderLoans) {
    for (const inst of loan.loanInstallments) {
      if (!inst.isPaid && new Date(inst.dueDate) < fifteenDaysAgo) {
        overdueCapital += pesify(Number(inst.amount), loan.currency, mepRate)
      }
    }
  }

  // Total expected value
  let totalEV = 0
  for (const loan of lenderLoans) {
    const defaultProb = loan.personId
      ? (personScores.get(loan.personId)?.defaultProbability ?? 0.18)
      : 0.18
    const totalInterest = loan.loanInstallments.reduce(
      (s, i) => s + pesify(Number(i.interest), loan.currency, mepRate),
      0,
    )
    totalEV += calculateExpectedValue(
      pesify(Number(loan.capital), loan.currency, mepRate),
      totalInterest,
      defaultProb,
    )
  }

  return {
    totalCapital,
    activeLoansCount: lenderLoans.length,
    overdueCapital,
    totalEV,
    exposures,
    top1Percentage,
    top3Percentage,
    highRiskCapital,
    highRiskPercentage: totalCapital > 0 ? (highRiskCapital / totalCapital) * 100 : 0,
    mepRate,
  }
}

function computeYieldMetrics(
  loans: Awaited<ReturnType<typeof loadPortfolioData>>['loans'],
  mepRate: number,
  fciRate: number,
) {
  const lenderLoans = loans.filter((l) => l.direction === 'lender')

  if (lenderLoans.length === 0) {
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

  for (const loan of lenderLoans) {
    const capital = pesify(Number(loan.capital), loan.currency, mepRate)
    if (!Number.isFinite(capital) || capital <= 0) continue
    const installments = loan.loanInstallments

    for (const inst of installments) {
      const intArs = pesify(Number(inst.interest), loan.currency, mepRate)
      if (!Number.isFinite(intArs)) continue
      interestProjected += intArs
      if (inst.isPaid) interestCollected += intArs
    }

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
          // Skip loans with non-solvable IRR
        }
      }
    }

    const termMonths = installments.length
    totalWeightedDuration += termMonths * capital
    totalWeightForDuration += capital
  }

  const weightedYield = totalWeightForIRR > 0 ? totalWeightedIRR / totalWeightForIRR : 0
  return {
    weightedYield,
    spread: weightedYield - fciRate,
    interestCollected,
    interestProjected,
    interestRatio: interestProjected > 0 ? interestCollected / interestProjected : 0,
    weightedDuration: totalWeightForDuration > 0 ? totalWeightedDuration / totalWeightForDuration : 0,
    activeLoansCount: lenderLoans.length,
  }
}

function computeCashFlowProjection(
  loans: Awaited<ReturnType<typeof loadPortfolioData>>['loans'],
  mepRate: number,
) {
  const byMonth = new Map<string, { principal: number; interest: number }>()

  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    byMonth.set(formatPeriod(d), { principal: 0, interest: 0 })
  }

  for (const loan of loans) {
    for (const inst of loan.loanInstallments) {
      if (inst.isPaid) continue
      const due = new Date(inst.dueDate)
      const key = formatPeriod(due)
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
}

function computeConcentrationAlerts(
  loans: Awaited<ReturnType<typeof loadPortfolioData>>['loans'],
  mepRate: number,
) {
  const totalCapital = loans.reduce(
    (s, l) => s + pesify(Number(l.capital), l.currency, mepRate),
    0,
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
}

function computeRiskBreakdown(
  persons: Awaited<ReturnType<typeof loadPortfolioData>>['persons'],
  mepRate: number,
) {
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
      0,
    )
    if (capital === 0) continue
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
}

// ── Router ────────────────────────────────────────────────────────────

export const portfolioRouter = router({
  /**
   * Consolidated endpoint: loads all portfolio data in a single DB roundtrip.
   * Replaces 5 separate queries (getMetrics + getYieldMetrics + getCashFlowProjection
   * + getConcentrationAlerts + getRiskBreakdown) with 1 loan query + 1 person query.
   */
  getFullPortfolio: protectedProcedure
    .input(z.object({ fciRate: z.number().min(0).default(0.40) }))
    .query(async ({ ctx, input }) => {
      const { loans, persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)

      return {
        metrics: computeMetrics(loans, persons, mepRate, input.fciRate),
        yieldMetrics: computeYieldMetrics(loans, mepRate, input.fciRate),
        cashFlow: computeCashFlowProjection(loans, mepRate),
        alerts: computeConcentrationAlerts(loans, mepRate),
        riskBreakdown: computeRiskBreakdown(persons, mepRate),
      }
    }),

  // Keep individual endpoints for backward compatibility / selective use
  getMetrics: protectedProcedure
    .input(z.object({ fciRate: z.number().min(0).default(0.40) }))
    .query(async ({ ctx, input }) => {
      const { loans, persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
      return computeMetrics(loans, persons, mepRate, input.fciRate)
    }),

  getYieldMetrics: protectedProcedure
    .input(z.object({ fciRate: z.number().min(0).default(0.40) }))
    .query(async ({ ctx, input }) => {
      const { loans, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
      return computeYieldMetrics(loans, mepRate, input.fciRate)
    }),

  getCashFlowProjection: protectedProcedure.query(async ({ ctx }) => {
    const { loans, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
    return computeCashFlowProjection(loans, mepRate)
  }),

  getConcentrationAlerts: protectedProcedure.query(async ({ ctx }) => {
    const { loans, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
    return computeConcentrationAlerts(loans, mepRate)
  }),

  getRiskBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const { persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
    return computeRiskBreakdown(persons, mepRate)
  }),
})
