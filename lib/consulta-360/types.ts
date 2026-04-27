// Tipos compartidos del módulo Consulta 360°
// Contratos con APIs públicas BCRA / AFIP + estructuras internas.

export type BcraSituacion = 1 | 2 | 3 | 4 | 5 | 6

export type BcraEntidadDeuda = {
  entidad: string
  situacion: BcraSituacion
  fechaSit1?: string
  monto: number
  diasAtraso: number
  refinanciaciones: boolean
  recategorizacionOblig: boolean
  situacionJuridica: boolean
  irrecDisposicionTecnica: boolean
  enRevision: boolean
  procesoJud: boolean
}

export type BcraPeriodoDeuda = {
  periodo: string // "YYYYMM"
  entidades: BcraEntidadDeuda[]
}

export type BcraDeudasResponse = {
  status: number
  results: {
    identificacion: number
    denominacion: string
    periodos: BcraPeriodoDeuda[]
  }
}

export type BcraHistoricasResponse = {
  status: number
  results: {
    identificacion: number
    denominacion: string
    periodos: BcraPeriodoDeuda[]
  }
}

export type BcraChequeRechazado = {
  numeroCheque: number
  fechaRechazo: string
  monto: number
  fechaPago?: string
  fechaPagoMulta?: string
  estadoMulta?: string
  ctaPersonal?: boolean
  denomJuridica?: string
  enRevision?: boolean
  procesoJud?: boolean
  causal?: string
}

export type BcraEntidadCheques = {
  entidad: number
  detalle: BcraChequeRechazado[]
}

export type BcraChequesResponse = {
  status: number
  results: {
    identificacion: number
    denominacion: string
    causales: { causal: string; entidades: BcraEntidadCheques[] }[]
  }
}

export type AfipDomicilio = {
  direccion?: string
  localidad?: string
  codPostal?: string
  idProvincia?: number
  descripcionProvincia?: string
  tipoDomicilio?: string
}

export type AfipActividad = {
  idActividad?: number
  descripcionActividad?: string
  periodo?: number
  orden?: number
}

export type AfipPersona = {
  tipoPersona?: 'FISICA' | 'JURIDICA'
  tipoClave?: string
  estadoClave?: string
  idPersona?: number
  nombre?: string
  apellido?: string
  razonSocial?: string
  numeroDocumento?: string
  domicilioFiscal?: AfipDomicilio
  actividad?: AfipActividad[]
  monotributo?: { categoriaMonotributo?: string; descripcionActividadMonotributo?: string }
  impuesto?: { idImpuesto?: number; descripcionImpuesto?: string; estado?: string }[]
}

export type AfipResponse = {
  success: boolean
  data?: AfipPersona
  errorMessages?: string[]
}

// Score / informe interno
export type RiesgoBanda = 'bajo' | 'medio' | 'alto' | 'critico'

export type ScoreComponent = {
  key: 'peorSituacion' | 'estabilidad' | 'cheques' | 'entidades' | 'antiguedad'
  label: string
  weight: number // 0-1
  raw: number // 0-1000 (antes de pesar)
  weighted: number // 0-1000 * weight
  detail: string // explicación humana
  neutral?: boolean // ej: 0 entidades → neutro, no penaliza
}

export type ScoreResult = {
  score: number // 0-1000
  banda: RiesgoBanda
  bandaLabel: string
  components: ScoreComponent[]
  overrides: { reason: string; capAt: number }[]
  flags: string[] // ej: ["sin_historial_crediticio", "situacion_judicial"]
}

export type ConsultaInput = {
  cuit: string
  bcraDeudas?: BcraDeudasResponse | null
  bcraHistoricas?: BcraHistoricasResponse | null
  bcraCheques?: BcraChequesResponse | null
}

export type ConsultaSummary = {
  cuit: string
  denominacion: string | null
  peorSituacion: BcraSituacion | null
  totalDeudaArs: number
  cantEntidades: number
  chequesRechazados: number
  mesesConDatos: number
  score: ScoreResult
  bcraStatus: 'ok' | 'not_found' | 'error'
}
