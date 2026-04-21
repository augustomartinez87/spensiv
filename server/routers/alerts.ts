import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'

const alertTypeEnum = z.enum([
  'closing_date',
  'due_date',
  'high_spending',
  'limit_approaching',
])

/**
 * Tipos de alerta que requieren threshold (monto):
 * - high_spending: threshold representa el monto a partir del cual alertar
 * - limit_approaching: threshold representa el porcentaje/monto del límite
 */
const typesRequiringThreshold = new Set<z.infer<typeof alertTypeEnum>>([
  'high_spending',
  'limit_approaching',
])

/**
 * Tipos de alerta que requieren daysBefore (días de anticipación):
 * - closing_date: días antes del cierre
 * - due_date: días antes del vencimiento
 */
const typesRequiringDaysBefore = new Set<z.infer<typeof alertTypeEnum>>([
  'closing_date',
  'due_date',
])

export const alertsRouter = router({
  /**
   * Listar todas las alertas del usuario
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.alert.findMany({
      where: {
        userId: ctx.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }),

  /**
   * Crear nueva alerta
   */
  create: protectedProcedure
    .input(
      z.object({
        type: alertTypeEnum,
        cardId: z.string().optional(),
        threshold: z.number().positive().optional(),
        daysBefore: z.number().int().positive().optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validación condicional según el tipo de alerta
      if (typesRequiringThreshold.has(input.type) && input.threshold === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `El tipo de alerta "${input.type}" requiere un threshold`,
        })
      }

      if (typesRequiringDaysBefore.has(input.type) && input.daysBefore === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `El tipo de alerta "${input.type}" requiere daysBefore`,
        })
      }

      // Si se indica una tarjeta, validar que pertenezca al usuario
      if (input.cardId) {
        const card = await ctx.prisma.creditCard.findUnique({
          where: { id: input.cardId },
        })

        if (!card || card.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tarjeta no encontrada',
          })
        }
      }

      return ctx.prisma.alert.create({
        data: {
          userId: ctx.user.id,
          type: input.type,
          cardId: input.cardId,
          threshold: input.threshold,
          daysBefore: input.daysBefore,
          isEnabled: input.isEnabled ?? true,
        },
      })
    }),

  /**
   * Actualizar alerta existente
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        threshold: z.number().positive().nullable().optional(),
        daysBefore: z.number().int().positive().nullable().optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const alert = await ctx.prisma.alert.findUnique({
        where: { id },
      })

      if (!alert || alert.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alerta no encontrada',
        })
      }

      return ctx.prisma.alert.update({
        where: { id },
        data,
      })
    }),

  /**
   * Eliminar alerta
   */
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.prisma.alert.findUnique({
        where: { id: input },
      })

      if (!alert || alert.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alerta no encontrada',
        })
      }

      return ctx.prisma.alert.delete({
        where: { id: input },
      })
    }),

  /**
   * Activar / desactivar una alerta (flip isEnabled)
   */
  toggle: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.prisma.alert.findUnique({
        where: { id: input },
      })

      if (!alert || alert.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alerta no encontrada',
        })
      }

      return ctx.prisma.alert.update({
        where: { id: input },
        data: {
          isEnabled: !alert.isEnabled,
        },
      })
    }),
})
