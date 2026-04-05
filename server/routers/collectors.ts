import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/lib/trpc'

const collectorInput = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  notes: z.string().optional(),
})

export const collectorsRouter = router({
  create: protectedProcedure
    .input(collectorInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.collector.create({
        data: {
          userId: ctx.user.id,
          name: input.name,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(collectorInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const existing = await ctx.prisma.collector.findFirst({
        where: { id, userId: ctx.user.id },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cobrador no encontrado' })

      return ctx.prisma.collector.update({
        where: { id },
        data,
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.collector.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cobrador no encontrado' })

      // Nullify collectorId on associated loans instead of blocking delete
      await ctx.prisma.loan.updateMany({
        where: { collectorId: input.id },
        data: { collectorId: null },
      })

      await ctx.prisma.collector.delete({ where: { id: input.id } })
      return { success: true }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const collectors = await ctx.prisma.collector.findMany({
      where: { userId: ctx.user.id },
      include: {
        loans: {
          where: { status: 'active' },
          select: { id: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return collectors.map((c) => ({
      ...c,
      activeLoanCount: c.loans.length,
    }))
  }),
})
