import type {
  BcraDeudasResponse,
  BcraHistoricasResponse,
  BcraChequesResponse,
  BcraSituacion,
  AfipPersona,
  RiesgoBanda,
  ScoreComponent,
  ScoreResult,
  ConsultaSummary,
} from './types'

const WEIGHTS = {
  peorSituacion: 0.4,
  estabilidad: 0.25,
  cheques: 0.15,
  entidades: 0.1,
  antiguedad: 0.1,
} as const

const SIT_TO_POINTS: Record<BcraSituacion, number> = {
  1: 1000,
  2: 700,
  3: 400,
  4: 200,
  5: 0,
  6: 0,
}

/**
 * Si AFIP falla, BCRA cheques suele traer "denomJuridica" del firmante.
 * Útil como fallback para mostrar al menos el nombre del titular.
 */
export function denominacionFromCheques(
  cheques: BcraChequesResponse | null | undefined
): string | null {
  if (!cheques?.results?.causales) return null
  for (const c of cheques.results.causales) {
    for (const ent of c.entidades) {
      for (const det of ent.detalle ?? []) {
        if (det.denomJuridica && det.denomJuridica.trim()) return det.denomJuridica.trim()
      }
    }
  }
  return null
}

export function bandaForScore(score: number): { banda: RiesgoBanda; label: string } {
  if (score >= 800) return { banda: 'bajo', label: 'Apto sin reservas' }
  if (score >= 600) return { banda: 'medio', label: 'Apto con condiciones' }
  if (score >= 400) return { banda: 'alto', label: 'Solo con garantías' }
  return { banda: 'critico', label: 'No recomendado' }
}

function getLatestPeriodo(deudas: BcraDeudasResponse | null | undefined) {
  const periodos = deudas?.results?.periodos ?? []
  if (!periodos.length) return null
  return [...periodos].sort((a, b) => b.periodo.localeCompare(a.periodo))[0]
}

type ChequesStats = {
  total: number // total en últimos 12m
  pendientes: number // sin fecha de pago, en últimos 12m
  pagados: number // con fecha de pago, en últimos 12m
}

function statsChequesUltimos12m(cheques: BcraChequesResponse | null | undefined): ChequesStats {
  if (!cheques?.results?.causales) return { total: 0, pendientes: 0, pagados: 0 }
  const ahora = new Date()
  const limite = new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate())

  let total = 0
  let pendientes = 0
  let pagados = 0
  for (const c of cheques.results.causales) {
    for (const ent of c.entidades) {
      for (const det of ent.detalle ?? []) {
        const f = det.fechaRechazo ? new Date(det.fechaRechazo) : null
        if (!f || isNaN(f.getTime()) || f < limite) continue
        total += 1
        if (det.fechaPago) pagados += 1
        else pendientes += 1
      }
    }
  }
  return { total, pendientes, pagados }
}

function chequesPenalty(stats: ChequesStats): number {
  // Pendientes pesan 3x más que pagados. Un cheque pagado ya saldó la falta.
  if (stats.total === 0) return 1000
  // Pendientes: -250 los primeros 2, -400 cada uno desde el 3°.
  const pendFirst = Math.min(stats.pendientes, 2) * 250
  const pendRest = Math.max(stats.pendientes - 2, 0) * 400
  // Pagados: -75 cada uno (señal histórica pero no actual).
  const pagPenalty = stats.pagados * 75
  return Math.max(0, 1000 - pendFirst - pendRest - pagPenalty)
}

function estabilidadHistorica(historicas: BcraHistoricasResponse | null | undefined): {
  raw: number
  mesesConDatos: number
  mesesEnSit1: number
} {
  const periodos = historicas?.results?.periodos ?? []
  if (!periodos.length) return { raw: 500, mesesConDatos: 0, mesesEnSit1: 0 } // neutral si no hay datos

  const ult24 = [...periodos]
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .slice(0, 24)

  const mesesConDatos = ult24.length
  const mesesEnSit1 = ult24.filter((p) =>
    p.entidades.every((e) => e.situacion === 1)
  ).length

  const pct = mesesConDatos > 0 ? mesesEnSit1 / mesesConDatos : 0
  return { raw: Math.round(pct * 1000), mesesConDatos, mesesEnSit1 }
}

