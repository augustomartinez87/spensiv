const PERIOD_REGEX = /^\d{4}-\d{2}$/

export function isValidPeriod(period: string): boolean {
  if (!PERIOD_REGEX.test(period)) return false

  const [, monthStr] = period.split('-')
  const month = Number.parseInt(monthStr, 10)
  return month >= 1 && month <= 12
}

export function getPeriodDateRange(period: string): { startDate: Date; endDate: Date } {
  if (!isValidPeriod(period)) {
    throw new Error('Periodo inválido. Formato esperado: YYYY-MM con mes 01-12')
  }

  const [yearStr, monthStr] = period.split('-')
  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)

  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 1),
  }
}

export function calculateBudgetPercentage(spent: number, monthlyLimit: number): number {
  if (monthlyLimit <= 0) return 0
  return (spent / monthlyLimit) * 100
}

