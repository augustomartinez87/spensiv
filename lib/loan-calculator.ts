import Decimal from 'decimal.js'
import {
  addMonthsEOM,
  buildFrenchLoanWithMinimumTna,
  calculateIRRRobust,
  ceilToMultiple,
  frenchInstallmentExact,
  generateFrenchScheduleExact,
  monthlyRateToTea,
  monthlyRateToTnaNominal,
  tnaNominalToDailyRate,
  tnaNominalToMonthlyRate,
} from './financial-engine'
import { getSmartDueDates, generateSmartSchedule, calculateXIRR } from './business-days'

export type AccrualType = 'linear' | 'exponential'
export type LoanType = 'bullet' | 'amortized'

export interface LoanInput {
  capital: number
  termMonths: number
  tnaTarget: number
  hurdleRate: number
  loanType: LoanType
  accrualType: AccrualType
  customInstallment?: number
  startDate: string
  roundingMultiple?: number
  smartDueDate?: boolean
}

export interface AmortizationRow {
  month: number
  date: string
  installment: number
  interest: number
  principal: number
  balance: number
  accruedReturn: number
}

export interface BulletMonthlySummary {
  month: number
  date: string
  accruedValue: number
  monthlyAccrual: number
  accruedReturn: number
}

export interface SimulationResult {
  loanType: LoanType
  capital: number
  termMonths: number
  tnaTarget: number
  hurdleRate: number
  monthlyRate: number
  dailyRate: number
  hurdleMonthlyRate: number
  installmentAmount?: number
  roundedInstallmentAmount?: number
  amortizationTable?: AmortizationRow[]
  totalPaid?: number
  nominalValue?: number
  discountPrice?: number
  bulletMonthlySummary?: BulletMonthlySummary[]
  tirEffective: number
  tirTNA: number
  hurdleTirTNA: number
  spread: number
  isConvenient: boolean
  accruedCurve: Array<{ month: number; value: number }>
}

export function tnaToMonthlyRate(tna: number): number {
  return tnaNominalToMonthlyRate(tna)
}

export function tnaToDailyRate(tna: number): number {
  return tnaNominalToDailyRate(tna, { dayCount: 'ACT_365' })
}

export function monthlyRateToTNA(rm: number): number {
  return monthlyRateToTnaNominal(rm)
}

export function monthlyToAnnualRate(rm: number): number {
  return monthlyRateToTea(rm)
}

export function frenchInstallment(capital: number, monthlyRate: number, termMonths: number): number {
  return frenchInstallmentExact(capital, monthlyRate, termMonths)
}

export function generateAmortizationTable(
  capital: number,
  monthlyRate: number,
  termMonths: number,
  installmentAmount: number,
  startDate: string,
): AmortizationRow[] {
  const schedule = generateFrenchScheduleExact(capital, monthlyRate, termMonths, installmentAmount, startDate)
  let accrued = new Decimal(0)

  return schedule.schedule.map((row) => {
    accrued = accrued.plus(row.interest)
    return {
      month: row.period,
      date: row.dueDate,
      installment: round2(row.installment),
      interest: round2(row.interest),
      principal: round2(row.principal),
      balance: round2(row.balance),
      accruedReturn: round2(accrued.toNumber()),
    }
  })
}

/**
 * Generates an amortization table using actual-day interest accrual for smart due dates.
 * Returns the rows plus the exact installment amount and total paid.
 */
export function generateSmartAmortizationTable(
  capital: number,
  tna: number,
  startDate: string,
  termMonths: number,
  roundingMultiple = 0,
): { rows: AmortizationRow[]; installmentAmount: number; totalPaid: number; effectiveTna: number } {
  const start = parseIsoDate(startDate)
  const dueDates = getSmartDueDates(start, termMonths)
  const smart = generateSmartSchedule(capital, tna, start, dueDates, roundingMultiple)

  let accrued = new Decimal(0)
  const rows: AmortizationRow[] = smart.schedule.map((row) => {
    accrued = accrued.plus(row.interest)
    return {
      month: row.period,
      date: row.dueDate,
      installment: round2(row.installment),
      interest: round2(row.interest),
      principal: round2(row.principal),
      balance: round2(row.balance),
      accruedReturn: round2(accrued.toNumber()),
    }
  })

  return { rows, installmentAmount: smart.installmentAmount, totalPaid: smart.totalPaid, effectiveTna: smart.effectiveTna }
}

