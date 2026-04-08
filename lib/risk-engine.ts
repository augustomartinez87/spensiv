import type { ScoreResult } from './loan-scoring'

// ── Concentration limits by risk category ────────────────────────────
// Maximum % of total portfolio capital a single person should represent

const MAX_CONCENTRATION: Record<ScoreResult['category'], number> = {
  bajo: 0.20,    // 20%
  medio: 0.10,   // 10%
  alto: 0.05,    // 5%
  critico: 0,    // 0% — no prestar
}

export function getMaxConcentration(category: ScoreResult['category']): number {
  return MAX_CONCENTRATION[category]
}

/**
 * Calculates the recommended maximum exposure for a person given
 * total portfolio capital and their risk category.
 */
export function calculateMaxExposure(
  totalPortfolioCapital: number,
  category: ScoreResult['category'],
): number {
  return totalPortfolioCapital * MAX_CONCENTRATION[category]
}

// ── Break-even rate ──────────────────────────────────────────────────

/**
 * Calculates the minimum annual rate (TNA) needed so that expected
 * value across the portfolio is non-negative, given a default probability.
 *
 * LGD is always 100% (informal lending — total loss on default).
 *
 * For an amortized loan of `termMonths`, the total interest over the life
 * of the loan must cover the expected loss:
 *   (1 - PD) × totalInterest >= PD × capital
 *   totalInterest >= PD / (1 - PD) × capital
 *
 * We solve for the monthly rate that produces that total interest
 * via French amortization, then convert to TNA.
 *
 * For simplicity we use a linear approximation:
 *   breakeven TEM ≈ PD / (1 - PD) × 2 / (termMonths + 1)
 * which comes from the average outstanding balance being ~capital/2.
 *
 * For interest-only loans the math is simpler:
 *   TEM_breakeven = PD / ((1 - PD) × termMonths)  [per month of term]
 *   but since interest-only has no term, we use 12 months as reference.
 */
export function calculateBreakevenTNA(
  defaultProbability: number,
  termMonths?: number,
): { breakeven: number; suggested: number } {
  if (defaultProbability >= 1) return { breakeven: 999, suggested: 999 }
  if (defaultProbability <= 0) return { breakeven: 0, suggested: 0 }

  const pd = defaultProbability
  const term = termMonths ?? 12

  // For amortized: average outstanding ≈ capital × (term+1)/(2×term)
  // Required total interest = PD/(1-PD) × capital
  // Monthly interest on avg balance = TEM × capital × (term+1)/(2×term)
  // Total interest over term = TEM × capital × (term+1)/2
  // So: TEM × (term+1)/2 >= PD/(1-PD)
  // TEM >= 2×PD / ((1-PD)×(term+1))
  const temBreakeven = (2 * pd) / ((1 - pd) * (term + 1))

  // Convert TEM to TNA (nominal)
  const tnaBreakeven = temBreakeven * 12

  // Suggested = breakeven + 10% margin
  const tnaSuggested = tnaBreakeven + 0.10

  return {
    breakeven: Math.round(tnaBreakeven * 10000) / 10000,
    suggested: Math.round(tnaSuggested * 10000) / 10000,
  }
}

// ── Stress test ──────────────────────────────────────────────────────

export type StressScenario = {
  label: string
  description: string
  defaultCount: number
}

export type PersonExposure = {
  personId: string | null
  name: string
  capital: number
  category: ScoreResult['category']
  defaultProbability: number
}

export type StressResult = {
  scenario: StressScenario
  /** Persons that default in this scenario (sorted by capital desc) */
  defaultedPersons: PersonExposure[]
  /** Total capital lost */
  capitalLost: number
  /** % of portfolio lost */
  portfolioLostPct: number
  /** Remaining capital after loss */
  remainingCapital: number
  /** Monthly income lost (approx) */
  monthlyIncomeLost: number
  /** Whether portfolio survives (remaining > 0 and can still generate income) */
  survives: boolean
}

const SCENARIOS: StressScenario[] = [
  {
    label: 'Leve',
    description: 'Defaultea el deudor más riesgoso',
    defaultCount: 1,
  },
  {
    label: 'Moderado',
    description: 'Defaultean los 2 deudores más riesgosos',
    defaultCount: 2,
  },
  {
    label: 'Severo',
    description: 'Defaultean los 3 deudores más riesgosos',
    defaultCount: 3,
  },
  {
    label: 'Catástrofe',
    description: 'Defaultea el deudor con mayor capital',
    defaultCount: -1, // special: top by capital
  },
]

/**
 * Runs stress test scenarios on the portfolio.
 * For each scenario, picks the N worst persons (by risk, or by capital)
 * and calculates the impact of their simultaneous default.
 */
export function runStressTest(
  exposures: PersonExposure[],
  totalCapital: number,
  weightedTEM: number,
): StressResult[] {
  if (exposures.length === 0 || totalCapital <= 0) return []

  // Sort by risk: highest PD first, then by capital desc
  const byRisk = [...exposures].sort(
    (a, b) => b.defaultProbability - a.defaultProbability || b.capital - a.capital,
  )
  // Sort by capital desc
  const byCapital = [...exposures].sort((a, b) => b.capital - a.capital)

  return SCENARIOS.map((scenario) => {
    let defaultedPersons: PersonExposure[]

    if (scenario.defaultCount === -1) {
      // Catastrophe: biggest borrower defaults
      defaultedPersons = byCapital.slice(0, 1)
    } else {
      defaultedPersons = byRisk.slice(0, Math.min(scenario.defaultCount, byRisk.length))
    }

    const capitalLost = defaultedPersons.reduce((s, p) => s + p.capital, 0)
    const portfolioLostPct = totalCapital > 0 ? (capitalLost / totalCapital) * 100 : 0
    const remainingCapital = totalCapital - capitalLost
    const monthlyIncomeLost = capitalLost * weightedTEM

    return {
      scenario,
      defaultedPersons,
      capitalLost,
      portfolioLostPct,
      remainingCapital,
      monthlyIncomeLost,
      survives: remainingCapital > 0,
    }
  })
}

// ── Risk limits per person ───────────────────────────────────────────

export type PersonRiskLimit = {
  personId: string
  name: string
  category: ScoreResult['category']
  score: number
  defaultProbability: number
  currentExposure: number
  maxExposure: number
  usagePct: number
  overLimit: boolean
  breakevenTNA: number
  suggestedTNA: number
}

export function calculatePersonRiskLimits(
  persons: {
    id: string
    name: string
    category: ScoreResult['category']
    score: number
    defaultProbability: number
    capital: number
  }[],
  totalPortfolioCapital: number,
  avgTermMonths?: number,
): PersonRiskLimit[] {
  return persons
    .filter((p) => p.capital > 0)
    .map((p) => {
      const maxExposure = calculateMaxExposure(totalPortfolioCapital, p.category)
      const usagePct = maxExposure > 0 ? (p.capital / maxExposure) * 100 : p.capital > 0 ? 999 : 0
      const { breakeven, suggested } = calculateBreakevenTNA(p.defaultProbability, avgTermMonths)

      return {
        personId: p.id,
        name: p.name,
        category: p.category,
        score: p.score,
        defaultProbability: p.defaultProbability,
        currentExposure: p.capital,
        maxExposure,
        usagePct,
        overLimit: p.capital > maxExposure,
        breakevenTNA: breakeven,
        suggestedTNA: suggested,
      }
    })
    .sort((a, b) => b.usagePct - a.usagePct)
}
