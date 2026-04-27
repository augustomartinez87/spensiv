import type {
  BcraDeudasResponse,
  BcraHistoricasResponse,
  BcraChequesResponse,
  AfipPersona,
  ScoreResult,
} from './types'

/**
 * Parsers tolerantes para los payloads JSONB persistidos en `consultas_360`.
 *
 * Los datos vienen tipados como `Json` de Prisma, así que del lado del cliente
 * llegan como `unknown`. En vez de un `as unknown as T`, validamos la forma
 * mínima necesaria para no romper la UI y devolvemos `null` si no cumple.
 *
 * No es Zod completo a propósito: solo garantizamos las invariantes que la UI
 * realmente usa para no introducir runtime overhead innecesario.
 */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseBcraDeudas(v: unknown): BcraDeudasResponse | null {
  if (!isObject(v)) return null
  const results = v.results
  if (!isObject(results) || !Array.isArray(results.periodos)) return null
  return v as unknown as BcraDeudasResponse
}

export function parseBcraHistoricas(v: unknown): BcraHistoricasResponse | null {
  if (!isObject(v)) return null
  const results = v.results
  if (!isObject(results) || !Array.isArray(results.periodos)) return null
  return v as unknown as BcraHistoricasResponse
}

export function parseBcraCheques(v: unknown): BcraChequesResponse | null {
  if (!isObject(v)) return null
  const results = v.results
  if (!isObject(results) || !Array.isArray(results.causales)) return null
  return v as unknown as BcraChequesResponse
}

export function parseAfip(v: unknown): AfipPersona | null {
  if (!isObject(v)) return null
  return v as unknown as AfipPersona
}

export function parseScoreResult(v: unknown): ScoreResult | null {
  if (!isObject(v)) return null
  const score = v.score
  const banda = v.banda
  const components = v.components
  if (typeof score !== 'number') return null
  if (banda !== 'bajo' && banda !== 'medio' && banda !== 'alto' && banda !== 'critico') return null
  if (!Array.isArray(components)) return null
  return v as unknown as ScoreResult
}
