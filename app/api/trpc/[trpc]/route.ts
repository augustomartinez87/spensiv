import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server'
import { createTRPCContext } from '@/lib/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError: ({ path, error }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[tRPC] ${path ?? 'unknown'}:`, error)
      }
    },
  })

export { handler as GET, handler as POST }
