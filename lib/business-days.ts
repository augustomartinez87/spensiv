// Feriados nacionales AR. Actualizar cada diciembre con el decreto oficial
// del año entrante (incluye inamovibles + trasladables anunciados).
// Si querés evitar programar cuotas en "días no laborables con fines
// turísticos" (puentes), agregalos acá también.
export const AR_HOLIDAYS = new Set<string>([
  // 2025
  '2025-01-01', // Año Nuevo
  '2025-03-03', // Carnaval
  '2025-03-04', // Carnaval
  '2025-03-24', // Memoria, Verdad y Justicia
  '2025-04-02', // Malvinas
  '2025-04-18', // Viernes Santo
  '2025-05-01', // Día del Trabajador
  '2025-05-25', // Revolución de Mayo
  '2025-06-16', // Güemes (trasladado)
  '2025-06-20', // Bandera
  '2025-07-09', // Independencia
  '2025-08-17', // San Martín
  '2025-10-12', // Diversidad Cultural
  '2025-11-24', // Soberanía (trasladado)
  '2025-12-08', // Inmaculada
  '2025-12-25', // Navidad

  // 2026
  '2026-01-01', // Año Nuevo
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-03-24', // Memoria, Verdad y Justicia
  '2026-04-02', // Malvinas
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-25', // Revolución de Mayo
  '2026-06-15', // Güemes (trasladado del miércoles 17)
  '2026-06-20', // Bandera (sábado, inamovible)
  '2026-07-09', // Independencia
  '2026-08-17', // San Martín
  '2026-10-12', // Diversidad Cultural
  '2026-11-20', // Soberanía (viernes, sin traslado)
  '2026-12-08', // Inmaculada
  '2026-12-25', // Navidad

  // 2027 — inamovibles. Completar con trasladables cuando salga el decreto oficial.
  '2027-01-01', // Año Nuevo
  '2027-03-24', // Memoria, Verdad y Justicia
  '2027-03-26', // Viernes Santo
  '2027-04-02', // Malvinas
  '2027-05-01', // Día del Trabajador
  '2027-05-25', // Revolución de Mayo
  '2027-06-20', // Bandera
  '2027-07-09', // Independencia
  '2027-12-08', // Inmaculada
  '2027-12-25', // Navidad
])

function toIsoLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isArHoliday(date: Date): boolean {
  return AR_HOLIDAYS.has(toIsoLocal(date))
}

/**
 * Returns the Nth business day of a given month, skipping weekends and AR holidays.
 * @param year  Full year (e.g. 2026)
 * @param month 1-indexed month (1 = January, 12 = December)
 * @param n     Which business day to return (e.g. 5 = fifth)
 */
export function getNthBusinessDay(year: number, month: number, n: number): Date {
  let count = 0
  const totalDays = new Date(year, month, 0).getDate() // month is 1-indexed: new Date(y, m, 0) = last day of month m

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month - 1, day)
    const dow = date.getDay() // 0 = Sunday, 6 = Saturday
    if (dow === 0 || dow === 6) continue
    if (isArHoliday(date)) continue
    count++
    if (count === n) return date
  }

  throw new Error(`Month ${year}-${String(month).padStart(2, '0')} has fewer than ${n} business days`)
}

/**
 * Returns the first due date under the "primer vencimiento inteligente" rule:
 * - Target: 2nd business day of the month following startDate.
 * - If the gap between startDate and that date is < 25 days, skip to the month after.
 */
export function getSmartFirstDueDate(startDate: Date): Date {
  let year = startDate.getFullYear()
  let month = startDate.getMonth() + 2 // +1 for 0-indexed→1-indexed, +1 for next month

  if (month > 12) {
    month = 1
    year++
  }

  const candidate = getNthBusinessDay(year, month, 2)
  const diffDays = (candidate.getTime() - startDate.getTime()) / 86_400_000

  if (diffDays < 25) {
    month++
    if (month > 12) {
      month = 1
      year++
    }
    return getNthBusinessDay(year, month, 2)
  }

  return candidate
}

/**
 * Returns an array of N smart due dates (2nd business day of each consecutive month)
 * starting from the first valid due date for the given startDate.
 */
export function getSmartDueDates(startDate: Date, termMonths: number): Date[] {
  const first = getSmartFirstDueDate(startDate)
  const firstYear = first.getFullYear()
  const firstMonth = first.getMonth() + 1 // 1-indexed

  const dates: Date[] = [first]

  for (let i = 1; i < termMonths; i++) {
    let m = firstMonth + i
    let y = firstYear
    while (m > 12) {
      m -= 12
      y++
    }
    dates.push(getNthBusinessDay(y, m, 2))
  }

  return dates
}

/**
 * Returns an array of N smart due dates starting from a fixed first due date.
 * The first date is used as-is, and subsequent dates are the 2nd business day
 * of consecutive months.
 */
export function getSmartDueDatesFromFirst(firstDueDate: Date, termMonths: number): Date[] {
  const dates: Date[] = [firstDueDate]
  const firstMonth = firstDueDate.getMonth() + 1 // 1-indexed
  const firstYear = firstDueDate.getFullYear()

  for (let i = 1; i < termMonths; i++) {
    let m = firstMonth + i
    let y = firstYear
    while (m > 12) { m -= 12; y++ }
    dates.push(getNthBusinessDay(y, m, 2))
  }

  return dates
}

// ─── Smart amortization schedule ─────────────────────────────────────────────

export interface SmartScheduleRow {
  period: number
  dueDate: string  // ISO YYYY-MM-DD
  days: number     // actual calendar days in this period
  installment: number
  interest: number
  principal: number
  balance: number
}

