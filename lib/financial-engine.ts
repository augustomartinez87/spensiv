import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type DayCountConvention = 'ACT_365'

export interface RateContext {
  dayCount: DayCountConvention
}

export interface FrenchScheduleRow {
  period: number
  dueDate: string
  installment: number
  interest: number
  principal: number
  balance: number
}

export interface FrenchScheduleResult {
  schedule: FrenchScheduleRow[]
  totalInterest: number
  totalPaid: number
  periods: number
}

export interface BuildFrenchLoanInput {
  capital: number
  termMonths: number
  tnaMinima: number
  startDate: string
  roundingMultiple?: number
  customInstallment?: number
  maxSteps?: number
  dayCount?: DayCountConvention
}

export interface BuildFrenchLoanResult {
  monthlyRate: number
  dailyRate: number
  theoreticalInstallment: number
  roundedInstallment: number
  schedule: FrenchScheduleResult
  irrMonthly: number
  irrTnaNominal: number
}

export interface DatedCashflow {
  date: Date
  amount: number
}

const DEFAULT_EPSILON = 1e-8
const SAFETY_MARGIN = 1e-5
const IRR_NUMERIC_TOLERANCE = 1e-10

export function tnaNominalToMonthlyRate(tnaNominal: number): number {
  if (!Number.isFinite(tnaNominal) || tnaNominal < 0) {
    throw new Error('Invalid nominal TNA: must be a finite number >= 0')
  }
  return tnaNominal / 12
}

export function monthlyRateToTnaNominal(monthlyRate: number): number {
  if (!Number.isFinite(monthlyRate) || monthlyRate < -1) {
    throw new Error('Invalid monthly rate')
  }
  return monthlyRate * 12
}

export function monthlyRateToTea(monthlyRate: number): number {
  if (!Number.isFinite(monthlyRate) || monthlyRate < -1) {
    throw new Error('Invalid monthly rate')
  }
  return new Decimal(1).plus(monthlyRate).pow(12).minus(1).toNumber()
}

export function tnaNominalToDailyRate(
  tnaNominal: number,
  context: RateContext = { dayCount: 'ACT_365' },
): number {
  if (context.dayCount !== 'ACT_365') {
    throw new Error(`Unsupported day count convention: ${context.dayCount}`)
  }
  return tnaNominal / 365
}

export function frenchInstallmentExact(capital: number, monthlyRate: number, termMonths: number): number {
  validateCoreInputs(capital, monthlyRate, termMonths)
  const P = new Decimal(capital)
  const r = new Decimal(monthlyRate)
  const n = termMonths

  if (r.isZero()) {
    return P.div(n).toNumber()
  }

  const onePlusRPowerN = new Decimal(1).plus(r).pow(n)
  return P.mul(r).mul(onePlusRPowerN).div(onePlusRPowerN.minus(1)).toNumber()
}

export function ceilToMultiple(amount: number, multiple: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be finite and > 0')
  }
  if (!Number.isFinite(multiple) || multiple <= 0) {
    throw new Error('Multiple must be finite and > 0')
  }
  return Math.ceil(amount / multiple) * multiple
}

