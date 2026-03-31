import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { calculatePersonScore, calculateExpectedValue } from '@/lib/loan-scoring'
import { getDolarMep, pesify } from '@/lib/dolar'
import { calculateIRR, monthlyToAnnualRate } from '@/lib/loan-calculator'
import { formatPeriod } from '@/lib/periods'
import type { PrismaClient } from '@prisma/client'

// ── Shared data loader ───────────────────────────────────────────────

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

type PortfolioLoans = Awaited<ReturnType<typeof loadPortfolioData>>['loans']
type PortfolioPersons = Awaited<ReturnType<typeof loadPortfolioData>>['persons']

// ── Shared helpers ───────────────────────────────────────────────────

/** Pesified capital per loan, computed once and cached by loan index */
function buildCapitalCache(loans: PortfolioLoans, mepRate: number) {
  return loans.map((l) => pesify(Number(l.capital), l.currency, mepRate))
}

/** Group pesified capital by person */
function buildCapitalByPerson(
  loans: PortfolioLoans,
  capitalCache: number[],
) {
  const map = new Map<string, { name: string; capital: number; personId: string | null }>()
  for (let i = 0; i < loans.length; i++) {
    const loan = loans[i]
    const key = loan.personId || `unnamed_${loan.borrowerName}`
    const name = loan.person?.name || loan.borrowerName
    const existing = map.get(key) || { name, capital: 0, personId: loan.personId }
    existing.capital += capitalCache[i]
    map.set(key, existing)
  }
  return map
}

// ── Pure computation functions ────────────────────────────────────────

