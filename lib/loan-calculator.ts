import Decimal from 'decimal.js'

// ─── Types ───────────────────────────────────────────────────────────

export type AccrualType = 'linear' | 'exponential'
export type LoanType = 'bullet' | 'amortized'

export interface LoanInput {
  capital: number
  termMonths: number
  tnaTarget: number       // e.g. 0.55 for 55%
  hurdleRate: number      // e.g. 0.40 for 40% TNA
  loanType: LoanType
  accrualType: AccrualType
  customInstallment?: number  // optional manual installment
  startDate: string          // YYYY-MM-DD
  roundingMultiple?: number  // 0 = disabled, 1000 = default, 100 = option
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

export interface BulletRow {
  day: number
  date: string
  accruedValue: number
  dailyAccrual: number
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

  // Amortized specific
  installmentAmount?: number
  roundedInstallmentAmount?: number  // strategically rounded up to multiple of 100
  amortizationTable?: AmortizationRow[]
  totalPaid?: number

  // Bullet specific
  nominalValue?: number
  discountPrice?: number
  bulletMonthlySummary?: BulletMonthlySummary[]

  // Common
  tirEffective: number
  tirTNA: number
  hurdleTirTNA: number
  spread: number
  isConvenient: boolean
  accruedCurve: Array<{ month: number; value: number }>
}

// ─── Rate Conversions ────────────────────────────────────────────────

/**
 * TNA → Tasa efectiva mensual
 * r_m = (1 + TNA)^(1/12) - 1
 */
export function tnaToMonthlyRate(tna: number): number {
  return new Decimal(1 + tna).pow(new Decimal(1).div(12)).minus(1).toNumber()
}

/**
 * TNA → Tasa efectiva diaria
 * r_d = (1 + TNA)^(1/365) - 1
 */
export function tnaToDailyRate(tna: number): number {
  return new Decimal(1 + tna).pow(new Decimal(1).div(365)).minus(1).toNumber()
}

/**
 * Tasa mensual → TNA equivalente
 */
export function monthlyRateToTNA(rm: number): number {
  return new Decimal(1 + rm).pow(12).minus(1).toNumber()
}

/**
 * TIR mensual → TIR anual efectiva (TEA)
 */
export function monthlyToAnnualRate(rm: number): number {
  return new Decimal(1 + rm).pow(12).minus(1).toNumber()
}

// ─── French Amortization (Cuotas Fijas) ──────────────────────────────

/**
 * Calcula la cuota fija del sistema francés
 * C = P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function frenchInstallment(capital: number, monthlyRate: number, termMonths: number): number {
  const r = new Decimal(monthlyRate)
  const P = new Decimal(capital)
  const n = termMonths

  if (r.isZero()) return P.div(n).toNumber()

  const rPlusOne = r.plus(1)
  const rPlusOnePowN = rPlusOne.pow(n)

  return P.mul(r).mul(rPlusOnePowN).div(rPlusOnePowN.minus(1)).toNumber()
}

/**
 * Genera la tabla de amortización completa (sistema francés)
 */
export function generateAmortizationTable(
  capital: number,
  monthlyRate: number,
  termMonths: number,
  installmentAmount: number,
  startDate: string,
): AmortizationRow[] {
  const table: AmortizationRow[] = []
  let balance = new Decimal(capital)
  let accruedReturn = new Decimal(0)
  const start = new Date(startDate)

  for (let m = 1; m <= termMonths; m++) {
    const interest = balance.mul(monthlyRate)
    const principal = new Decimal(installmentAmount).minus(interest)
    balance = balance.minus(principal)
    accruedReturn = accruedReturn.plus(interest)

    // Clamp balance to 0 on last month to avoid floating point noise
    if (m === termMonths) balance = new Decimal(0)

    const date = new Date(start)
    date.setMonth(date.getMonth() + m)

    table.push({
      month: m,
      date: formatDate(date),
      installment: round2(installmentAmount),
      interest: round2(interest.toNumber()),
      principal: round2(principal.toNumber()),
      balance: round2(Math.max(0, balance.toNumber())),
      accruedReturn: round2(accruedReturn.toNumber()),
    })
  }

  return table
}

/**
 * Dado capital, plazo y cuota deseada, encuentra la tasa mensual implícita
 * usando Newton-Raphson sobre la fórmula de cuota francesa.
 * Retorna la TNA equivalente.
 */
export function reverseFromInstallment(
  capital: number,
  termMonths: number,
  desiredInstallment: number,
  maxIterations = 200,
  tolerance = 1e-12,
): { monthlyRate: number; tna: number } | null {
  // f(r) = P * r * (1+r)^n / ((1+r)^n - 1) - C = 0
  // We solve for r using Newton-Raphson
  let r = 0.03 // initial guess 3% mensual

  for (let i = 0; i < maxIterations; i++) {
    const rp1 = 1 + r
    const rp1n = Math.pow(rp1, termMonths)
    const num = capital * r * rp1n
    const den = rp1n - 1
    const f = num / den - desiredInstallment

    // Derivative: d/dr [P * r * (1+r)^n / ((1+r)^n - 1)]
    // Using quotient rule
    const dNum = capital * (rp1n + r * termMonths * Math.pow(rp1, termMonths - 1))
    const dDen = termMonths * Math.pow(rp1, termMonths - 1)
    const df = (dNum * den - num * dDen) / (den * den)

    if (Math.abs(df) < 1e-15) break

    const newR = r - f / df

    if (Math.abs(newR - r) < tolerance) {
      if (newR <= 0) return null
      const tna = monthlyRateToTNA(newR)
      return { monthlyRate: newR, tna }
    }

    r = newR
    if (r <= 0) r = 0.001 // clamp to avoid negative rates
  }

  if (r <= 0) return null
  return { monthlyRate: r, tna: monthlyRateToTNA(r) }
}

// ─── Bullet (Discount Accrual) ───────────────────────────────────────

/**
 * Calcula el valor nominal de un bullet dado capital y TNA
 * VN = P * (1 + TNA)^(n/12)
 */
export function bulletNominalValue(capital: number, tna: number, termMonths: number): number {
  return new Decimal(capital).mul(
    new Decimal(1 + tna).pow(new Decimal(termMonths).div(12))
  ).toNumber()
}

/**
 * Genera el resumen mensual de devengamiento bullet
 */
export function generateBulletMonthlySummary(
  capital: number,
  nominalValue: number,
  termMonths: number,
  accrualType: AccrualType,
  tna: number,
  startDate: string,
): BulletMonthlySummary[] {
  const summary: BulletMonthlySummary[] = []
  const start = new Date(startDate)
  const P = new Decimal(capital)
  const VN = new Decimal(nominalValue)
  const totalReturn = VN.minus(P)
  let prevAccrued = new Decimal(0)

  for (let m = 1; m <= termMonths; m++) {
    let accruedValue: Decimal

    if (accrualType === 'linear') {
      // Linear: accrued = P + (VN - P) * (m / n)
      accruedValue = P.plus(totalReturn.mul(m).div(termMonths))
    } else {
      // Exponential: accrued = P * (1 + TNA)^(m/12)
      accruedValue = P.mul(new Decimal(1 + tna).pow(new Decimal(m).div(12)))
    }

    const monthlyAccrual = accruedValue.minus(P).minus(prevAccrued)
    prevAccrued = accruedValue.minus(P)

    const date = new Date(start)
    date.setMonth(date.getMonth() + m)

    summary.push({
      month: m,
      date: formatDate(date),
      accruedValue: round2(accruedValue.toNumber()),
      monthlyAccrual: round2(monthlyAccrual.toNumber()),
      accruedReturn: round2(accruedValue.minus(P).toNumber()),
    })
  }

  return summary
}

// ─── TIR (IRR) Calculation via Newton-Raphson ────────────────────────

/**
 * Calcula la TIR mensual de un flujo de fondos usando Newton-Raphson
 * cashFlows[0] = inversión inicial (negativo)
 * cashFlows[1..n] = cobros mensuales
 */
export function calculateIRR(cashFlows: number[], maxIterations = 100, tolerance = 1e-10): number {
  let rate = 0.05 // Initial guess: 5% mensual

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0
    let dnpv = 0

    for (let t = 0; t < cashFlows.length; t++) {
      const denom = Math.pow(1 + rate, t)
      npv += cashFlows[t] / denom
      if (t > 0) {
        dnpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1)
      }
    }