export function buildFrenchLoanWithMinimumTna(input: BuildFrenchLoanInput): BuildFrenchLoanResult {
  const roundingMultiple = input.roundingMultiple ?? 0
  const maxSteps = input.maxSteps ?? 50000
  const dayCount = input.dayCount ?? 'ACT_365'
  const targetTnaWithSafety = input.tnaMinima + SAFETY_MARGIN
  const monthlyRate = tnaNominalToMonthlyRate(targetTnaWithSafety)
  const dailyRate = tnaNominalToDailyRate(targetTnaWithSafety, { dayCount })

  if (!Number.isFinite(input.capital) || input.capital <= 0) {
    throw new Error('Capital must be > 0')
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) {
    throw new Error('termMonths must be an integer > 0')
  }
  if (!Number.isFinite(input.tnaMinima) || input.tnaMinima < 0) {
    throw new Error('tnaMinima must be >= 0')
  }
  if (roundingMultiple < 0) {
    throw new Error('roundingMultiple must be >= 0')
  }

  const theoreticalInstallment = input.customInstallment && input.customInstallment > 0
    ? input.customInstallment
    : frenchInstallmentExact(input.capital, monthlyRate, input.termMonths)

  let currentInstallment = roundingMultiple > 0
    ? ceilToMultiple(theoreticalInstallment, roundingMultiple)
    : theoreticalInstallment

  const step = roundingMultiple > 0 ? roundingMultiple : 0
  let iterations = 0
  const visitedInstallments = new Set<number>()

  while (iterations <= maxSteps) {
    if (visitedInstallments.has(currentInstallment)) {
      throw new Error('Unable to satisfy contractual term with current rounding multiple')
    }
    visitedInstallments.add(currentInstallment)

    let schedule: FrenchScheduleResult
    try {
      schedule = generateFrenchScheduleExact(
        input.capital,
        monthlyRate,
        input.termMonths,
        currentInstallment,
        input.startDate,
      )
    } catch (error) {
      if (step <= 0) throw error
      const message = error instanceof Error ? error.message : ''
      if (message.includes('early payoff before contractual maturity')) {
        const nextInstallment = currentInstallment - step
        if (nextInstallment <= 0) {
          throw new Error('Unable to satisfy contractual term with current rounding multiple')
        }
        currentInstallment = nextInstallment
        iterations++
        continue
      }
      if (message.includes('does not amortize principal')) {
        currentInstallment += step
        iterations++
        continue
      }
      throw error
    }
    const cashFlows = [-input.capital, ...schedule.schedule.map((row) => row.installment)]
    const irrMonthly = calculateIRRRobust(cashFlows)
    const irrTnaNominal = monthlyRateToTnaNominal(irrMonthly)

    validateFrenchInvariants({
      capital: input.capital,
      schedule,
      tnaMinima: input.tnaMinima,
      irrTnaNominal,
      enforceMinimumTna: false,
    })

    if (irrTnaNominal + IRR_NUMERIC_TOLERANCE >= input.tnaMinima + SAFETY_MARGIN) {
      validateFrenchInvariants({
        capital: input.capital,
        schedule,
        tnaMinima: input.tnaMinima,
        irrTnaNominal,
        enforceMinimumTna: true,
      })
      return {
        monthlyRate,
        dailyRate,
        theoreticalInstallment,
        roundedInstallment: currentInstallment,
        schedule,
        irrMonthly,
        irrTnaNominal,
      }
    }

    if (step <= 0) {
      throw new Error('Unable to satisfy minimum TNA without rounding step')
    }

    currentInstallment += step
    iterations++
  }

  throw new Error('Unable to satisfy minimum TNA: iterative search did not converge within maxSteps')
}

