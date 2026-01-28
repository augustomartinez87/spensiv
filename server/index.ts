import { router } from '@/lib/trpc'
import { cardsRouter } from './routers/cards'
import { transactionsRouter } from './routers/transactions'
import { dashboardRouter } from './routers/dashboard'

/**
 * Router principal de la aplicación
 */
export const appRouter = router({
  cards: cardsRouter,
  transactions: transactionsRouter,
  dashboard: dashboardRouter,
})

export type AppRouter = typeof appRouter
