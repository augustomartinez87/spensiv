import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/'])

const isAdminOnlyRoute = createRouteMatcher([
  '/dashboard/loans(.*)',
  '/dashboard/portfolio(.*)',
  '/dashboard/persons(.*)',
  '/dashboard/simulator(.*)',
  '/dashboard/admin(.*)',
])

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect()
  }

  const { userId, sessionClaims } = auth()
  if (!userId) return

  const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role

  if (isAdminOnlyRoute(request) && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
