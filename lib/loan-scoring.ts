type PersonForScoring = {
  incomeType: string
  tenureMonths: number | null
  recentJobChanges: boolean
  estimatedIncome: number | { toNumber(): number } | null
  relationship: string
  referrer: string | null
  punctualityScore: number
  communicationScore: number
  debtAttitudeScore: number
  previousDebts: boolean
  hasChildren: boolean
  livesAlone: boolean
}

export type ScoreResult = {
  score: number
  category: 'bajo' | 'medio' | 'alto' | 'critico'
  minTnaSpread: number
  defaultProbability: number
}

export function calculatePersonScore(person: PersonForScoring): ScoreResult {
  let score = 0

  // Estabilidad (max 4pts)
  if (person.incomeType === 'en_blanco') score += 2
  else if (person.incomeType === 'monotributo') score += 1

  const tenure = person.tenureMonths ?? 0
  if (tenure > 24) score += 1
  else if (tenure > 12) score += 0.5

  if (!person.recentJobChanges) score += 1

  // Ingresos (max 2pts)
  const income = person.estimatedIncome
    ? typeof person.estimatedIncome === 'number'
      ? person.estimatedIncome
      : person.estimatedIncome.toNumber()
    : 0
  if (income > 500000) score += 2
  else if (income > 0) score += 1

  // Referencias (max 2pts)
  let refScore = 0
  if (person.relationship === 'amigo') refScore += 2
  else if (person.relationship === 'amigo_de_amigo') refScore += 1
  if (person.referrer) refScore += 0.5
  score += Math.min(refScore, 2)

  // Comportamiento (max 4pts)
  const avgBehavior =
    (person.punctualityScore + person.communicationScore + person.debtAttitudeScore) / 3
  score += (avgBehavior / 5) * 4

  // Riesgos (negativo)
  if (person.previousDebts) score -= 1
  if (person.hasChildren && person.livesAlone) score -= 0.5

  score = Math.max(0, Math.round(score * 10) / 10)

  let category: ScoreResult['category']
  let minTnaSpread: number
  let defaultProbability: number

  if (score >= 10) {
    category = 'bajo'
    minTnaSpread = 0.20
    defaultProbability = 0.02
  } else if (score >= 7) {
    category = 'medio'
    minTnaSpread = 0.30
    defaultProbability = 0.08
  } else if (score >= 4) {
    category = 'alto'
    minTnaSpread = 0.45
    defaultProbability = 0.18
  } else {
    category = 'critico'
    minTnaSpread = 999
    defaultProbability = 0.40
  }

  return { score, category, minTnaSpread, defaultProbability }
}

export function calculateExpectedValue(
  capital: number,
  totalInterest: number,
  defaultProbability: number
): number {
  return (1 - defaultProbability) * totalInterest - defaultProbability * capital
}
