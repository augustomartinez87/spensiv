import { router } from '@/lib/trpc'
import { cardsRouter } from './routers/cards'
import { transactionsRouter } from './routers/transactions'
import { dashboardRouter } from './routers/dashboard'
import { incomesRouter } from './routers/incomes'
import { importRouter } from './routers/import'
import { loansRouter } from './routers/loans'
import { personsRouter } from './routers/persons'
import { portfolioRouter } from './routers/portfolio'

export const appRouter = router({
  cards: cardsRouter,
  transactions: transactionsRouter,
  dashboard: dashboardRouter,
  incomes: incomesRouter,
  import: importRouter,
  loans: loansRouter,
  persons: personsRouter,
  portfolio: portfolioRouter,
})

export type AppRouter = typeof appRouter