    if (Math.abs(dnpv) < 1e-15) break

    const newRate = rate - npv / dnpv

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate
    }

    rate = newRate
  }

  return rate
}

// ─── Strategic Rounding ──────────────────────────────────────────────

/**
 * Función A: Redondeo puro hacia arriba al múltiplo más cercano.
 */
export function roundUpToMultiple(amount: number, multiple = 100): number {
  return Math.ceil(amount / multiple) * multiple
}

/**
 * Función C: Valida que una cuota dada produce TIR ≥ TNA objetivo.
 */
export function validateInstallmentYield(
  capital: number,
  termMonths: number,
  installment: number,
  minTNA: number,
): boolean {
  const cashFlows = [-capital, ...Array(termMonths).fill(installment)]
  const tirMonthly = calculateIRR(cashFlows)
  const tirTNA = monthlyRateToTNA(tirMonthly)
  return tirTNA >= minTNA
}

/**
 * Función B+C: Redondeo estratégico + validación.
 * Redondea hacia arriba y verifica que la TIR no caiga por debajo de la TNA objetivo.
 * En el caso extremo de que el redondeo no sea suficiente, sube al siguiente múltiplo.
 */
export function strategicRoundInstallment(
  capital: number,
  termMonths: number,
  exactInstallment: number,
  minTNA: number,
  multiple = 100,
): number {
  let rounded = roundUpToMultiple(exactInstallment, multiple)

  // Safety: bump up if rounding somehow reduces yield below floor (edge case)
  let attempts = 0
  while (!validateInstallmentYield(capital, termMonths, rounded, minTNA) && attempts < 10) {
    rounded += multiple
    attempts++
  }

  return rounded
}

