import type { PrismaClient } from '@prisma/client'
import type { AfipPersona } from '@/lib/consulta-360/types'
import { getCached, setCached } from './cache'

const FETCH_TIMEOUT_MS = 8_000
// AFIP cae a menudo: TTL corto para "unavailable" así no quedamos pegados 7 días con un blip transitorio.
const UNAVAILABLE_TTL_MS = 30 * 60 * 1000 // 30 min

// AFIP soa endpoint público (best-effort, intermitente).
// Si falla devolvemos status: "unavailable" sin romper el resto del informe.
const AFIP_SOA = (cuit: string) => `https://soa.afip.gob.ar/sr-padron/v2/persona/${cuit}`

export type AfipOutcome = {
  data: AfipPersona | null
  status: 'ok' | 'unavailable' | 'error'
  fromCache: boolean
  fetchedAt: Date
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'Spensiv-Consulta360/1.0' },
      cache: 'no-store',
    })
  } finally {
    clearTimeout(t)
  }
}

export async function getAfipPadron(prisma: PrismaClient, cuit: string): Promise<AfipOutcome> {
  const cached = await getCached<{ data?: AfipPersona; success?: boolean }>(prisma, 'afip_padron', cuit)
  if (cached) {
    const ok = cached.status === 200 && cached.payload && (cached.payload as { success?: boolean }).success !== false
    return {
      data: ok ? ((cached.payload as { data?: AfipPersona }).data ?? null) : null,
      status: ok ? 'ok' : 'unavailable',
      fromCache: true,
      fetchedAt: cached.fetchedAt,
    }
  }

  let res: Response
  try {
    res = await fetchWithTimeout(AFIP_SOA(cuit))
  } catch {
    return { data: null, status: 'unavailable', fromCache: false, fetchedAt: new Date() }
  }

  if (!res.ok) {
    await setCached(
      prisma,
      'afip_padron',
      cuit,
      { success: false, status: res.status },
      res.status,
      UNAVAILABLE_TTL_MS
    )
    return { data: null, status: 'unavailable', fromCache: false, fetchedAt: new Date() }
  }

  let json: { success?: boolean; data?: AfipPersona; errorMessages?: string[] }
  try {
    json = await res.json()
  } catch {
    return { data: null, status: 'error', fromCache: false, fetchedAt: new Date() }
  }

  if (!json || json.success === false || !json.data) {
    await setCached(prisma, 'afip_padron', cuit, { success: false, ...json }, 200, UNAVAILABLE_TTL_MS)
    return { data: null, status: 'unavailable', fromCache: false, fetchedAt: new Date() }
  }

  await setCached(prisma, 'afip_padron', cuit, json, 200)
  return { data: json.data, status: 'ok', fromCache: false, fetchedAt: new Date() }
}