function computeMetrics(
  lenderLoans: PortfolioLoans,
  capitalCache: number[],
  persons: PortfolioPersons,
  personScores: Map<string, ReturnType<typeof calculatePersonScore>>,
  mepRate: number,
) {
  const totalCapital = capitalCache.reduce((s, c) => s + c, 0)
  const capitalByPerson = buildCapitalByPerson(lenderLoans, capitalCache)

  const exposures = [...capitalByPerson.values()]
    .map((e) => ({
      ...e,
      percentage: totalCapital > 0 ? (e.capital / totalCapital) * 100 : 0,
    }))
    .sort((a, b) => b.capital - a.capital)

  const top1Percentage = exposures[0]?.percentage ?? 0
  const top3Percentage = exposures.slice(0, 3).reduce((s, e) => s + e.percentage, 0)

  let highRiskCapital = 0
  for (let i = 0; i < lenderLoans.length; i++) {
    const loan = lenderLoans[i]
    if (loan.personId) {
      const s = personScores.get(loan.personId)
      if (s && s.score < 4) highRiskCapital += capitalCache[i]
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

  let totalEV = 0
  for (let i = 0; i < lenderLoans.length; i++) {
    const loan = lenderLoans[i]
    const defaultProb = loan.personId
      ? (personScores.get(loan.personId)?.defaultProbability ?? 0.18)
      : 0.18
    const totalInterest = loan.loanInstallments.reduce(
      (s, inst) => s + pesify(Number(inst.interest), loan.currency, mepRate),
      0,
    )
    totalEV += calculateExpectedValue(capitalCache[i], totalInterest, defaultProb)
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
  lenderLoans: PortfolioLoans,
  capitalCache: number[],
  mepRate: number,
) {
  if (lenderLoans.length === 0) {
    return {
      weightedTEM: 0,
      monthlyIncomeExpected: 0,
      weightedIRR: 0,
      amortizedLoansCount: 0,
      interestCollected: 0,
      interestProjected: 0,
      interestRatio: 0,
      weightedDuration: 0,
      activeLoansCount: 0,
    }
  }

  // TEM ponderada: Σ(capital × monthlyRate) / Σ(capital) — todos los préstamos con tasa
  let totalWeightedTEM = 0
  let totalCapitalForTEM = 0

  // TIR ponderada: solo préstamos amortizados con flujos definidos
  let totalWeightedIRR = 0
  let totalWeightForIRR = 0
  let amortizedLoansCount = 0
  let totalWeightedDuration = 0
  let totalWeightForDuration = 0

  let interestCollected = 0
  let interestProjected = 0

  for (let i = 0; i < lenderLoans.length; i++) {
    const loan = lenderLoans[i]
    const capital = capitalCache[i]
    if (!Number.isFinite(capital) || capital <= 0) continue

    const monthlyRate = Number(loan.monthlyRate)
    const installments = loan.loanInstallments

    // TEM ponderada — todos los préstamos con tasa > 0
    if (monthlyRate > 0) {
      totalWeightedTEM += monthlyRate * capital
      totalCapitalForTEM += capital
    }

    // Interés cobrado/proyectado desde cuotas
    for (const inst of installments) {
      const intArs = pesify(Number(inst.interest), loan.currency, mepRate)
      if (!Number.isFinite(intArs)) continue
      interestProjected += intArs
      if (inst.isPaid) interestCollected += intArs
    }

    // TIR solo para préstamos amortizados con cuotas definidas
    if (loan.loanType === 'amortized' && installments.length > 0) {
      const cashFlows = [-capital]
      for (const inst of installments) {
        const payment = pesify(Number(inst.amount), loan.currency, mepRate)
        if (Number.isFinite(payment)) cashFlows.push(payment)
      }

      if (cashFlows.length > 1) {
        const hasPositive = cashFlows.some((v) => v > 0)
        const hasNegative = cashFlows.some((v) => v < 0)
        if (hasPositive && hasNegative) {
          try {
            const monthlyIRR = calculateIRR(cashFlows)
            if (isFinite(monthlyIRR) && monthlyIRR > -1) {
              const annualIRR = monthlyToAnnualRate(monthlyIRR)
              totalWeightedIRR += annualIRR * capital
              totalWeightForIRR += capital
              amortizedLoansCount++
            }
          } catch {
            // Skip loans with non-solvable IRR
          }
        }
      }

      totalWeightedDuration += installments.length * capital
      totalWeightForDuration += capital
    }
  }

  return {
    // TEM ponderada por capital (todos los préstamos)
    weightedTEM: totalCapitalForTEM > 0 ? totalWeightedTEM / totalCapitalForTEM : 0,
    // Ingreso mensual esperado = Σ(capital × TEM) — en ARS
    monthlyIncomeExpected: totalWeightedTEM,
    // TIR ponderada (solo amortizados con cuotas)
    weightedIRR: totalWeightForIRR > 0 ? totalWeightedIRR / totalWeightForIRR : 0,
    amortizedLoansCount,
    interestCollected,
    interestProjected,
    interestRatio: interestProjected > 0 ? interestCollected / interestProjected : 0,
    weightedDuration: totalWeightForDuration > 0 ? totalWeightedDuration / totalWeightForDuration : 0,
    activeLoansCount: lenderLoans.length,
  }
}

function computeCashFlowProjection(
  lenderLoans: PortfolioLoans,
  mepRate: number,
) {
  const byMonth = new Map<string, { principal: number; interest: number }>()

  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    byMonth.set(formatPeriod(d), { principal: 0, interest: 0 })
  }

  for (const loan of lenderLoans) {
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
  lenderLoans: PortfolioLoans,
  capitalCache: number[],
) {
  const totalCapital = capitalCache.reduce((s, c) => s + c, 0)
  if (totalCapital === 0) return []

  const capitalByPerson = buildCapitalByPerson(lenderLoans, capitalCache)

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
  persons: PortfolioPersons,
  personScores: Map<string, ReturnType<typeof calculatePersonScore>>,
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
    const scoreResult = personScores.get(person.id) ?? calculatePersonScore(person)
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
  getFullPortfolio: protectedProcedure
    .query(async ({ ctx }) => {
      const { loans, persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)

      const lenderLoans = loans.filter((l) => l.direction === 'lender')
      const capitalCache = buildCapitalCache(lenderLoans, mepRate)

      const personIds = new Set(lenderLoans.map((l) => l.personId).filter(Boolean))
      const personScores = new Map<string, ReturnType<typeof calculatePersonScore>>()
      for (const p of persons) {
        if (personIds.has(p.id)) {
          personScores.set(p.id, calculatePersonScore(p))
        }
      }

      return {
        metrics: computeMetrics(lenderLoans, capitalCache, persons, personScores, mepRate),
        yieldMetrics: computeYieldMetrics(lenderLoans, capitalCache, mepRate),
        cashFlow: computeCashFlowProjection(lenderLoans, mepRate),
        alerts: computeConcentrationAlerts(lenderLoans, capitalCache),
        riskBreakdown: computeRiskBreakdown(persons, personScores, mepRate),
      }
    }),

  getMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      const { loans, persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
      const lenderLoans = loans.filter((l) => l.direction === 'lender')
      const capitalCache = buildCapitalCache(lenderLoans, mepRate)
      const personIds = new Set(lenderLoans.map((l) => l.personId).filter(Boolean))
      const personScores = new Map<string, ReturnType<typeof calculatePersonScore>>()
      for (const p of persons) {
        if (personIds.has(p.id)) personScores.set(p.id, calculatePersonScore(p))
      }
      return computeMetrics(lenderLoans, capitalCache, persons, personScores, mepRate)
    }),

  getYieldMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      const { loans, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
      const lenderLoans = loans.filter((l) => l.direction === 'lender')
      const capitalCache = buildCapitalCache(lenderLoans, mepRate)
      return computeYieldMetrics(lenderLoans, capitalCache, mepRate)
    }),

  getCashFlowProjection: protectedProcedure.query(async ({ ctx }) => {
    const { loans, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
    const lenderLoans = loans.filter((l) => l.direction === 'lender')
    return computeCashFlowProjection(lenderLoans, mepRate)
  }),

  getConcentrationAlerts: protectedProcedure.query(async ({ ctx }) => {
    const { loans, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
    const lenderLoans = loans.filter((l) => l.direction === 'lender')
    const capitalCache = buildCapitalCache(lenderLoans, mepRate)
    return computeConcentrationAlerts(lenderLoans, capitalCache)
  }),

  getRiskBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const { persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
    const personScores = new Map<string, ReturnType<typeof calculatePersonScore>>()
    for (const p of persons) personScores.set(p.id, calculatePersonScore(p))
    return computeRiskBreakdown(persons, personScores, mepRate)
  }),
})
