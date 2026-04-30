// Análisis derivado de las series históricas BCRA — replica el tipo de "narrativas"
// que arma Nosis a partir de los mismos datos públicos.

import type {
  BcraHistoricasResponse,
  BcraDeudasResponse,
  BcraPeriodoDeuda,
  BcraSituacion,
} from './types'
import { formatPeriodoLargo } from './periodo'

/**
 * Calcula desde qué período el deudor "permanece" en una situación dada o mejor,
 * recorriendo el histórico hacia atrás. Sirve para frases tipo:
 * "Permanece en Situación 1 (Normal) desde MM.YYYY".
 *
 * Si nunca tuvo otra situación → devuelve el primer período registrado.
 */
export function permanenciaEnSituacion(
  historicas: BcraHistoricasResponse | null | undefined,
  deudas: BcraDeudasResponse | null | undefined
): { sitActual: BcraSituacion | null; desdePeriodo: string | null; esPerfecta: boolean } {
  const periodos = [...(historicas?.results?.periodos ?? [])].sort((a, b) =>
    a.periodo.localeCompare(b.periodo)
  )

  // Tomar la peor situación del último periodo de "deudas" como referencia actual.
  const latestDeudas = deudas?.results?.periodos?.[0]
  const sitActual = peorSitDe(latestDeudas) ?? peorSitDe(periodos[periodos.length - 1])

  if (!sitActual || periodos.length === 0) {
    return { sitActual: null, desdePeriodo: null, esPerfecta: false }
  }

  // Buscar hacia atrás el primer mes donde la sit deja de ser ≤ sitActual.
  // Si recorre todo el array sin encontrar peor → permanece desde el primer período.
  let desdePeriodo = periodos[0].periodo
  for (let i = periodos.length - 1; i >= 0; i--) {
    const peor = peorSitDe(periodos[i])
    if (peor === null) continue
    if (peor > sitActual) {
      // El siguiente más reciente es donde "vuelve" a sitActual o mejor.
      desdePeriodo = periodos[i + 1]?.periodo ?? periodos[i].periodo
      break
    }
    desdePeriodo = periodos[i].periodo
  }

  return { sitActual, desdePeriodo, esPerfecta: sitActual === 1 }
}

function peorSitDe(p: BcraPeriodoDeuda | undefined | null): BcraSituacion | null {
  if (!p?.entidades?.length) return null
  return p.entidades.reduce<BcraSituacion>(
    (peor, e) => (e.situacion > peor ? e.situacion : peor),
    1 as BcraSituacion
  )
}

/**
 * Frase narrativa equivalente a la de Nosis ("Este deudor permanece en Situación
 * 1 - Normal o no ha sido incluido en la Central de Deudores en períodos
 * intermedios, desde: MM.YYYY"). Devuelve null si no hay datos suficientes.
 */
export function frasePermanencia(
  historicas: BcraHistoricasResponse | null | undefined,
  deudas: BcraDeudasResponse | null | undefined
): string | null {
  const r = permanenciaEnSituacion(historicas, deudas)
  if (!r.sitActual || !r.desdePeriodo) return null
  const sitTxt = SIT_LABEL[r.sitActual] ?? `${r.sitActual}`
  return `Permanece en Situación ${r.sitActual} (${sitTxt}) o no ha sido incluido en la Central de Deudores en períodos intermedios, desde ${formatPeriodoLargo(r.desdePeriodo)}.`
}

const SIT_LABEL: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Con problemas',
  4: 'Alto riesgo',
  5: 'Irrecuperable',
  6: 'Irrecuperable por disp. técnica',
}

/**
 * Tramos de atraso BCRA estándar.
 */
export type TramoAtraso = 'normal' | 't31_90' | 't91_180' | 't181_365' | 'tMayor365' | 'sit6'
export const TRAMOS_LABEL: Record<TramoAtraso, string> = {
  normal: 'Normal',
  t31_90: '31 a 90',
  t91_180: '91 a 180',
  t181_365: '181 a 365',
  tMayor365: 'Mayor a 365',
  sit6: 'Sit. 6',
}

export function tramoFor(diasAtraso: number, situacion: BcraSituacion): TramoAtraso {
  if (situacion === 6) return 'sit6'
  if (diasAtraso <= 30) return 'normal'
  if (diasAtraso <= 90) return 't31_90'
  if (diasAtraso <= 180) return 't91_180'
  if (diasAtraso <= 365) return 't181_365'
  return 'tMayor365'
}

/**
 * Construye una matriz período × tramo con los montos sumados.
 * Ideal para la "Evolución de atrasos" del informe.
 */
export function evolucionAtrasos(
  historicas: BcraHistoricasResponse | null | undefined
): { periodo: string; tramos: Record<TramoAtraso, number>; total: number }[] {
  const periodos = [...(historicas?.results?.periodos ?? [])].sort((a, b) =>
    b.periodo.localeCompare(a.periodo) // desc
  )
  return periodos.slice(0, 12).map((p) => {
    const tramos: Record<TramoAtraso, number> = {
      normal: 0,
      t31_90: 0,
      t91_180: 0,
      t181_365: 0,
      tMayor365: 0,
      sit6: 0,
    }
    let total = 0
    for (const e of p.entidades) {
      const m = (Number(e.monto) || 0) * 1000 // miles → pesos
      const tr = tramoFor(e.diasAtraso ?? 0, e.situacion)
      tramos[tr] += m
      total += m
    }
    return { periodo: p.periodo, tramos, total }
  })
}

/**
 * Serie cronológica simple para la grilla 24m: período + peor sit + endeudamiento total + cantidad de entidades.
 */
export function serie24m(
  historicas: BcraHistoricasResponse | null | undefined
): { periodo: string; peor: BcraSituacion | null; cantEntidades: number; deudaArs: number }[] {
  const periodos = [...(historicas?.results?.periodos ?? [])].sort((a, b) =>
    a.periodo.localeCompare(b.periodo)
  )
  return periodos.slice(-24).map((p) => ({
    periodo: p.periodo,
    peor: peorSitDe(p),
    cantEntidades: p.entidades.length,
    deudaArs: p.entidades.reduce((s, e) => s + (Number(e.monto) || 0), 0) * 1000,
  }))
}
