/**
 * Returns the Nth business day (Mon–Fri) of a given month.
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
    if (dow !== 0 && dow !== 6) {
      count++
      if (count === n) return date
    }
  }

  throw new Error(`Month ${year}-${String(month).padStart(2, '0')} has fewer than ${n} business days`)
}

/**
 * Returns the first due date under the "primer vencimiento inteligente" rule:
 * - Target: 5th business day of the month following startDate.
 * - If the gap between startDate and that date is < 25 days, skip to the month after.
 */
export function getSmartFirstDueDate(startDate: Date): Date {
  let year = startDate.getFullYear()
  let month = startDate.getMonth() + 2 // +1 for 0-indexed→1-indexed, +1 for next month

  if (month > 12) {
    month = 1
    year++
  }

  const candidate = getNthBusinessDay(year, month, 5)
  const diffDays = (candidate.getTime() - startDate.getTime()) / 86_400_000

  if (diffDays < 25) {
    month++
    if (month > 12) {
      month = 1
      year++
    }
    return getNthBusinessDay(year, month, 5)
  }

  return candidate
}

/**
 * Returns an array of N smart due dates (5th business day of each consecutive month)
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
    dates.push(getNthBusinessDay(y, m, 5))
  }

  return dates
}
