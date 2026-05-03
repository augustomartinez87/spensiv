import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { calculatePersonScore, calculateExpectedValue } from '@/lib/loan-scoring'
import { getDolarMep, pesify } from '@/lib/dolar'
import { calculateIRR, monthlyToAnnualRate } from '@/lib/loan-calculator'
import { formatPeriod } from '@/lib/periods'
import {
  calculatePersonRiskLimits,
  runStressTest,
  calculateBreakevenTNA,
  type PersonExposure,
} from '@/lib/risk-engine'
import type { PrismaClient } from '@prisma/client'

// ── Shared data loader ───────────────────────────────────────────────

async function loadPortfolioData(prisma: PrismaClient, userId: string) {
  const [loans, persons, mepRate] = await Promise.all([
    prisma.loan.findMany({
      where: { userId, status: { in: ['active', 'defaulted'] } },
      include: {
        person: true,
        loanInstallments: {
          select: {
            amount: true,
            paidAmount: true,
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

  return { loans, persons, mepRate: mepRate ?? 0 }
}

type PortfolioLoans = Awaited<ReturnType<typeof loadPortfolioData>>['loans']
type PortfolioPersons = Awaited<ReturnType<typeof loadPortfolioData>>['persons']

// ── Shared helpers ───────────────────────────────────────────────────

/** Pesified capital per loan, computed once and cached by loan index */
function buildCapitalCache(loans: PortfolioLoans, mepRate: number | null) {
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
  // Capital "total" = capital activo (no incluye incobrables). Los incobrables
  // se reportan aparte como `defaultedCapital`. La distribución por deudor,
  // top1/top3 y alertas de concentración se calculan sobre la cartera viva.
  const activeLoanIndices: number[] = []
  let totalCapital = 0
  let defaultedCapital = 0
  let defaultedLoansCount = 0
  for (let i = 0; i < lenderLoans.length; i++) {
    if (lenderLoans[i].status === 'defaulted') {
      defaultedCapital += capitalCache[i]
      defaultedLoansCount++
    } else {
      totalCapital += capitalCache[i]
      activeLoanIndices.push(i)
    }
  }
  const activeLoans = activeLoanIndices.map((i) => lenderLoans[i])
  const activeCapitalCache = activeLoanIndices.map((i) => capitalCache[i])
  const capitalByPerson = buildCapitalByPerson(activeLoans, activeCapitalCache)

  const exposures = [...capitalByPerson.values()]
    .map((e) => ({
      ...e,
      percentage: totalCapital > 0 ? (e.capital / totalCapital) * 100 : 0,
    }))
    .sort((a, b) => b.capital - a.capital)

  const top1Percentage = exposures[0]?.percentage ?? 0
  const top3Percentage = exposures.slice(0, 3).reduce((s, e) => s + e.percentage, 0)

  let highRiskCapital = 0
  for (const i of activeLoanIndices) {
    const loan = lenderLoans[i]
    if (loan.personId) {
      const s = personScores.get(loan.personId)
      if (s && s.score < 4) highRiskCapital += capitalCache[i]
    }
  }

  // Mora: solo de préstamos activos. Los defaulted ya son pérdida realizada,
  // no "cuotas vencidas pendientes de cobro".
  const now = new Date()
  let overdueCapital = 0
  for (const loan of lenderLoans) {
    if (loan.status === 'defaulted') continue
    for (const inst of loan.loanInstallments) {
      if (!inst.isPaid && new Date(inst.dueDate) < now) {
        const remaining = Math.max(Number(inst.amount) - Number(inst.paidAmount ?? 0), 0)
        overdueCapital += pesify(remaining, loan.currency, mepRate)
      }
    }
  }

  // Valor esperado: para defaulted la probabilidad de default es 1 (ya ocurrió),
  // así que su EV se reduce a lo ya cobrado. Para activos, modelo de scoring.
  let totalEV = 0
  for (let i = 0; i < lenderLoans.length; i++) {
    const loan = lenderLoans[i]
    if (loan.status === 'defaulted') {
      let collectedSoFar = 0
      for (const inst of loan.loanInstallments) {
        const paid = Math.min(Number(inst.paidAmount ?? 0), Number(inst.amount))
        collectedSoFar += pesify(paid, loan.currency, mepRate)
      }
      totalEV += collectedSoFar
      continue
    }
    const defaultProb = loan.personId
      ? (personScores.get(loan.personId)?.defaultProbability ?? 0.18)
      : 0.18
    const totalInterest = loan.loanInstallments.reduce(
      (s, inst) => s + pesify(Number(inst.interest), loan.currency, mepRate),
      0,
    )
    totalEV += calculateExpectedValue(capitalCache[i], totalInterest, defaultProb)
  }

  // Porcentaje de incobrables sobre el capital desplegado (activo + perdido),
  // que es el universo relevante para "qué fracción de mis préstamos defaulteó".
  const deployedCapital = totalCapital + defaultedCapital
  return {
    totalCapital,
    activeLoansCount: lenderLoans.length - defaultedLoansCount,
    overdueCapital,
    totalEV,
    exposures,
    top1Percentage,
    top3Percentage,
    highRiskCapital,
    highRiskPercentage: totalCapital > 0 ? (highRiskCapital / totalCapital) * 100 : 0,
    defaultedCapital,
    defaultedLoansCount,
    defaultedPercentage: deployedCapital > 0 ? (defaultedCapital / deployedCapital) * 100 : 0,
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
      netRealizedTEM: 0,
      monthlyIncomeExpected: 0,
      weightedIRR: 0,
      amortizedLoansCount: 0,
      interestCollected: 0,
      interestProjected: 0,
      interestRatio: 0,
      weightedDuration: 0,
      activeLoansCount: 0,
      realizedLosses: { capitalLost: 0, interestLost: 0, capitalMonths: 0 },
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

  // Para TEM neta de pérdidas realizadas
  let realizedCapitalLost = 0
  let realizedInterestLost = 0
  // Capital · meses desplegado (denominador del rendimiento mensualizado).
  // Se acumula sobre toda la vida de cada préstamo, incluidos los incobrables
  // (porque su capital estuvo a riesgo durante ese tiempo).
  let totalCapitalMonths = 0
  const now = new Date()

  for (let i = 0; i < lenderLoans.length; i++) {
    const loan = lenderLoans[i]
    const capital = capitalCache[i]
    if (!Number.isFinite(capital) || capital <= 0) continue

    const monthlyRate = Number(loan.monthlyRate)
    const installments = loan.loanInstallments
    const isDefaulted = loan.status === 'defaulted'

    // Meses transcurridos desde el inicio del préstamo (mínimo 1 para no
    // dividir por cero en préstamos recientes).
    const startDate = new Date(loan.startDate)
    const monthsElapsed = Math.max(
      1,
      (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
    )
    totalCapitalMonths += capital * monthsElapsed

    // TEM ponderada — préstamos defaulted contribuyen con tasa efectiva 0
    // (su capital sigue ocupando lugar en la cartera pero ya no rinde).
    if (monthlyRate > 0) {
      totalWeightedTEM += (isDefaulted ? 0 : monthlyRate) * capital
      totalCapitalForTEM += capital
    }

    // Interés cobrado: cuotas pagas de cualquier estado.
    // Interés proyectado: para defaulted, solo lo ya cobrado (no proyectamos
    // cuotas pendientes que no se van a cobrar).
    // Pérdida realizada: capital incobrable + interés contractual no cobrado.
    for (const inst of installments) {
      const intArs = pesify(Number(inst.interest), loan.currency, mepRate)
      if (!Number.isFinite(intArs)) continue
      if (inst.isPaid) {
        interestCollected += intArs
        interestProjected += intArs
      } else if (!isDefaulted) {
        interestProjected += intArs
      } else {
        // Defaulted + cuota impaga: interés que el contrato esperaba pero
        // no va a entrar. Cuenta como pérdida realizada de ingreso.
        const paid = pesify(Number(inst.paidAmount ?? 0), loan.currency, mepRate)
        realizedInterestLost += Math.max(intArs - paid, 0)
      }
    }

    if (isDefaulted) {
      realizedCapitalLost += pesify(Number(loan.principalOutstanding), loan.currency, mepRate)
    }

    // TIR solo para préstamos amortizados con cuotas definidas
    if (loan.loanType === 'amortized' && installments.length > 0) {

      // Para préstamos incobrables: TIR realizada (solo flujos efectivamente cobrados).
      // Para préstamos activos: TIR contractual (todas las cuotas como si fueran a pagarse).
      const cashFlows = [-capital]
      if (isDefaulted) {
        for (const inst of installments) {
          const collected = pesify(Number(inst.paidAmount ?? 0), loan.currency, mepRate)
          if (Number.isFinite(collected) && collected > 0) cashFlows.push(collected)
        }
      } else {
        for (const inst of installments) {
          const payment = pesify(Number(inst.amount), loan.currency, mepRate)
          if (Number.isFinite(payment)) cashFlows.push(payment)
        }
      }

      // Caso especial: préstamo incobrable sin un solo cobro → pérdida total = -100%.
      // No es resoluble por el IRR (faltan flujos positivos), lo registramos directo.
      if (isDefaulted && cashFlows.length === 1) {
        totalWeightedIRR += -1 * capital
        totalWeightForIRR += capital
        amortizedLoansCount++
      } else if (cashFlows.length > 1) {
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

      // Duración solo de préstamos activos productivos
      if (!isDefaulted) {
        totalWeightedDuration += installments.length * capital
        totalWeightForDuration += capital
      }
    }
  }

  const activeLoansOnly = lenderLoans.filter((l) => l.status !== 'defaulted').length

  // TEM neta de pérdidas realizadas:
  //   (interés cobrado − capital perdido − interés perdido) / (Σ capital × meses)
  // Comparable directamente con el TEM de un FCI: refleja el rendimiento real
  // ya descontadas las pérdidas por incobrabilidad.
  const netRealizedNumerator = interestCollected - realizedCapitalLost - realizedInterestLost
  const netRealizedTEM = totalCapitalMonths > 0 ? netRealizedNumerator / totalCapitalMonths : 0

  return {
    // TEM ponderada por capital. Los préstamos defaulted contribuyen
    // con tasa 0 — siguen pesando en el denominador como capital "muerto".
    weightedTEM: totalCapitalForTEM > 0 ? totalWeightedTEM / totalCapitalForTEM : 0,
    netRealizedTEM,
    // Ingreso mensual esperado en ARS — excluye préstamos incobrables.
    monthlyIncomeExpected: totalWeightedTEM,
    // TIR ponderada (solo amortizados con cuotas)
    weightedIRR: totalWeightForIRR > 0 ? totalWeightedIRR / totalWeightForIRR : 0,
    amortizedLoansCount,
    interestCollected,
    interestProjected,
    interestRatio: interestProjected > 0 ? interestCollected / interestProjected : 0,
    weightedDuration: totalWeightForDuration > 0 ? totalWeightedDuration / totalWeightForDuration : 0,
    activeLoansCount: activeLoansOnly,
    realizedLosses: {
      capitalLost: realizedCapitalLost,
      interestLost: realizedInterestLost,
      capitalMonths: totalCapitalMonths,
    },
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
    // Préstamos incobrables no proyectan flujos futuros — ya no se esperan cobros.
    if (loan.status === 'defaulted') continue
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
  // Concentración sobre cartera viva: los incobrables ya son pérdida realizada
  // y no representan un "riesgo de concentración" futuro.
  const activeIdx: number[] = []
  for (let i = 0; i < lenderLoans.length; i++) {
    if (lenderLoans[i].status !== 'defaulted') activeIdx.push(i)
  }
  const activeLoans = activeIdx.map((i) => lenderLoans[i])
  const activeCache = activeIdx.map((i) => capitalCache[i])
  const totalCapital = activeCache.reduce((s, c) => s + c, 0)
  if (totalCapital === 0) return []

  const capitalByPerson = buildCapitalByPerson(activeLoans, activeCache)

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

  getRiskAnalysis: protectedProcedure.query(async ({ ctx }) => {
    const { loans, persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
    // Análisis de riesgo es sobre cartera viva: los incobrables ya son
    // pérdida realizada, no aportan a "qué pasa si X defaultea".
    const lenderLoans = loans.filter((l) => l.direction === 'lender' && l.status !== 'defaulted')
    const capitalCache = buildCapitalCache(lenderLoans, mepRate)
    const totalCapital = capitalCache.reduce((s, c) => s + c, 0)

    // Build person scores
    const personScores = new Map<string, ReturnType<typeof calculatePersonScore>>()
    for (const p of persons) personScores.set(p.id, calculatePersonScore(p))

    // Build per-person capital (pesified) — solo sobre préstamos activos
    const personCapital = new Map<string, number>()
    for (let i = 0; i < lenderLoans.length; i++) {
      const loan = lenderLoans[i]
      if (!loan.personId) continue
      personCapital.set(loan.personId, (personCapital.get(loan.personId) ?? 0) + capitalCache[i])
    }

    // Average term for breakeven calc
    const amortizedLoans = lenderLoans.filter((l) => l.loanType === 'amortized' && l.termMonths)
    const avgTerm = amortizedLoans.length > 0
      ? amortizedLoans.reduce((s, l) => s + (l.termMonths ?? 0), 0) / amortizedLoans.length
      : 12

    // Risk limits per person
    const personsForLimits = persons
      .filter((p) => personCapital.has(p.id))
      .map((p) => {
        const score = personScores.get(p.id)!
        return {
          id: p.id,
          name: p.name,
          category: score.category,
          score: score.score,
          defaultProbability: score.defaultProbability,
          capital: personCapital.get(p.id) ?? 0,
        }
      })

    const riskLimits = calculatePersonRiskLimits(personsForLimits, totalCapital, avgTerm)

    // Stress test exposures
    const exposures: PersonExposure[] = personsForLimits.map((p) => ({
      personId: p.id,
      name: p.name,
      capital: p.capital,
      category: p.category,
      defaultProbability: p.defaultProbability,
    }))

    // Weighted TEM for income loss calc
    const yieldMetrics = computeYieldMetrics(lenderLoans, capitalCache, mepRate)
    const stressResults = runStressTest(exposures, totalCapital, yieldMetrics.weightedTEM)

    // Breakeven rates by category
    const breakevenByCategory = (['bajo', 'medio', 'alto', 'critico'] as const).map((cat) => {
      const pd = cat === 'bajo' ? 0.02 : cat === 'medio' ? 0.08 : cat === 'alto' ? 0.18 : 0.40
      const rates = calculateBreakevenTNA(pd, Math.round(avgTerm))
      return { category: cat, pd, ...rates }
    })

    return {
      totalCapital,
      avgTermMonths: Math.round(avgTerm),
      riskLimits,
      stressResults,
      breakevenByCategory,
      portfolioHealth: {
        overLimitCount: riskLimits.filter((r) => r.overLimit).length,
        totalPersons: riskLimits.length,
        worstScenarioLoss: stressResults.length > 0
          ? Math.max(...stressResults.map((s) => s.portfolioLostPct))
          : 0,
      },
    }
  }),

  /** Lightweight endpoint for the create-loan dialog risk alerts */
  getPersonRiskCheck: protectedProcedure
    .input(z.object({ personId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { loans, persons, mepRate } = await loadPortfolioData(ctx.prisma, ctx.user.id)
      // Sólo cartera viva: el "current exposure" de una persona no debe
      // incluir préstamos ya marcados incobrables.
      const lenderLoans = loans.filter((l) => l.direction === 'lender' && l.status !== 'defaulted')
      const capitalCache = buildCapitalCache(lenderLoans, mepRate)
      const totalCapital = capitalCache.reduce((s, c) => s + c, 0)

      const person = persons.find((p) => p.id === input.personId)
      if (!person) return null

      const score = calculatePersonScore(person)

      // Current exposure for this person
      let currentExposure = 0
      for (let i = 0; i < lenderLoans.length; i++) {
        if (lenderLoans[i].personId === input.personId) {
          currentExposure += capitalCache[i]
        }
      }

      // Average term
      const amortizedLoans = lenderLoans.filter((l) => l.loanType === 'amortized' && l.termMonths)
      const avgTerm = amortizedLoans.length > 0
        ? amortizedLoans.reduce((s, l) => s + (l.termMonths ?? 0), 0) / amortizedLoans.length
        : 12

      const maxExposure = totalCapital > 0
        ? totalCapital * (score.category === 'bajo' ? 0.20 : score.category === 'medio' ? 0.10 : score.category === 'alto' ? 0.05 : 0)
        : 0

      const { breakeven, suggested } = calculateBreakevenTNA(score.defaultProbability, Math.round(avgTerm))

      return {
        totalCapital,
        currentExposure,
        maxExposure,
        remainingRoom: Math.max(0, maxExposure - currentExposure),
        overLimit: currentExposure > maxExposure,
        category: score.category,
        defaultProbability: score.defaultProbability,
        breakevenTNA: breakeven,
        suggestedTNA: suggested,
      }
    }),
})