export function generateFrenchScheduleExact(
  capital: number,
  monthlyRate: number,
  termMonths: number,
  fixedInstallment: number,
  startDate: string,
): FrenchScheduleResult {
  validateCoreInputs(capital, monthlyRate, termMonths)
  if (!Number.isFinite(fixedInstallment) || fixedInstallment <= 0) {
    throw new Error('fixedInstallment must be > 0')
  }

  const schedule: FrenchScheduleRow[] = []
  const start = parseIsoDate(startDate)
  const baseInstallment = new Decimal(fixedInstallment)
  const rate = new Decimal(monthlyRate)
  const periodTolerance = new Decimal(Math.max(DEFAULT_EPSILON, capital * 1e-12))
  let balance = new Decimal(capital)
  let totalInterest = new Decimal(0)
  let totalPaid = new Decimal(0)

  for (let period = 1; period <= termMonths; period++) {
    const interest = balance.mul(rate)
    if (interest.isNegative()) {
      throw new Error(`Invariant failed: negative interest at period ${period}`)
    }

    let installment = baseInstallment
    let principal = installment.minus(interest)

    if (principal.lte(0)) {
      throw new Error(`Installment does not amortize principal at period ${period}`)
    }

    if (period < termMonths && principal.plus(periodTolerance).greaterThanOrEqualTo(balance)) {
      throw new Error(`Installment causes early payoff before contractual maturity (period ${period})`)
    }

    if (period === termMonths) {
      principal = balance
      installment = interest.plus(principal)
    }

    balance = balance.minus(principal)
    if (balance.isNegative()) {
      throw new Error(`Invariant failed: negative balance at period ${period}`)
    }

    totalInterest = totalInterest.plus(interest)
    totalPaid = totalPaid.plus(installment)

    schedule.push({
      period,
      dueDate: formatDate(addMonthsEOM(start, period)),
      installment: installment.toNumber(),
      interest: interest.toNumber(),
      principal: principal.toNumber(),
      balance: balance.toNumber(),
    })

    if (period < termMonths && balance.lte(periodTolerance)) {
      throw new Error(`Installment causes early payoff before contractual maturity (period ${period})`)
    }
    if (period === termMonths && balance.abs().lte(periodTolerance)) {
      balance = new Decimal(0)
    }
  }

  if (!balance.isZero()) {
    throw new Error('Invariant failed: schedule ended with non-zero balance')
  }

  return {
    schedule,
    totalInterest: totalInterest.toNumber(),
    totalPaid: totalPaid.toNumber(),
    periods: schedule.length,
  }
}

export function calculateIRRRobust(
  cashFlows: number[],
  tolerance = 1e-12,
  maxIterations = 500,
): number {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
    throw new Error('IRR requires at least two cash flows')
  }
  if (!cashFlows.every((v) => Number.isFinite(v))) {
    throw new Error('IRR cash flows must be finite numbers')
  }

  const hasPositive = cashFlows.some((v) => v > 0)
  const hasNegative = cashFlows.some((v) => v < 0)
  if (!hasPositive || !hasNegative) {
    throw new Error('IRR requires at least one positive and one negative cash flow')
  }

  const npv = (rate: number) => {
    let result = 0
    for (let t = 0; t < cashFlows.length; t++) {
      result += cashFlows[t] / Math.pow(1 + rate, t)
    }
    return result
  }

  const lowerCandidates = [-0.5, -0.25, -0.1, 0]
  let lower = lowerCandidates[0]
  let upper = 1
  let npvLower = npv(lower)
  for (const candidate of lowerCandidates) {
    const value = npv(candidate)
    if (Number.isFinite(value)) {
      lower = candidate
      npvLower = value
      break
    }
  }
  if (!Number.isFinite(npvLower)) {
    throw new Error('IRR bracketing failed: lower bound NPV is not finite')
  }
  let npvUpper = npv(upper)

  let expansions = 0
  while (npvLower * npvUpper > 0 && expansions < 80) {
    upper *= 2
    npvUpper = npv(upper)
    expansions++
    if (!Number.isFinite(npvUpper) || upper > 1e12) {
      break
    }
  }

  if (!Number.isFinite(npvLower) || !Number.isFinite(npvUpper) || npvLower * npvUpper > 0) {
    throw new Error('IRR bracketing failed')
  }

  let left = lower
  let right = upper
  let fLeft = npvLower
  let fRight = npvUpper

  for (let i = 0; i < maxIterations; i++) {
    const mid = (left + right) / 2
    const fMid = npv(mid)

    if (!Number.isFinite(fMid)) {
      throw new Error('IRR produced non-finite value during bisection')
    }

    if (Math.abs(fMid) <= tolerance || Math.abs(right - left) <= tolerance) {
      validateFiniteRate(mid)
      return mid
    }

    if (fLeft * fMid <= 0) {
      right = mid
      fRight = fMid
    } else {
      left = mid
      fLeft = fMid
    }

    // Regula falsi style acceleration step every few iterations.
    if (i % 8 === 7) {
      const denom = (fRight - fLeft)
      if (Math.abs(denom) > 1e-18) {
        const secant = right - (fRight * (right - left)) / denom
        if (secant > left && secant < right) {
          const fSecant = npv(secant)
          if (Number.isFinite(fSecant)) {
            if (Math.abs(fSecant) <= tolerance) {
              validateFiniteRate(secant)
              return secant
            }
            if (fLeft * fSecant <= 0) {
              right = secant
              fRight = fSecant
            } else {
              left = secant
              fLeft = fSecant
            }
          }
        }
      }
    }
  }

  throw new Error('IRR did not converge within maxIterations')
}

