import { initTRPC, TRPCError } from '@trpc/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import superjson from 'superjson'
import { prisma } from './prisma'

/**
 * Crear contexto para tRPC
 */
export const createTRPCContext = async () => {
  const { userId } = await auth()

  return {
    prisma,
    userId,
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
export const publicProcedure = t.procedure

/**
 * Middleware para rutas protegidas
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  // Buscar o crear usuario
  let user = await ctx.prisma.user.findUnique({
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