export interface SmartScheduleResult {
  schedule: SmartScheduleRow[]
  installmentAmount: number
  totalPaid: number
  effectiveTna: number  // TNA recalculated after rounding (equals input TNA if no rounding)
}

/**
 * Generates an amortization schedule for irregular periods using actual-day interest accrual.
 *
 * Formula:
 *   interest_i = balance_i × (TNA / 365) × days_i
 *
 * The fixed installment that exactly amortizes the capital is solved in closed form:
 *   C = capital / Σ DF_i
 *   where DF_i = Π_{j=1..i} 1 / (1 + TNA/365 × days_j)
 *
 * The last period adjusts to close the balance to exactly 0.
 */
export function generateSmartSchedule(
  capital: number,
  tna: number,
  startDate: Date,
  dueDates: Date[],
  roundingMultiple = 0,
): SmartScheduleResult {
  const dailyRate = tna / 365
  const n = dueDates.length

  // Actual calendar days per period
  const periodDays = dueDates.map((d, i) => {
    const prev = i === 0 ? startDate : dueDates[i - 1]
    return Math.round((d.getTime() - prev.getTime()) / 86_400_000)
  })

  // Period simple-interest rates: r_i = dailyRate × days_i
  const periodRates = periodDays.map(d => dailyRate * d)

  // Cumulative discount factors: DF_i = Π_{j=0..i} 1/(1 + r_j)
  let cumDF = 1
  let sumDF = 0
  for (const r of periodRates) {
    cumDF /= (1 + r)
    sumDF += cumDF
  }

  // Exact installment (closed-form)
  const exactInstallment = capital / sumDF

  let effectiveDailyRate = dailyRate

  // Apply rounding (ceiling to multiple)
  let installment = roundingMultiple > 0
    ? Math.ceil(exactInstallment / roundingMultiple) * roundingMultiple
    : exactInstallment

  // If rounding changed the installment, recalculate the daily rate so all
  // installments (including the last) are exactly equal.
  // Solve: capital = installment × Σ_i DF_i(dr), where DF_i = Π_{k=0..i} 1/(1+dr×days_k)
  if (roundingMultiple > 0 && installment !== exactInstallment) {
    let dr = dailyRate
    for (let iter = 0; iter < 300; iter++) {
      let cumDF = 1, sumDF = 0, dSumDF = 0
      for (let j = 0; j < n; j++) {
        cumDF /= (1 + dr * periodDays[j])
        sumDF += cumDF
        // d(DF_j)/d(dr) = DF_j × (−Σ_{k=0..j} days_k / (1 + dr×days_k))
        let innerSum = 0
        for (let k = 0; k <= j; k++) {
          innerSum += periodDays[k] / (1 + dr * periodDays[k])
        }
        dSumDF += -cumDF * innerSum
      }
      const f = installment * sumDF - capital
      const df = installment * dSumDF
      if (Math.abs(df) < 1e-20) break
      const delta = f / df
      dr -= delta
      if (dr < 1e-12) dr = 1e-12
      if (Math.abs(delta) < 1e-14) break
    }
    for (let i = 0; i < n; i++) {
      periodRates[i] = dr * periodDays[i]
    }
    // Update effective daily rate for TNA output
    effectiveDailyRate = dr
  }

  // Build schedule
  const schedule: SmartScheduleRow[] = []
  let balance = capital
  let totalPaid = 0

  for (let i = 0; i < n; i++) {
    const interest = balance * periodRates[i]
    const isLast = i === n - 1
    // Last period: close balance (may differ by sub-cent due to float)
    const cuota = isLast ? balance + interest : installment
    const principal = cuota - interest

    balance = isLast ? 0 : balance - principal
    totalPaid += cuota

    schedule.push({
      period: i + 1,
      dueDate: fmtDate(dueDates[i]),
      days: periodDays[i],
      installment: cuota,
      interest,
      principal,
      balance: Math.max(0, balance),
    })
  }

  return { schedule, installmentAmount: installment, totalPaid, effectiveTna: effectiveDailyRate * 365 }
}

// ─── XIRR ────────────────────────────────────────────────────────────────────

/**
 * Calculates the effective annual IRR (XIRR) for cash flows at irregular dates.
 * Uses Newton-Raphson on: NPV = Σ CF_i / (1+rate)^(t_i / 365.25)
 *
 * @param dates      dates[0] = investment date (same as startDate)
 * @param cashFlows  cashFlows[0] = -capital (negative), rest = installments
 */
export function calculateXIRR(
  dates: Date[],
  cashFlows: number[],
  maxIterations = 300,
  tolerance = 1e-10,
): number {
  const t0 = dates[0].getTime()
  const yearFracs = dates.map(d => (d.getTime() - t0) / (365.25 * 86_400_000))

  let rate = 1.0  // initial guess: 100% effective annual (reasonable for AR)

  for (let iter = 0; iter < maxIterations; iter++) {
    let npv = 0
    let dnpv = 0

    for (let i = 0; i < cashFlows.length; i++) {
      const t = yearFracs[i]
      if (t === 0) { npv += cashFlows[i]; continue }
      const factor = Math.pow(1 + rate, t)
      npv  += cashFlows[i] / factor
      dnpv -= cashFlows[i] * t / (factor * (1 + rate))
    }

    if (Math.abs(dnpv) < 1e-14) break
    const delta = npv / dnpv
    rate -= delta
    if (rate < -0.9999) rate = -0.9999
    if (rate > 200) rate = 200
    if (Math.abs(delta) < tolerance) break
  }

  return rate
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
