import { router } from '@/lib/trpc'
import { cardsRouter } from './routers/cards'
import { transactionsRouter } from './routers/transactions'
import { dashboardRouter } from './routers/dashboard'
import { incomesRouter } from './routers/incomes'
import { loansRouter } from './routers/loans'
import { personsRouter } from './routers/persons'
import { portfolioRouter } from './routers/portfolio'
import { thirdPartyPurchasesRouter } from './routers/third-party-purchases'
import { budgetRouter } from './routers/budget'
import { adminRouter } from './routers/admin'
import { shareRouter } from './routers/share'

export const appRouter = router({
  cards: cardsRouter,
  transactions: transactionsRouter,
  dashboard: dashboardRouter,
  incomes: incomesRouter,
  loans: loansRouter,
  persons: personsRouter,
  portfolio: portfolioRouter,
  thirdPartyPurchases: thirdPartyPurchasesRouter,
  budget: budgetRouter,
  admin: adminRouter,
  share: shareRouter,
})

export type AppRouter = typeof appRouter