// ─── Main Simulation Engine ──────────────────────────────────────────

export function simulateLoan(input: LoanInput): SimulationResult {
  const {
    capital,
    termMonths,
    tnaTarget,
    hurdleRate,
    loanType,
    accrualType,
    customInstallment,
    startDate,
  } = input

  const monthlyRate = tnaToMonthlyRate(tnaTarget)
  const dailyRate = tnaToDailyRate(tnaTarget)
  const hurdleMonthlyRate = tnaToMonthlyRate(hurdleRate)

  const base: Partial<SimulationResult> = {
    loanType,
    capital,
    termMonths,
    tnaTarget,
    hurdleRate,
    monthlyRate,
    dailyRate,
    hurdleMonthlyRate,
  }

  if (loanType === 'amortized') {
    return simulateAmortized({ ...input, monthlyRate, hurdleMonthlyRate }, base)
  } else {
    return simulateBullet({ ...input, monthlyRate, dailyRate, hurdleMonthlyRate }, base)
  }
}

function simulateAmortized(
  input: LoanInput & { monthlyRate: number; hurdleMonthlyRate: number },
  base: Partial<SimulationResult>,
): SimulationResult {
  const { capital, termMonths, monthlyRate, customInstallment, startDate, hurdleRate, tnaTarget, roundingMultiple } = input

  const exactInstallment = customInstallment && customInstallment > 0
    ? customInstallment
    : frenchInstallment(capital, monthlyRate, termMonths)

  // Strategic rounding: round up to nearest multiple, validate TIR >= TNA target
  const roundedInstallmentAmount = roundingMultiple && roundingMultiple > 0
    ? strategicRoundInstallment(capital, termMonths, exactInstallment, tnaTarget, roundingMultiple)
    : undefined

  // When rounding is enabled, use rounded amount for everything (table, TIR, totals)
  const installmentAmount = roundedInstallmentAmount ?? exactInstallment

  const table = generateAmortizationTable(capital, monthlyRate, termMonths, installmentAmount, startDate)
  const totalPaid = round2(installmentAmount * termMonths)

  // Cash flows for IRR: negative capital, then positive installments
  const cashFlows = [-capital, ...table.map(() => installmentAmount)]
  const tirMonthly = calculateIRR(cashFlows)
  const tirEffective = monthlyToAnnualRate(tirMonthly)
  const tirTNA = monthlyRateToTNA(tirMonthly)
  const hurdleTirTNA = hurdleRate
  const spread = round2((tirTNA - hurdleTirTNA) * 100) // in percentage points

  // Accrued curve: cumulative interest received
  const accruedCurve = [
    { month: 0, value: 0 },
    ...table.map(row => ({ month: row.month, value: row.accruedReturn })),
  ]

  return {
    ...base,
    installmentAmount: round2(installmentAmount),
    roundedInstallmentAmount: roundedInstallmentAmount ?? round2(exactInstallment),
    amortizationTable: table,
    totalPaid,
    tirEffective,
    tirTNA,
    hurdleTirTNA,
    spread,
    isConvenient: tirTNA >= hurdleTirTNA,
    accruedCurve,
  } as SimulationResult
}

function simulateBullet(
  input: LoanInput & { monthlyRate: number; dailyRate: number; hurdleMonthlyRate: number },
  base: Partial<SimulationResult>,
): SimulationResult {
  const { capital, termMonths, tnaTarget, accrualType, startDate, hurdleRate } = input

  const nominalValue = round2(bulletNominalValue(capital, tnaTarget, termMonths))
  const discountPrice = capital

  const monthlySummary = generateBulletMonthlySummary(
    capital, nominalValue, termMonths, accrualType, tnaTarget, startDate,
  )

  // Cash flows for IRR: pay capital today, receive nominal at end
  const cashFlows = [-capital, ...Array(termMonths - 1).fill(0), nominalValue]
  const tirMonthly = calculateIRR(cashFlows)
  const tirEffective = monthlyToAnnualRate(tirMonthly)
  const tirTNA = monthlyRateToTNA(tirMonthly)
  const hurdleTirTNA = hurdleRate
  const spread = round2((tirTNA - hurdleTirTNA) * 100)

  // Accrued curve
  const accruedCurve = [
    { month: 0, value: 0 },
    ...monthlySummary.map(row => ({ month: row.month, value: row.accruedReturn })),
  ]

  return {
    ...base,
    nominalValue,
    discountPrice,
    bulletMonthlySummary: monthlySummary,
    tirEffective,
    tirTNA,
    hurdleTirTNA,
    spread,
    isConvenient: tirTNA >= hurdleTirTNA,
    accruedCurve,
  } as SimulationResult
}

// ─── Comparison Helper ───────────────────────────────────────────────

export interface ComparisonResult {
  amortized: SimulationResult
  bullet: SimulationResult
  tirDifference: number       // amortized TIR - bullet TIR (pp)
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

// ─── Helpers ─────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
