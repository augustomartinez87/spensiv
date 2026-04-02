import { mergeRouters } from '@/lib/trpc'
import { loanSimulationRouter } from './simulation'
import { loanCrudRouter } from './crud'
import { loanOperationsRouter } from './operations'
import { loanDashboardRouter } from './dashboard'
import { loanAttachmentsRouter } from './attachments'

export const loansRouter = mergeRouters(
  loanSimulationRouter,
  loanCrudRouter,
  loanOperationsRouter,
  loanDashboardRouter,
  loanAttachmentsRouter,
)
