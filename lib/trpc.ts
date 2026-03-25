import { initTRPC, TRPCError } from '@trpc/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import superjson from 'superjson'
import { prisma } from './prisma'

/**
 * Crear contexto para tRPC
 * userCache memoizes user lookup per request so batched procedures
 * only hit the DB once for auth instead of N times.
 */
export const createTRPCContext = async () => {
  const { userId } = await auth()

  const userCache = new Map<string, any>()

  return {
    prisma,
    userId,
    userCache,
  }
}

/**
 * Inicialización de tRPC
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
})

/**
 * Router y procedimientos públicos
 */
export const router = t.router
export const mergeRouters = t.mergeRouters
export const publicProcedure = t.procedure

/**
 * Middleware para rutas protegidas
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  // Buscar o crear usuario (memoized per request for batched calls)
  let user = ctx.userCache.get(ctx.userId)

  if (!user) {
    user = await ctx.prisma.user.findUnique({
      where: { clerkId: ctx.userId },
    })

    if (!user) {
      // Auto-create user on first request
      const clerkUser = await currentUser()
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress

      if (!email) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email not found' })
      }

      user = await ctx.prisma.user.create({
        data: {
          clerkId: ctx.userId,
          email,
        },
      })
    }

    ctx.userCache.set(ctx.userId, user)
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      user,
    },
  })
})

/**
 * Procedimiento protegido (requiere auth)
 */
export const protectedProcedure = t.procedure.use(isAuthed)

/**
 * Middleware para rutas de administrador
 * Verifica que el usuario tenga role: 'admin' en Clerk publicMetadata
 */
const isAdminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  const clerkUser = await currentUser()
  if (clerkUser?.publicMetadata?.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Se requieren permisos de administrador',
    })
  }

  let user = ctx.userCache.get(ctx.userId)
  if (!user) {
    user = await ctx.prisma.user.findUnique({ where: { clerkId: ctx.userId } })
    if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' })
    ctx.userCache.set(ctx.userId, user)
  }

  return next({ ctx: { ...ctx, userId: ctx.userId, user } })
})

/**
 * Procedimiento solo para admins
 */
export const adminProcedure = t.procedure.use(isAdminMiddleware)