export function reverseFromInstallment(
  capital: number,
  termMonths: number,
  desiredInstallment: number,
  maxIterations = 500,
  tolerance = 1e-12,
): { monthlyRate: number; tna: number } | null {
  if (!Number.isFinite(capital) || capital <= 0 || !Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error('Invalid reverseFromInstallment inputs')
  }
  if (!Number.isFinite(desiredInstallment) || desiredInstallment <= 0) {
    throw new Error('desiredInstallment must be > 0')
  }

  const zeroRateInstallment = capital / termMonths
  if (Math.abs(desiredInstallment - zeroRateInstallment) <= tolerance) {
    return { monthlyRate: 0, tna: 0 }
  }
  if (desiredInstallment < zeroRateInstallment) {
    return null
  }

  const f = (r: number) => frenchInstallmentExact(capital, r, termMonths) - desiredInstallment
  let low = 0
  let high = 1
  let fLow = f(low)
  let fHigh = f(high)
  let expansions = 0
  while (fLow * fHigh > 0 && expansions < 80) {
    high *= 2
    fHigh = f(high)
    expansions++
  }
  if (fLow * fHigh > 0 || !Number.isFinite(fHigh)) {
    return null
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2
    const fMid = f(mid)
    if (!Number.isFinite(fMid)) return null
    if (Math.abs(fMid) <= tolerance || Math.abs(high - low) <= tolerance) {
      return { monthlyRate: mid, tna: monthlyRateToTnaNominal(mid) }
    }
    if (fLow * fMid <= 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }

  return { monthlyRate: (low + high) / 2, tna: monthlyRateToTnaNominal((low + high) / 2) }
}

export function bulletNominalValue(capital: number, tna: number, termMonths: number): number {
  const monthly = tnaNominalToMonthlyRate(tna)
  return new Decimal(capital).mul(new Decimal(1).plus(monthly).pow(termMonths)).toNumber()
}

export function generateBulletMonthlySummary(
  capital: number,
  nominalValue: number,
  termMonths: number,
  accrualType: AccrualType,
  tna: number,
  startDate: string,
): BulletMonthlySummary[] {
  const summary: BulletMonthlySummary[] = []
  const P = new Decimal(capital)
  const VN = new Decimal(nominalValue)
  const totalReturn = VN.minus(P)
  const start = parseIsoDate(startDate)
  let prevAccrued = new Decimal(0)
  const monthly = new Decimal(tnaNominalToMonthlyRate(tna))

  for (let m = 1; m <= termMonths; m++) {
    let accruedValue: Decimal
    if (accrualType === 'linear') {
      accruedValue = P.plus(totalReturn.mul(m).div(termMonths))
    } else {
      accruedValue = P.mul(new Decimal(1).plus(monthly).pow(m))
    }

    const monthlyAccrual = accruedValue.minus(P).minus(prevAccrued)
    prevAccrued = accruedValue.minus(P)

    summary.push({
      month: m,
      date: formatDate(addMonthsEOM(start, m)),
      accruedValue: round2(accruedValue.toNumber()),
      monthlyAccrual: round2(monthlyAccrual.toNumber()),
      accruedReturn: round2(prevAccrued.toNumber()),
    })
  }

  return summary
}

export function calculateIRR(cashFlows: number[], maxIterations = 500, tolerance = 1e-12): number {
  return calculateIRRRobust(cashFlows, tolerance, maxIterations)
}

export function roundUpToMultiple(amount: number, multiple = 100): number {
  return ceilToMultiple(amount, multiple)
}

export function validateInstallmentYield(
  capital: number,
  termMonths: number,
  installment: number,
  minTNA: number,
): boolean {
  const cashFlows = [-capital, ...Array(termMonths).fill(installment)]
  const tirMonthly = calculateIRRRobust(cashFlows)
  return monthlyRateToTnaNominal(tirMonthly) + 1e-8 >= minTNA
}

export function strategicRoundInstallment(
  capital: number,
  termMonths: number,
  exactInstallment: number,
  minTNA: number,
  multiple = 100,
): number {
  if (multiple <= 0) return exactInstallment

  let rounded = ceilToMultiple(exactInstallment, multiple)
  for (let i = 0; i < 50000; i++) {
    if (validateInstallmentYield(capital, termMonths, rounded, minTNA)) {
      return rounded
    }
    rounded += multiple
  }
  throw new Error('Unable to find rounded installment that satisfies minimum TNA')
}

export function simulateLoan(input: LoanInput): SimulationResult {
  const monthlyRate = tnaNominalToMonthlyRate(input.tnaTarget)
  const dailyRate = tnaNominalToDailyRate(input.tnaTarget, { dayCount: 'ACT_365' })
  const hurdleMonthlyRate = tnaNominalToMonthlyRate(input.hurdleRate)
  const base = {
    loanType: input.loanType,
    capital: input.capital,
    termMonths: input.termMonths,
    tnaTarget: input.tnaTarget,
    hurdleRate: input.hurdleRate,
    monthlyRate,
    dailyRate,
    hurdleMonthlyRate,
  }

  if (input.loanType === 'amortized') {
    return simulateAmortized(input, base)
  }
  return simulateBullet(input, base)
}

function simulateAmortized(
  input: LoanInput,
  base: Omit<SimulationResult, 'tirEffective' | 'tirTNA' | 'hurdleTirTNA' | 'spread' | 'isConvenient' | 'accruedCurve'>,
): SimulationResult {
  if (input.smartDueDate) {
    return simulateAmortizedSmart(input, base)
  }

  const built = buildFrenchLoanWithMinimumTna({
    capital: input.capital,
    termMonths: input.termMonths,
    tnaMinima: input.tnaTarget,
    startDate: input.startDate,
    roundingMultiple: input.roundingMultiple ?? 0,
    customInstallment: input.customInstallment,
  })

  const table: AmortizationRow[] = []
  let accrued = new Decimal(0)
  for (const row of built.schedule.schedule) {
    accrued = accrued.plus(row.interest)
    table.push({
      month: row.period,
      date: row.dueDate,
      installment: round2(row.installment),
      interest: round2(row.interest),
      principal: round2(row.principal),
      balance: round2(row.balance),
      accruedReturn: round2(accrued.toNumber()),
    })
  }

  const tirMonthly = built.irrMonthly
  const tirTNA = monthlyRateToTnaNominal(tirMonthly)
  const tirEffective = monthlyRateToTea(tirMonthly)
  const spread = round2((tirTNA - input.hurdleRate) * 100)

  return {
    ...base,
    installmentAmount: round2(built.roundedInstallment),
    roundedInstallmentAmount: round2(built.roundedInstallment),
    amortizationTable: table,
    totalPaid: round2(built.schedule.totalPaid),
    tirEffective,
    tirTNA,
    hurdleTirTNA: input.hurdleRate,
    spread,
    isConvenient: tirTNA + 1e-8 >= input.hurdleRate,
    accruedCurve: [{ month: 0, value: 0 }, ...table.map((row) => ({ month: row.month, value: row.accruedReturn }))],
  }
}

function simulateAmortizedSmart(
  input: LoanInput,
  base: Omit<SimulationResult, 'tirEffective' | 'tirTNA' | 'hurdleTirTNA' | 'spread' | 'isConvenient' | 'accruedCurve'>,
): SimulationResult {
  const startDate = parseIsoDate(input.startDate)
  const dueDates = getSmartDueDates(startDate, input.termMonths)
  const smart = generateSmartSchedule(
    input.capital,
    input.tnaTarget,
    startDate,
    dueDates,
    input.roundingMultiple ?? 0,
  )

  let accrued = new Decimal(0)
  const table: AmortizationRow[] = smart.schedule.map((row) => {
    accrued = accrued.plus(row.interest)
    return {
      month: row.period,
      date: row.dueDate,
      installment: round2(row.installment),
      interest: round2(row.interest),
      principal: round2(row.principal),
      balance: round2(row.balance),
      accruedReturn: round2(accrued.toNumber()),
    }
  })

  // XIRR: effective annual IRR considering actual payment dates
  const xirrDates = [startDate, ...dueDates]
  const xirrCFs = [-input.capital, ...smart.schedule.map((r) => r.installment)]
  const xirr = calculateXIRR(xirrDates, xirrCFs)

  // Convert effective annual rate → TNA (nominal, monthly compounding convention)
  const xirrMonthly = Math.pow(1 + xirr, 1 / 12) - 1
  const tirTNA = monthlyRateToTnaNominal(xirrMonthly)
  const tirEffective = xirr
  const spread = round2((tirTNA - input.hurdleRate) * 100)

  return {
    ...base,
    installmentAmount: round2(smart.installmentAmount),
    roundedInstallmentAmount: round2(smart.installmentAmount),
    amortizationTable: table,
    totalPaid: round2(smart.totalPaid),
    tirEffective,
    tirTNA,
    hurdleTirTNA: input.hurdleRate,
    spread,
    isConvenient: tirTNA + 1e-8 >= input.hurdleRate,
    accruedCurve: [{ month: 0, value: 0 }, ...table.map((r) => ({ month: r.month, value: r.accruedReturn }))],
  }
}

function simulateBullet(
  input: LoanInput,
  base: Omit<SimulationResult, 'tirEffective' | 'tirTNA' | 'hurdleTirTNA' | 'spread' | 'isConvenient' | 'accruedCurve'>,
): SimulationResult {
  const nominalValue = round2(bulletNominalValue(input.capital, input.tnaTarget, input.termMonths))
  const monthlySummary = generateBulletMonthlySummary(
    input.capital,
    nominalValue,
    input.termMonths,
    input.accrualType,
    input.tnaTarget,
    input.startDate,
  )
  const cashFlows = [-input.capital, ...Array(input.termMonths - 1).fill(0), nominalValue]
  const tirMonthly = calculateIRRRobust(cashFlows)
  const tirTNA = monthlyRateToTnaNominal(tirMonthly)
  const tirEffective = monthlyRateToTea(tirMonthly)
  const spread = round2((tirTNA - input.hurdleRate) * 100)

  return {
    ...base,
    nominalValue,
    discountPrice: input.capital,
    bulletMonthlySummary: monthlySummary,
    tirEffective,
    tirTNA,
    hurdleTirTNA: input.hurdleRate,
    spread,
    isConvenient: tirTNA + 1e-8 >= input.hurdleRate,
    accruedCurve: [{ month: 0, value: 0 }, ...monthlySummary.map((row) => ({ month: row.month, value: row.accruedReturn }))],
  }
}

export interface ComparisonResult {
  amortized: SimulationResult
  bullet: SimulationResult
  tirDifference: number
  recommendation: 'amortized' | 'bullet' | 'neither'
}

export function compareLoanTypes(input: Omit<LoanInput, 'loanType'>): ComparisonResult {
  const amortized = simulateLoan({ ...input, loanType: 'amortized' })
  const bullet = simulateLoan({ ...input, loanType: 'bullet' })
  const tirDifference = round2((amortized.tirTNA - bullet.tirTNA) * 100)

  let recommendation: 'amortized' | 'bullet' | 'neither'
  if (!amortized.isConvenient && !bullet.isConvenient) {
    recommendation = 'neither'
  } else if (amortized.tirTNA >= bullet.tirTNA) {
    recommendation = 'amortized'
  } else {
    recommendation = 'bullet'
  }

  return { amortized, bullet, tirDifference, recommendation }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
