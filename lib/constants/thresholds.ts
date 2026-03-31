// ── Morosity ────────────────────────────────────────────────────────
/** Below this percentage, morosity is considered healthy (green) */
export const MOROSITY_WARNING_PCT = 5
/** Above this percentage, morosity is considered critical (red) */
export const MOROSITY_DANGER_PCT = 15

// ── Budget ──────────────────────────────────────────────────────────
/** Expense-to-income ratio (%) that triggers a budget warning */
export const BUDGET_HIGH_EXPENSE_PCT = 80
/** Margin multiplier used to estimate savings potential (1.1 = 10% buffer) */
export const BUDGET_SAVINGS_MARGIN = 1.1

// ── Overdue detection ───────────────────────────────────────────────
/** Days past due date before an installment is considered overdue for portfolio metrics */
export const OVERDUE_DETECTION_DAYS = 15