function cantidadEntidadesScore(cant: number): { raw: number; neutral: boolean; detail: string } {
  if (cant === 0) {
    return { raw: 500, neutral: true, detail: 'Sin historial crediticio (eje neutro)' }
  }
  if (cant >= 1 && cant <= 3) return { raw: 1000, neutral: false, detail: `${cant} entidades (óptimo 1-3)` }
  if (cant >= 4 && cant <= 5) return { raw: 800, neutral: false, detail: `${cant} entidades` }
  if (cant >= 6 && cant <= 8) return { raw: 500, neutral: false, detail: `${cant} entidades (alto)` }
  return { raw: 200, neutral: false, detail: `${cant} entidades (sobreendeudado)` }
}

/**
 * Antigüedad realista: cuenta meses con datos en situación normal (sit 1).
 * 24 meses de impagos no deberían premiarse como "antigüedad alta".
 */
function antiguedadScore(mesesNormales: number, mesesTotales: number): number {
  // Si tiene datos pero ninguno limpio, antigüedad muy baja.
  if (mesesTotales > 0 && mesesNormales === 0) return 100
  if (mesesNormales >= 24) return 1000
  if (mesesNormales >= 12) return 700
  if (mesesNormales >= 6) return 400
  if (mesesNormales > 0) return 200
  return 0
}

function peorSituacion(periodo: ReturnType<typeof getLatestPeriodo>): BcraSituacion | null {
  if (!periodo || !periodo.entidades?.length) return null
  return periodo.entidades.reduce<BcraSituacion>(
    (peor, e) => (e.situacion > peor ? e.situacion : peor),
    1
  )
}

