import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/lib/trpc'
import { isValidCuit, normalizeCuit } from '@/lib/cuit'
import { fetchAllBcra } from '@/server/services/consulta-360/bcra.service'
import { getAfipPadron } from '@/server/services/consulta-360/afip.service'
import { invalidateCache } from '@/server/services/consulta-360/cache'
import { buildSummary, denominacionFromCheques } from '@/lib/consulta-360/score'

const RATE_LIMIT_PER_HOUR = 30
// Techo por invocación de bulk: cada CUIT fresco hace 4 fetches a BCRA + 1 a AFIP
// (~5-15s con cache frío). Más de 10 por request riesga timeout en serverless.
const BULK_MAX_PER_REQUEST = 10

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

      // Si BCRA está en mantenimiento, abortar antes de crear una consulta vacía
      // (sin BCRA no podemos calcular un score creíble).
      if (bcraStatus === 'mantenimiento') {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message:
            'BCRA está en mantenimiento. Esto suele durar unos minutos — probá de nuevo en un rato.',
        })
      }
      // Si BCRA dio error genérico (timeout, 500), también abortar.
      if (bcraStatus === 'error') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'No pudimos comunicarnos con BCRA. Probá de nuevo; si persiste, BCRA puede estar caído.',
        })
      }

      const afip = await getAfipPadron(ctx.prisma, input.cuit)

      const summary = buildSummary({
        cuit: input.cuit,
        bcraDeudas: deudas.data,
        bcraHistoricas: historicas.data,
        bcraCheques: cheques.data,
        bcraStatus,
        afip: afip.data,
      })

      const afipNombre =
        afip.data?.razonSocial ||
        [afip.data?.apellido, afip.data?.nombre].filter(Boolean).join(', ') ||
        null
      // Fallback de denominación: BCRA → AFIP → cheques (denomJuridica del firmante).
      const denom =
        summary.denominacion ?? afipNombre ?? denominacionFromCheques(cheques.data)

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

  /**
   * Re-consulta: invalida cache y vuelve a llamar BCRA/AFIP para el mismo CUIT,
   * preservando vínculo con persona y observaciones del registro original.
   */
  reConsultar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.prisma.consulta360.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      })
      if (!original) throw new TRPCError({ code: 'NOT_FOUND', message: 'Consulta no encontrada' })

      // Rate limit (mismo que consultar)
      const desde = new Date(Date.now() - 60 * 60 * 1000)
      const ultimaHora = await ctx.prisma.consulta360.count({
        where: { userId: ctx.user.id, consultadoEn: { gte: desde } },
      })
      if (ultimaHora >= RATE_LIMIT_PER_HOUR) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Llegaste al límite de ${RATE_LIMIT_PER_HOUR} consultas por hora.`,
        })
      }

      await invalidateCache(ctx.prisma, original.cuit)

      const { deudas, historicas, cheques, bcraStatus } = await fetchAllBcra(
        ctx.prisma,
        original.cuit
      )

      if (bcraStatus === 'mantenimiento') {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message:
            'BCRA está en mantenimiento. Probá de nuevo en unos minutos — la consulta original sigue disponible.',
        })
      }
      if (bcraStatus === 'error') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No pudimos comunicarnos con BCRA. Intentá de nuevo.',
        })
      }

      const afip = await getAfipPadron(ctx.prisma, original.cuit)

      const summary = buildSummary({
        cuit: original.cuit,
        bcraDeudas: deudas.data,
        bcraHistoricas: historicas.data,
        bcraCheques: cheques.data,
        bcraStatus,
        afip: afip.data,
      })

      const afipNombre =
        afip.data?.razonSocial ||
        [afip.data?.apellido, afip.data?.nombre].filter(Boolean).join(', ') ||
        null
      const denom =
        summary.denominacion ?? afipNombre ?? denominacionFromCheques(cheques.data)

      const updated = await ctx.prisma.consulta360.update({
        where: { id: original.id },
        data: {
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
          afipStatus:
            afip.status === 'ok' ? 'ok' : afip.status === 'error' ? 'error' : 'unavailable',
          consultadoEn: new Date(),
        },
      })

      return { id: updated.id, summary }
    }),

  /**
   * Listado completo con filtros (paginado simple por take/skip).
   */
  list: protectedProcedure
    .input(
      z
        .object({
          riesgo: z.enum(['bajo', 'medio', 'alto', 'critico']).optional(),
          q: z.string().optional(), // busca en CUIT o denominación
          minScore: z.number().int().min(0).max(1000).optional(),
          maxScore: z.number().int().min(0).max(1000).optional(),
          desde: z.string().optional(),
          hasta: z.string().optional(),
          take: z.number().int().min(1).max(200).default(50),
          skip: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { userId: ctx.user.id }
      if (input?.riesgo) where.riesgo = input.riesgo
      if (input?.minScore !== undefined || input?.maxScore !== undefined) {
        where.score = {
          ...(input?.minScore !== undefined ? { gte: input.minScore } : {}),
          ...(input?.maxScore !== undefined ? { lte: input.maxScore } : {}),
        }
      }
      if (input?.desde || input?.hasta) {
        where.consultadoEn = {
          ...(input?.desde ? { gte: new Date(input.desde) } : {}),
          ...(input?.hasta ? { lte: new Date(input.hasta) } : {}),
        }
      }
      if (input?.q?.trim()) {
        const q = input.q.trim()
        where.OR = [
          { cuit: { contains: q.replace(/\D/g, '') } },
          { denominacion: { contains: q, mode: 'insensitive' } },
        ]
      }

      const [items, total] = await Promise.all([
        ctx.prisma.consulta360.findMany({
          where,
          orderBy: { consultadoEn: 'desc' },
          take: input?.take ?? 50,
          skip: input?.skip ?? 0,
          select: {
            id: true,
            cuit: true,
            denominacion: true,
            score: true,
            riesgo: true,
            peorSituacion: true,
            totalDeudaArs: true,
            cantEntidades: true,
            chequesRechazados: true,
            consultadoEn: true,
            personId: true,
            person: { select: { id: true, name: true } },
          },
        }),
        ctx.prisma.consulta360.count({ where }),
      ])

      return { items, total }
    }),

  /**
   * Conteo de consultas internas por mes para un CUIT — alimenta la sección
   * "Consultas y seguimientos" del informe (estilo Nosis).
   */
  consultasPorMes: protectedProcedure
    .input(z.object({ cuit: z.string(), meses: z.number().int().min(1).max(24).default(6) }))
    .query(async ({ ctx, input }) => {
      const cuit = normalizeCuit(input.cuit)
      const desde = new Date()
      desde.setMonth(desde.getMonth() - input.meses + 1)
      desde.setDate(1)
      desde.setHours(0, 0, 0, 0)

      const consultas = await ctx.prisma.consulta360.findMany({
        where: { userId: ctx.user.id, cuit, consultadoEn: { gte: desde } },
        select: { consultadoEn: true },
      })

      // Agrupar por YYYYMM
      const buckets = new Map<string, number>()
      for (const c of consultas) {
        const d = new Date(c.consultadoEn)
        const k = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}`
        buckets.set(k, (buckets.get(k) ?? 0) + 1)
      }

      // Devolver array contiguo de meses (incluso los que tienen 0)
      const result: { periodo: string; cantidad: number }[] = []
      const cursor = new Date(desde)
      for (let i = 0; i < input.meses; i++) {
        const k = `${cursor.getFullYear()}${(cursor.getMonth() + 1).toString().padStart(2, '0')}`
        result.push({ periodo: k, cantidad: buckets.get(k) ?? 0 })
        cursor.setMonth(cursor.getMonth() + 1)
      }
      return result
    }),

  /**
   * Histórico de scores para un CUIT (todas las consultas del usuario, asc).
   */
  scoreHistory: protectedProcedure
    .input(z.object({ cuit: z.string() }))
    .query(async ({ ctx, input }) => {
      const cuit = normalizeCuit(input.cuit)
      return ctx.prisma.consulta360.findMany({
        where: { userId: ctx.user.id, cuit },
        orderBy: { consultadoEn: 'asc' },
        select: {
          id: true,
          score: true,
          riesgo: true,
          consultadoEn: true,
          peorSituacion: true,
        },
      })
    }),

  /**
   * Comparativa: trae el último registro previo del mismo CUIT (excluyendo el actual).
   */
  comparativa: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actual = await ctx.prisma.consulta360.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { cuit: true, consultadoEn: true },
      })
      if (!actual) throw new TRPCError({ code: 'NOT_FOUND', message: 'Consulta no encontrada' })

      const previa = await ctx.prisma.consulta360.findFirst({
        where: {
          userId: ctx.user.id,
          cuit: actual.cuit,
          consultadoEn: { lt: actual.consultadoEn },
        },
        orderBy: { consultadoEn: 'desc' },
        select: {
          id: true,
          score: true,
          riesgo: true,
          peorSituacion: true,
          totalDeudaArs: true,
          cantEntidades: true,
          chequesRechazados: true,
          consultadoEn: true,
        },
      })
      return previa
    }),

  /**
   * Bulk: dispara consultas de varios CUITs en serie.
   * - target: 'cartera' → todas las personas con CUIT
   * - target: 'cuits' → lista explícita
   * Saltea CUITs ya consultados en las últimas `skipIfWithinHours` horas (default 24)
   * para no comer rate limit de cuete.
   */
  bulk: protectedProcedure
    .input(
      z.object({
        target: z.enum(['cartera', 'cuits']),
        cuits: z.array(z.string()).optional(),
        skipIfWithinHours: z.number().int().min(0).max(720).default(24),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Resolver lista de CUITs
      let cuitList: { cuit: string; personId: string | null }[] = []
      if (input.target === 'cartera') {
        const personas = await ctx.prisma.person.findMany({
          where: { userId: ctx.user.id, cuit: { not: null } },
          select: { id: true, cuit: true },
        })
        cuitList = personas
          .filter((p) => p.cuit && isValidCuit(p.cuit))
          .map((p) => ({ cuit: normalizeCuit(p.cuit!), personId: p.id }))
      } else {
        const cuits = (input.cuits ?? [])
          .map((c) => normalizeCuit(c))
          .filter((c) => isValidCuit(c))
        cuitList = cuits.map((cuit) => ({ cuit, personId: null }))
      }

      // Deduplicar
      const seen = new Set<string>()
      cuitList = cuitList.filter((c) => {
        if (seen.has(c.cuit)) return false
        seen.add(c.cuit)
        return true
      })

      // Rate limit global por hora (cuenta TODAS las consultas del usuario)
      const desde = new Date(Date.now() - 60 * 60 * 1000)
      const ultimaHora = await ctx.prisma.consulta360.count({
        where: { userId: ctx.user.id, consultadoEn: { gte: desde } },
      })
      // El cupo efectivo es el mínimo entre rate-limit horario y techo por request
      // (este último evita timeouts en runtimes serverless con cache frío).
      const cupoHorario = Math.max(0, RATE_LIMIT_PER_HOUR - ultimaHora)
      const cupo = Math.min(cupoHorario, BULK_MAX_PER_REQUEST)
      if (cupo === 0) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Llegaste al límite de ${RATE_LIMIT_PER_HOUR} consultas por hora. Probá en un rato.`,
        })
      }

      // Filtrar los ya consultados recientemente (no contamos contra cupo)
      const skipDate = new Date(Date.now() - input.skipIfWithinHours * 60 * 60 * 1000)
      const recientes = await ctx.prisma.consulta360.findMany({
        where: {
          userId: ctx.user.id,
          cuit: { in: cuitList.map((c) => c.cuit) },
          consultadoEn: { gte: skipDate },
        },
        select: { cuit: true },
      })
      const recientesSet = new Set(recientes.map((r) => r.cuit))
      const aProcesar = cuitList.filter((c) => !recientesSet.has(c.cuit)).slice(0, cupo)

      const results: {
        cuit: string
        ok: boolean
        id?: string
        score?: number
        riesgo?: string
        denominacion?: string | null
        error?: string
      }[] = []

      for (const item of aProcesar) {
        try {
          const { deudas, historicas, cheques, bcraStatus } = await fetchAllBcra(
            ctx.prisma,
            item.cuit
          )

          // Si BCRA está caído, no creamos consulta vacía: registramos el error y seguimos.
          if (bcraStatus === 'mantenimiento' || bcraStatus === 'error') {
            results.push({
              cuit: item.cuit,
              ok: false,
              error:
                bcraStatus === 'mantenimiento'
                  ? 'BCRA en mantenimiento (503)'
                  : 'No se pudo consultar BCRA',
            })
            // Si BCRA está en mantenimiento, no tiene sentido seguir con el resto:
            // muy probable que todos fallen. Cortamos el bulk acá.
            if (bcraStatus === 'mantenimiento') break
            continue
          }

          const afip = await getAfipPadron(ctx.prisma, item.cuit)
          const summary = buildSummary({
            cuit: item.cuit,
            bcraDeudas: deudas.data,
            bcraHistoricas: historicas.data,
            bcraCheques: cheques.data,
            bcraStatus,
            afip: afip.data,
          })
          const afipNombre =
            afip.data?.razonSocial ||
            [afip.data?.apellido, afip.data?.nombre].filter(Boolean).join(', ') ||
            null
          const denom =
            summary.denominacion ?? afipNombre ?? denominacionFromCheques(cheques.data)

          const created = await ctx.prisma.consulta360.create({
            data: {
              userId: ctx.user.id,
              personId: item.personId,
              cuit: item.cuit,
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
              afipStatus:
                afip.status === 'ok' ? 'ok' : afip.status === 'error' ? 'error' : 'unavailable',
            },
          })

          results.push({
            cuit: item.cuit,
            ok: true,
            id: created.id,
            score: summary.score.score,
            riesgo: summary.score.banda,
            denominacion: denom,
          })
        } catch (e) {
          results.push({
            cuit: item.cuit,
            ok: false,
            error: e instanceof Error ? e.message : 'Error desconocido',
          })
        }
      }

      return {
        total: cuitList.length,
        procesados: results.length,
        salteadosPorRecientes: cuitList.length - aProcesar.length,
        salteadosPorCupo: Math.max(0, cuitList.length - recientesSet.size - cupo),
        results,
      }
    }),
})
