// Health-check liviano para mostrar estado de BCRA en la UI.
// Pegamos a Deudas/{cuit_prueba} con timeout corto e interpretamos el HTTP code.
// Cacheamos in-memory por 60s para que aunque haya 100 clientes pidiendo, BCRA
// reciba 1 ping/min como mucho.

const TTL_MS = 60_000
const PING_TIMEOUT_MS = 3_500
// CUIT de empresa pública conocida (BCRA SA), estable y no sensible.
// Usado solo para verificar que la API responde, no se persiste el resultado.
const PING_CUIT = '30500010912'
const PING_URL = `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${PING_CUIT}`

export type BcraHealthStatus = 'ok' | 'mantenimiento' | 'error'

export type BcraHealth = {
  status: BcraHealthStatus
  httpStatus: number | null
  checkedAt: Date
  /** Latencia en ms si el ping respondió (success o not_found), null en otros casos. */
  latencyMs: number | null
}

let cached: BcraHealth | null = null

export async function getBcraHealth(): Promise<BcraHealth> {
  if (cached && Date.now() - cached.checkedAt.getTime() < TTL_MS) {
    return cached
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS)
  const start = Date.now()
  try {
    const res = await fetch(PING_URL, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'Spensiv-Health/1.0' },
      cache: 'no-store',
    })
    clearTimeout(t)
    const latencyMs = Date.now() - start

    let status: BcraHealthStatus
    if (res.status === 503) status = 'mantenimiento'
    else if (res.ok || res.status === 404) status = 'ok'
    else status = 'error'

    cached = { status, httpStatus: res.status, checkedAt: new Date(), latencyMs }
    return cached
  } catch {
    clearTimeout(t)
    cached = { status: 'error', httpStatus: null, checkedAt: new Date(), latencyMs: null }
    return cached
  }
}
