import { router } from '@/lib/trpc'
import { cardsRouter } from './routers/cards'
import { transactionsRouter } from './routers/transactions'
import { dashboardRouter } from './routers/dashboard'
import { incomesRouter } from './routers/incomes'

/**
 * Router principal de la aplicación
 */
export const appRouter = router({
  cards: cardsRouter,
  transactions: transactionsRouter,
  incomes: incomesRouter,
  dashboard: dashboardRouter,
})

export type AppRouter = typeof appRouter

