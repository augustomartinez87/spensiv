import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/lib/trpc'
import { isValidCuit, normalizeCuit } from '@/lib/cuit'
import { fetchAllBcra } from '@/server/services/consulta-360/bcra.service'
import { getAfipPadron } from '@/server/services/consulta-360/afip.service'
import { buildSummary } from '@/lib/consulta-360/score'

const RATE_LIMIT_PER_HOUR = 30

const cuitInput = z.object({
  cuit: z
    .string()
    .min(8)
    .transform((v) => normalizeCuit(v))
    .refine((v) => isValidCuit(v), 'CUIT/CUIL/CDI inválido (dígito verificador)'),
})

export const consulta360Router = router({
  /**
   * Ejecuta la consulta a BCRA + AFIP, calcula score, persiste en consultas_360.
   */
  consultar: protectedProcedure
    .input(
      cuitInput.extend({
        personaId: z.string().optional(),
        observaciones: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit por usuario
      const desde = new Date(Date.now() - 60 * 60 * 1000)
      const ultimaHora = await ctx.prisma.consulta360.count({
        where: { userId: ctx.user.id, consultadoEn: { gte: desde } },
      })
      if (ultimaHora >= RATE_LIMIT_PER_HOUR) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Llegaste al límite de ${RATE_LIMIT_PER_HOUR} consultas por hora. Probá en un rato.`,
        })
      }

      // Si vincula a una persona, validá que sea del usuario
      if (input.personaId) {
        const owns = await ctx.prisma.person.findFirst({
          where: { id: input.personaId, userId: ctx.user.id },
          select: { id: true },
        })
        if (!owns) throw new TRPCError({ code: 'NOT_FOUND', message: 'Persona no encontrada' })
      }

      const { deudas, historicas, cheques, bcraStatus } = await fetchAllBcra(
        ctx.prisma,
        input.cuit
      )
      const afip = await getAfipPadron(ctx.prisma, input.cuit)

      const summary = buildSummary({
        cuit: input.cuit,
        bcraDeudas: deudas.data,
        bcraHistoricas: historicas.data,
        bcraCheques: cheques.data,
        bcraStatus,
      })

      const afipNombre =
        afip.data?.razonSocial ||
        [afip.data?.apellido, afip.data?.nombre].filter(Boolean).join(', ') ||
        null
      const denom = summary.denominacion ?? afipNombre

      const created = await ctx.prisma.consulta360.create({
        data: {
          userId: ctx.user.id,
          personId: input.personaId ?? null,
          cuit: input.cuit,
          denominacion: denom,
          score: summary.score.score,
          riesgo: summary.score.banda,
          peorSituacion: summary.peorSituacion ?? null,
          totalDeudaArs: summary.totalDeudaArs,
          cantEntidades: summary.cantEntidades,
          chequesRechazados: summary.chequesRechazados,
          mesesConDatos: summary.mesesConDatos,
          scoreBreakdown: summary.score as never,
          payloadBcra: (deudas.data ?? null) as never,
          payloadHistorico: (historicas.data ?? null) as never,
          payloadCheques: (cheques.data ?? null) as never,
          payloadAfip: (afip.data ?? null) as never,
          bcraStatus,
          afipStatus: afip.status === 'ok' ? 'ok' : afip.status === 'error' ? 'error' : 'unavailable',
          observaciones: input.observaciones ?? null,
        },
      })

      return {
        id: created.id,
        summary,
        afip: { status: afip.status, data: afip.data },
        sources: {
          bcra: { status: bcraStatus, fromCache: deudas.fromCache, fetchedAt: deudas.fetchedAt },
          afip: { status: afip.status, fromCache: afip.fromCache, fetchedAt: afip.fetchedAt },
        },
      }
    }),

  /**
   * Últimas N consultas del usuario (para autocompletado).
   */
  recent: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.consulta360.findMany({
        where: { userId: ctx.user.id },
        orderBy: { consultadoEn: 'desc' },
        take: input?.limit ?? 5,
        select: {
          id: true,
          cuit: true,
          denominacion: true,
          score: true,
          riesgo: true,
          consultadoEn: true,
          personId: true,
        },
      })
    }),

  /**
   * Una consulta específica con todos los payloads para el informe.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const consulta = await ctx.prisma.consulta360.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          person: { select: { id: true, name: true, alias: true } },
        },
      })
      if (!consulta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Consulta no encontrada' })
      return consulta
    }),

  /**
   * Vincular consulta a una persona del módulo Personas.
   */
  linkPersona: protectedProcedure
    .input(z.object({ id: z.string(), personaId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const consulta = await ctx.prisma.consulta360.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true, cuit: true },
      })
      if (!consulta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Consulta no encontrada' })

      if (input.personaId) {
        const persona = await ctx.prisma.person.findFirst({
          where: { id: input.personaId, userId: ctx.user.id },
          select: { id: true, cuit: true },
        })
        if (!persona) throw new TRPCError({ code: 'NOT_FOUND', message: 'Persona no encontrada' })

        // Si la persona no tiene CUIT cargado, lo seteamos con el de la consulta.
        if (!persona.cuit) {
          await ctx.prisma.person.update({
            where: { id: persona.id },
            data: { cuit: consulta.cuit },
          })
        }
      }

      const updated = await ctx.prisma.consulta360.update({
        where: { id: input.id },
        data: { personId: input.personaId },
      })
      return updated
    }),

  /**
   * Editar nota privada.
   */
  updateObservaciones: protectedProcedure
    .input(z.object({ id: z.string(), observaciones: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const consulta = await ctx.prisma.consulta360.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      })
      if (!consulta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Consulta no encontrada' })

      return ctx.prisma.consulta360.update({
        where: { id: input.id },
        data: { observaciones: input.observaciones },
      })
    }),

  /**
   * Eliminar consulta (no borra el cache, solo el registro guardado).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const consulta = await ctx.prisma.consulta360.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      })
      if (!consulta) throw new TRPCError({ code: 'NOT_FOUND', message: 'Consulta no encontrada' })
      await ctx.prisma.consulta360.delete({ where: { id: input.id } })
      return { success: true }
    }),
})
