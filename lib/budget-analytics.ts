import { BUDGET_HIGH_EXPENSE_PCT, BUDGET_SAVINGS_MARGIN } from './constants/thresholds'

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