export function calculateXirrAnnualRobust(
  cashFlows: DatedCashflow[],
  tolerance = 1e-12,
  maxIterations = 500,
): number {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
    throw new Error('XIRR requires at least two cash flows')
  }

  const normalized = cashFlows
    .map((flow) => ({
      date: normalizeDate(flow.date),
      amount: flow.amount,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (!normalized.every((flow) => Number.isFinite(flow.amount))) {
    throw new Error('XIRR cash flows must be finite numbers')
  }

  const hasPositive = normalized.some((flow) => flow.amount > 0)
  const hasNegative = normalized.some((flow) => flow.amount < 0)
  if (!hasPositive || !hasNegative) {
    throw new Error('XIRR requires at least one positive and one negative cash flow')
  }

  const origin = normalized[0].date
  const yearFractions = normalized.map((flow) => daysBetweenUtc(origin, flow.date) / 365)

  const xnpv = (rate: number): number => {
    let sum = 0
    for (let i = 0; i < normalized.length; i++) {
      const yf = yearFractions[i]
      const denom = Math.pow(1 + rate, yf)
      sum += normalized[i].amount / denom
    }
    return sum
  }

  const xnpvDerivative = (rate: number): number => {
    let sum = 0
    for (let i = 0; i < normalized.length; i++) {
      const yf = yearFractions[i]
      if (yf === 0) continue
      const denom = Math.pow(1 + rate, yf + 1)
      sum += (-yf * normalized[i].amount) / denom
    }
    return sum
  }

  let guess = 0.1
  for (let i = 0; i < maxIterations; i++) {
    const f = xnpv(guess)
    if (!Number.isFinite(f)) break
    if (Math.abs(f) <= tolerance) {
      validateFiniteRate(guess)
      return guess
    }

    const d = xnpvDerivative(guess)
    if (!Number.isFinite(d) || Math.abs(d) < 1e-18) break

    const next = guess - f / d
    if (!Number.isFinite(next) || next <= -0.999999999999 || next > 1e12) break

    if (Math.abs(next - guess) <= tolerance) {
      validateFiniteRate(next)
      return next
    }

    guess = next
  }

  const lowerCandidates = [-0.9999, -0.9, -0.5, -0.25, -0.1, 0]
  let lower = lowerCandidates[0]
  let fLower = xnpv(lower)
  for (const candidate of lowerCandidates) {
    const value = xnpv(candidate)
    if (Number.isFinite(value)) {
      lower = candidate
      fLower = value
      break
    }
  }
  if (!Number.isFinite(fLower)) {
    throw new Error('XIRR bracketing failed: lower bound is not finite')
  }

  let upper = 1
  let fUpper = xnpv(upper)
  let expansions = 0
  while (fLower * fUpper > 0 && expansions < 80) {
    upper *= 2
    fUpper = xnpv(upper)
    expansions++
    if (!Number.isFinite(fUpper) || upper > 1e12) {
      break
    }
  }

  if (!Number.isFinite(fUpper) || fLower * fUpper > 0) {
    throw new Error('XIRR bracketing failed')
  }

  let left = lower
  let right = upper
  let fLeft = fLower
  let fRight = fUpper
  const maxBisectionIterations = Math.max(maxIterations, 200)

  for (let i = 0; i < maxBisectionIterations; i++) {
    const mid = (left + right) / 2
    const fMid = xnpv(mid)
    if (!Number.isFinite(fMid)) {
      throw new Error('XIRR produced non-finite value during bisection')
    }

    if (Math.abs(fMid) <= tolerance || Math.abs(right - left) <= tolerance) {
      validateFiniteRate(mid)
      return mid
    }

    if (fLeft * fMid <= 0) {
      right = mid
      fRight = fMid
    } else {
      left = mid
      fLeft = fMid
    }

    if (i % 8 === 7) {
      const denom = fRight - fLeft
      if (Math.abs(denom) > 1e-18) {
        const secant = right - (fRight * (right - left)) / denom
        if (secant > left && secant < right) {
          const fSecant = xnpv(secant)
          if (Number.isFinite(fSecant)) {
            if (Math.abs(fSecant) <= tolerance) {
              validateFiniteRate(secant)
              return secant
            }
            if (fLeft * fSecant <= 0) {
              right = secant
              fRight = fSecant
            } else {
              left = secant
              fLeft = fSecant
            }
          }
        }
      }
    }
  }

  throw new Error('XIRR did not converge within maxIterations')
}

export function addMonthsEOM(date: Date, monthsToAdd: number): Date {
  if (!Number.isInteger(monthsToAdd) || monthsToAdd < 0) {
    throw new Error('monthsToAdd must be an integer >= 0')
  }

  const originalDay = date.getDate()
  const originalMonth = date.getMonth()
  const originalYear = date.getFullYear()
  const sourceIsEOM = originalDay === daysInMonth(originalYear, originalMonth)

  const targetMonthIndex = originalMonth + monthsToAdd
  const targetYear = originalYear + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const targetDays = daysInMonth(targetYear, targetMonth)
  const targetDay = sourceIsEOM ? targetDays : Math.min(originalDay, targetDays)

  return new Date(targetYear, targetMonth, targetDay)
}

export function validateFrenchInvariants(args: {
  capital: number
  schedule: FrenchScheduleResult
  tnaMinima: number
  irrTnaNominal: number
  enforceMinimumTna?: boolean
  tolerance?: number
}): void {
  const tolerance = args.tolerance ?? Math.max(DEFAULT_EPSILON, args.capital * 1e-12)
  const principalSum = args.schedule.schedule.reduce((acc, row) => acc.plus(row.principal), new Decimal(0))
  const finalBalance = new Decimal(args.schedule.schedule.at(-1)?.balance ?? args.capital)

  if (principalSum.minus(args.capital).abs().greaterThan(tolerance)) {
    throw new Error('Invariant failed: principal sum differs from capital')
  }
  if (finalBalance.abs().greaterThan(tolerance)) {
    throw new Error('Invariant failed: final balance is not zero')
  }
  for (const row of args.schedule.schedule) {
    if (row.interest < -tolerance) {
      throw new Error(`Invariant failed: negative interest at period ${row.period}`)
    }
    if (row.balance < -tolerance) {
      throw new Error(`Invariant failed: negative balance at period ${row.period}`)
    }
  }
  if ((args.enforceMinimumTna ?? true) && args.irrTnaNominal + tolerance < args.tnaMinima) {
    throw new Error('Invariant failed: real TNA is below required minimum')
  }
}

function validateCoreInputs(capital: number, monthlyRate: number, termMonths: number): void {
  if (!Number.isFinite(capital) || capital <= 0) {
    throw new Error('Capital must be finite and > 0')
  }
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) {
    throw new Error('Monthly rate must be finite and >= 0')
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error('termMonths must be an integer > 0')
  }
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate()
}

function parseIsoDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateStr}`)
  }
  return date
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function validateFiniteRate(rate: number): void {
  if (!Number.isFinite(rate)) {
    throw new Error('IRR produced non-finite result')
  }
  if (rate <= -1) {
    throw new Error('IRR produced invalid rate <= -100%')
  }
}

function normalizeDate(date: Date): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('XIRR cash flow date must be a valid Date')
  }
  return date
}

function daysBetweenUtc(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return (endUtc - startUtc) / (24 * 60 * 60 * 1000)
}