export function calculateScore(args: {
  bcraDeudas: BcraDeudasResponse | null
  bcraHistoricas: BcraHistoricasResponse | null
  bcraCheques: BcraChequesResponse | null
  afip?: AfipPersona | null
  bcraStatus?: 'ok' | 'not_found' | 'error'
}): ScoreResult {
  const { bcraDeudas, bcraHistoricas, bcraCheques, afip, bcraStatus } = args

  const flags: string[] = []
  const overrides: { reason: string; capAt: number }[] = []

  const latest = getLatestPeriodo(bcraDeudas)
  const peor = peorSituacion(latest)
  const cantEntidades = latest?.entidades?.length ?? 0
  const chequesStats = statsChequesUltimos12m(bcraCheques)
  const estab = estabilidadHistorica(bcraHistoricas)

  // Flags
  const sinHistorial = cantEntidades === 0 && estab.mesesConDatos === 0
  if (sinHistorial) flags.push('sin_historial_crediticio')
  if (bcraStatus === 'error') flags.push('bcra_error')
  const tieneJudicial =
    latest?.entidades?.some(
      (e) => e.procesoJud || e.situacionJuridica || e.irrecDisposicionTecnica
    ) ?? false
  if (tieneJudicial) flags.push('situacion_judicial')
  if (chequesStats.pendientes > 0) flags.push(`cheques_pendientes_${chequesStats.pendientes}`)
  if (chequesStats.pagados > 0 && chequesStats.pendientes === 0)
    flags.push(`cheques_regularizados_${chequesStats.pagados}`)

  // AFIP estado != ACTIVO → flag
  const estadoAfip = afip?.estadoClave?.toUpperCase()
  const afipInactivo = !!estadoAfip && estadoAfip !== 'ACTIVO'
  if (afipInactivo) flags.push(`afip_${estadoAfip.toLowerCase()}`)

  // Componente: peor situación
  // Si hay datos y son sit 1 → 1000. Si no hay datos → marcamos como neutro (500).
  // Ya no inflamos a 1000 cuando no hay datos: con eso un CUIT desconocido daba ~725.
  const peorPts = peor ? SIT_TO_POINTS[peor] : 500
  const peorComp: ScoreComponent = {
    key: 'peorSituacion',
    label: 'Peor situación BCRA actual',
    weight: WEIGHTS.peorSituacion,
    raw: peorPts,
    weighted: peorPts * WEIGHTS.peorSituacion,
    detail: peor ? `Situación ${peor}` : 'Sin deudas registradas (eje neutro)',
    neutral: !peor,
  }

  // Componente: estabilidad histórica
  const estabComp: ScoreComponent = {
    key: 'estabilidad',
    label: 'Estabilidad histórica (24m)',
    weight: WEIGHTS.estabilidad,
    raw: estab.raw,
    weighted: estab.raw * WEIGHTS.estabilidad,
    detail:
      estab.mesesConDatos > 0
        ? `${estab.mesesEnSit1}/${estab.mesesConDatos} meses en situación normal`
        : 'Sin histórico (eje neutro)',
    neutral: estab.mesesConDatos === 0,
  }

  // Componente: cheques
  const chequesPts = chequesPenalty(chequesStats)
  const chequesDetalle = (() => {
    if (chequesStats.total === 0) return 'Sin cheques rechazados'
    const parts: string[] = []
    if (chequesStats.pendientes > 0) parts.push(`${chequesStats.pendientes} pendiente(s)`)
    if (chequesStats.pagados > 0) parts.push(`${chequesStats.pagados} regularizado(s)`)
    return `${chequesStats.total} en 12m · ${parts.join(' · ')}`
  })()
  const chequesComp: ScoreComponent = {
    key: 'cheques',
    label: 'Cheques rechazados (12m)',
    weight: WEIGHTS.cheques,
    raw: chequesPts,
    weighted: chequesPts * WEIGHTS.cheques,
    detail: chequesDetalle,
  }

  // Componente: cantidad de entidades
  const entAux = cantidadEntidadesScore(cantEntidades)
  const entComp: ScoreComponent = {
    key: 'entidades',
    label: 'Cantidad de entidades activas',
    weight: WEIGHTS.entidades,
    raw: entAux.raw,
    weighted: entAux.raw * WEIGHTS.entidades,
    detail: entAux.detail,
    neutral: entAux.neutral,
  }

  // Componente: antigüedad — meses en sit normal, no totales
  const antPts = antiguedadScore(estab.mesesEnSit1, estab.mesesConDatos)
  const antComp: ScoreComponent = {
    key: 'antiguedad',
    label: 'Antigüedad limpia',
    weight: WEIGHTS.antiguedad,
    raw: antPts,
    weighted: antPts * WEIGHTS.antiguedad,
    detail:
      estab.mesesConDatos === 0
        ? '0 meses con datos'
        : `${estab.mesesEnSit1} mes(es) en sit. normal de ${estab.mesesConDatos}`,
  }

  const components = [peorComp, estabComp, chequesComp, entComp, antComp]
  let total = components.reduce((s, c) => s + c.weighted, 0)

  // Overrides
  if (peor === 5 || peor === 6) {
    overrides.push({ reason: `Situación ${peor} vigente (irrecuperable)`, capAt: 250 })
  }
  if (tieneJudicial) {
    overrides.push({ reason: 'Proceso judicial / situación jurídica', capAt: 300 })
  }
  if (chequesStats.pendientes >= 3) {
    overrides.push({
      reason: `${chequesStats.pendientes} cheques pendientes de pago`,
      capAt: 400,
    })
  }
  if (afipInactivo) {
    overrides.push({
      reason: `AFIP estado ${estadoAfip} (no activo)`,
      capAt: 350,
    })
  }
  if (sinHistorial) {
    // Sin historial NO es bueno ni malo: limitamos a "medio" para no recomendar a ciegas.
    overrides.push({
      reason: 'Sin historial crediticio (no calificable)',
      capAt: 600,
    })
  }
  for (const o of overrides) {
    if (total > o.capAt) total = o.capAt
  }

  const score = Math.max(0, Math.min(1000, Math.round(total)))
  const { banda, label } = bandaForScore(score)

  return {
    score,
    banda,
    bandaLabel: label,
    components,
    overrides,
    flags,
  }
}

export function buildSummary(args: {
  cuit: string
  bcraDeudas: BcraDeudasResponse | null
  bcraHistoricas: BcraHistoricasResponse | null
  bcraCheques: BcraChequesResponse | null
  bcraStatus: 'ok' | 'not_found' | 'error'
  afip?: AfipPersona | null
}): ConsultaSummary {
  const { cuit, bcraDeudas, bcraHistoricas, bcraCheques, bcraStatus, afip } = args

  const score = calculateScore({ bcraDeudas, bcraHistoricas, bcraCheques, afip, bcraStatus })
  const latest = getLatestPeriodo(bcraDeudas)
  const peor = peorSituacion(latest)

  const totalDeudaArs =
    latest?.entidades?.reduce((s, e) => s + (Number(e.monto) || 0), 0) ?? 0
  const cantEntidades = latest?.entidades?.length ?? 0
  const chequesStats = statsChequesUltimos12m(bcraCheques)
  const mesesConDatos = (bcraHistoricas?.results?.periodos ?? []).length

  return {
    cuit,
    denominacion: bcraDeudas?.results?.denominacion ?? null,
    peorSituacion: peor,
    totalDeudaArs,
    cantEntidades,
    chequesRechazados: chequesStats.total,
    mesesConDatos,
    score,
    bcraStatus,
  }
}
