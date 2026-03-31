import { BUDGET_HIGH_EXPENSE_PCT, BUDGET_SAVINGS_MARGIN } from './constants/thresholds'

// ── Period validation & budget percentage ───────────────────────────

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

// ── Budget status ───────────────────────────────────────────────────

export type BudgetStatusLevel = 'deficit' | 'warning' | 'healthy'

export interface BudgetStatus {
  level: BudgetStatusLevel
  message: string
  savingsPotential: number
  expensePercentage: number
}

/**
 * Determines the budget health status for a given period based on
 * income vs expense ratios.
 */
export function getBudgetStatus(
  balance: number,
  totalIncome: number,
  totalExpense: number,
  formatCurrency: (amount: number) => string,
): BudgetStatus {
  const expensePercentage = totalIncome > 0
    ? (totalExpense / totalIncome) * 100
    : 0

  const savingsPotential = totalIncome - totalExpense * BUDGET_SAVINGS_MARGIN

  if (balance < 0) {
    return {
      level: 'deficit',
      message: 'Estás en déficit',
      savingsPotential,
      expensePercentage,
    }
  }

  if (expensePercentage > BUDGET_HIGH_EXPENSE_PCT) {
    return {
      level: 'warning',
      message: 'Cuidado con los gastos',
      savingsPotential,
      expensePercentage,
    }
  }

  return {
    level: 'healthy',
    message: savingsPotential > 0
      ? `Podrías ahorrar ${formatCurrency(savingsPotential)}`
      : 'Vas por buen camino',
    savingsPotential,
    expensePercentage,
  }
}
