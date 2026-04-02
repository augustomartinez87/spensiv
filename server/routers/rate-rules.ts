import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'

const DEFAULT_DURATION_BRACKETS = [
  { minMonths: 0, maxMonths: 3, adjustment: 0 },
  { minMonths: 3, maxMonths: 6, adjustment: 5 },
  { minMonths: 6, maxMonths: 9, adjustment: 10 },
  { minMonths: 9, maxMonths: 12, adjustment: 15 },
  { minMonths: 12, maxMonths: 360, adjustment: 50 },
]

export const rateRulesRouter = router({
  // ── Borrower Types ──────────────────────────────────────────────────

  listBorrowerTypes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.borrowerType.findMany({
      where: { userId: ctx.user.id },
      orderBy: { order: 'asc' },
    })
  }),

  upsertBorrowerType: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        baseTna: z.number().min(0),
        order: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const existing = await ctx.prisma.borrowerType.findFirst({
          where: { id: input.id, userId: ctx.user.id },
        })
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tipo no encontrado' })
        }
        return ctx.prisma.borrowerType.update({
          where: { id: input.id },
          data: { name: input.name, baseTna: input.baseTna, order: input.order ?? existing.order },
        })
      }

      const count = await ctx.prisma.borrowerType.count({ where: { userId: ctx.user.id } })
      return ctx.prisma.borrowerType.create({
        data: {
          userId: ctx.user.id,
          name: input.name,
          baseTna: input.baseTna,
          order: input.order ?? count,
        },
      })
    }),

  deleteBorrowerType: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.borrowerType.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      })
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tipo no encontrado' })
      }
      return ctx.prisma.borrowerType.delete({ where: { id: input.id } })
    }),

  // ── Duration Adjustments ────────────────────────────────────────────

  listDurationAdjustments: protectedProcedure.query(async ({ ctx }) => {
    const adjustments = await ctx.prisma.durationAdjustment.findMany({
      where: { userId: ctx.user.id },
      orderBy: { minMonths: 'asc' },
    })

    // Seed defaults if empty
    if (adjustments.length === 0) {
      const created = await ctx.prisma.$transaction(
        DEFAULT_DURATION_BRACKETS.map((b) =>
          ctx.prisma.durationAdjustment.create({
            data: { userId: ctx.user.id, ...b },
          })
        )
      )
      return created
    }

    return adjustments
  }),

  upsertDurationAdjustment: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        minMonths: z.number().int().min(0),
        maxMonths: z.number().int().min(1),
        adjustment: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.minMonths >= input.maxMonths) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El mínimo debe ser menor al máximo',
        })
      }

      if (input.id) {
        const existing = await ctx.prisma.durationAdjustment.findFirst({
          where: { id: input.id, userId: ctx.user.id },
        })
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tramo no encontrado' })
        }
        return ctx.prisma.durationAdjustment.update({
          where: { id: input.id },
          data: {
            minMonths: input.minMonths,
            maxMonths: input.maxMonths,
            adjustment: input.adjustment,
          },
        })
      }

      return ctx.prisma.durationAdjustment.create({
        data: {
          userId: ctx.user.id,
          minMonths: input.minMonths,
          maxMonths: input.maxMonths,
          adjustment: input.adjustment,
        },
      })
    }),

  deleteDurationAdjustment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.durationAdjustment.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      })
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tramo no encontrado' })
      }
      return ctx.prisma.durationAdjustment.delete({ where: { id: input.id } })
    }),

  // ── Public Simulator Config ─────────────────────────────────────────

  getPublicSimulatorConfig: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.publicSimulatorConfig.findUnique({
      where: { userId: ctx.user.id },
    })
  }),

  upsertPublicSimulatorConfig: protectedProcedure
    .input(
      z.object({
        tna: z.number().min(0),
        currency: z.enum(['ARS', 'USD']),
        terms: z.string().min(1),
        whatsapp: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.publicSimulatorConfig.upsert({
        where: { userId: ctx.user.id },
        create: {
          userId: ctx.user.id,
          tna: input.tna,
          currency: input.currency,
          terms: input.terms,
          whatsapp: input.whatsapp,
        },
        update: {
          tna: input.tna,
          currency: input.currency,
          terms: input.terms,
          whatsapp: input.whatsapp,
        },
      })
    }),

  // ── Rate Suggestion ─────────────────────────────────────────────────

  getSuggestedRate: protectedProcedure
    .input(
      z.object({
        borrowerTypeId: z.string(),
        termMonths: z.number().int().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const borrowerType = await ctx.prisma.borrowerType.findFirst({
        where: { id: input.borrowerTypeId, userId: ctx.user.id },
      })
      if (!borrowerType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tipo no encontrado' })
      }

      const adjustment = await ctx.prisma.durationAdjustment.findFirst({
        where: {
          userId: ctx.user.id,
          minMonths: { lte: input.termMonths },
          maxMonths: { gte: input.termMonths },
        },
        orderBy: { minMonths: 'desc' },
      })

      const baseTna = Number(borrowerType.baseTna)
      const durationAdj = adjustment ? Number(adjustment.adjustment) : 0

      return {
        baseTna,
        durationAdjustment: durationAdj,
        suggestedTna: baseTna + durationAdj,
        borrowerTypeName: borrowerType.name,
      }
    }),
})
