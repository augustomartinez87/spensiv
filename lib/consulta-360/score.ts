import type {
  BcraDeudasResponse,
  BcraHistoricasResponse,
  BcraChequesResponse,
  BcraSituacion,
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

function countChequesUltimos12m(cheques: BcraChequesResponse | null | undefined): number {
  if (!cheques?.results?.causales) return 0
  const ahora = new Date()
  const limite = new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate())

  let count = 0
  for (const c of cheques.results.causales) {
    for (const ent of c.entidades) {
      for (const det of ent.detalle ?? []) {
        const f = det.fechaRechazo ? new Date(det.fechaRechazo) : null
        if (f && !isNaN(f.getTime()) && f >= limite) count += 1
      }
    }
  }
  return count
}

function chequesPenalty(count: number): number {
  if (count === 0) return 1000
  // -150 los primeros 2, -300 a partir del 3°
  const first = Math.min(count, 2) * 150
  const rest = Math.max(count - 2, 0) * 300
  return Math.max(0, 1000 - first - rest)
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

function antiguedadScore(meses: number): number {
  if (meses >= 24) return 1000
  if (meses >= 12) return 700
  if (meses >= 6) return 400
  if (meses > 0) return 200
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
}): ScoreResult {
  const { bcraDeudas, bcraHistoricas, bcraCheques } = args

  const flags: string[] = []
  const overrides: { reason: string; capAt: number }[] = []

  const latest = getLatestPeriodo(bcraDeudas)
  const peor = peorSituacion(latest)
  const cantEntidades = latest?.entidades?.length ?? 0
  const chequesUlt12m = countChequesUltimos12m(bcraCheques)
  const estab = estabilidadHistorica(bcraHistoricas)

  // Flags
  if (cantEntidades === 0) flags.push('sin_historial_crediticio')
  const tieneJudicial =
    latest?.entidades?.some(
      (e) => e.procesoJud || e.situacionJuridica || e.irrecDisposicionTecnica
    ) ?? false
  if (tieneJudicial) flags.push('situacion_judicial')
  if (chequesUlt12m > 0) flags.push(`cheques_rechazados_${chequesUlt12m}`)

  // Componente: peor situación
  const peorPts = peor ? SIT_TO_POINTS[peor] : 1000 // sin datos → no penaliza este eje
  const peorComp: ScoreComponent = {
    key: 'peorSituacion',
    label: 'Peor situación BCRA actual',
    weight: WEIGHTS.peorSituacion,
    raw: peorPts,
    weighted: peorPts * WEIGHTS.peorSituacion,
    detail: peor ? `Situación ${peor}` : 'Sin deudas registradas',
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
  }

  // Componente: cheques
  const chequesPts = chequesPenalty(chequesUlt12m)
  const chequesComp: ScoreComponent = {
    key: 'cheques',
    label: 'Cheques rechazados (12m)',
    weight: WEIGHTS.cheques,
    raw: chequesPts,
    weighted: chequesPts * WEIGHTS.cheques,
    detail: chequesUlt12m === 0 ? 'Sin cheques rechazados' : `${chequesUlt12m} cheque(s) en 12m`,
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

  // Componente: antigüedad
  const antPts = antiguedadScore(estab.mesesConDatos)
  const antComp: ScoreComponent = {
    key: 'antiguedad',
    label: 'Antigüedad en sistema',
    weight: WEIGHTS.antiguedad,
    raw: antPts,
    weighted: antPts * WEIGHTS.antiguedad,
    detail: `${estab.mesesConDatos} meses con datos`,
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
}): ConsultaSummary {
  const { cuit, bcraDeudas, bcraHistoricas, bcraCheques, bcraStatus } = args

  const score = calculateScore({ bcraDeudas, bcraHistoricas, bcraCheques })
  const latest = getLatestPeriodo(bcraDeudas)
  const peor = peorSituacion(latest)

  const totalDeudaArs =
    latest?.entidades?.reduce((s, e) => s + (Number(e.monto) || 0), 0) ?? 0
  const cantEntidades = latest?.entidades?.length ?? 0
  const chequesRechazados = countChequesUltimos12m(bcraCheques)
  const mesesConDatos = (bcraHistoricas?.results?.periodos ?? []).length

  return {
    cuit,
    denominacion: bcraDeudas?.results?.denominacion ?? null,
    peorSituacion: peor,
    totalDeudaArs,
    cantEntidades,
    chequesRechazados,
    mesesConDatos,
    score,
    bcraStatus,
  }
}
