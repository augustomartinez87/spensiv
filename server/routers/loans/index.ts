import { mergeRouters } from '@/lib/trpc'
import { loanSimulationRouter } from './simulation'
import { loanCrudRouter } from './crud'
import { loanOperationsRouter } from './operations'
import { loanDashboardRouter } from './dashboard'

export const loansRouter = mergeRouters(
  loanSimulationRouter,
  loanCrudRouter,
  loanOperationsRouter,
  loanDashboardRouter,
)
