import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/server'

type RouterOutput = inferRouterOutputs<AppRouter>

/** Full loan as returned by loans.getById */
export type LoanDetail = RouterOutput['loans']['getById']

/** A single loan installment from the detail view */
export type LoanInstallment = LoanDetail['loanInstallments'][number]

/** A single activity log entry */
export type ActivityLog = LoanDetail['activityLogs'][number]

/** A loan from the list endpoint */
export type LoanListItem = RouterOutput['loans']['list'][number]
