import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/', '/share(.*)', '/simular(.*)', '/api/trpc/share(.*)', '/api/trpc/publicSimulator(.*)'])

const PUBLIC_TRPC_PROCEDURES = ['share', 'publicSimulator']

function isTRPCPublicBatch(request: Request): boolean {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/trpc')) return false
  // tRPC batch: procedure names come in the path or as ?batch=1 with input in query
  const pathProcedure = url.pathname.split('/api/trpc/')[1]?.split('?')[0] ?? ''
  if (PUBLIC_TRPC_PROCEDURES.some((p) => pathProcedure.startsWith(p))) return true
  // batch mode: procedure is encoded in the path before the query string
  return false
}

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request) && !isTRPCPublicBatch(request)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
