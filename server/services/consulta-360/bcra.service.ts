import type { PrismaClient } from '@prisma/client'
import type {
  BcraDeudasResponse,
  BcraHistoricasResponse,
  BcraChequesResponse,
} from '@/lib/consulta-360/types'
import { getCached, setCached, type CacheSource } from './cache'

const BCRA_BASE = 'https://api.bcra.gob.ar/centraldedeudores/v1.0'
const FETCH_TIMEOUT_MS = 12_000

export type FetchOutcome<T> = {
  data: T | null
  status: 'ok' | 'not_found' | 'error'
  fromCache: boolean
  fetchedAt: Date
  httpStatus: number
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

async function fetchAndCache<T>(
  prisma: PrismaClient,
  source: CacheSource,
  cuit: string,
  url: string
): Promise<FetchOutcome<T>> {
  const cached = await getCached<T>(prisma, source, cuit)
  if (cached) {
    const status: FetchOutcome<T>['status'] =
      cached.status === 200 ? 'ok' : cached.status === 404 ? 'not_found' : 'error'
    return {
      data: cached.status === 200 ? cached.payload : null,
      status,
      fromCache: true,
      fetchedAt: cached.fetchedAt,
      httpStatus: cached.status,
    }
  }

  let res: Response
  try {
    res = await fetchWithTimeout(url)
  } catch {
    return {
      data: null,
      status: 'error',
      fromCache: false,
      fetchedAt: new Date(),
      httpStatus: 0,
    }
  }

  if (res.status === 404) {
    // Cachear el "not_found" para no martillar BCRA
    await setCached(prisma, source, cuit, { status: 404 }, 404)
    return {
      data: null,
      status: 'not_found',
      fromCache: false,
      fetchedAt: new Date(),
      httpStatus: 404,
    }
  }

  if (!res.ok) {
    return {
      data: null,
      status: 'error',
      fromCache: false,
      fetchedAt: new Date(),
      httpStatus: res.status,
    }
  }

  let json: T
  try {
    json = (await res.json()) as T
  } catch {
    return {
      data: null,
      status: 'error',
      fromCache: false,
      fetchedAt: new Date(),
      httpStatus: res.status,
    }
  }

  await setCached(prisma, source, cuit, json, 200)
  return {
    data: json,
    status: 'ok',
    fromCache: false,
    fetchedAt: new Date(),
    httpStatus: 200,
  }
}

export function getDeudas(prisma: PrismaClient, cuit: string) {
  return fetchAndCache<BcraDeudasResponse>(
    prisma,
    'bcra_deudas',
    cuit,
    `${BCRA_BASE}/Deudas/${cuit}`
  )
}

export function getHistoricas(prisma: PrismaClient, cuit: string) {
  return fetchAndCache<BcraHistoricasResponse>(
    prisma,
    'bcra_historicas',
    cuit,
    `${BCRA_BASE}/Deudas/Historicas/${cuit}`
  )
}

export function getChequesRechazados(prisma: PrismaClient, cuit: string) {
  return fetchAndCache<BcraChequesResponse>(
    prisma,
    'bcra_cheques',
    cuit,
    `${BCRA_BASE}/Deudas/ChequesRechazados/${cuit}`
  )
}

export async function fetchAllBcra(prisma: PrismaClient, cuit: string) {
  const [deudas, historicas, cheques] = await Promise.all([
    getDeudas(prisma, cuit),
    getHistoricas(prisma, cuit),
    getChequesRechazados(prisma, cuit),
  ])

  // bcraStatus consolidado: ok si deudas ok, not_found si todas devuelven 404, error si todas fallan.
  let bcraStatus: 'ok' | 'not_found' | 'error'
  if (deudas.status === 'ok') bcraStatus = 'ok'
  else if (
    deudas.status === 'not_found' &&
    historicas.status !== 'error' &&
    cheques.status !== 'error'
  )
    bcraStatus = 'not_found'
  else bcraStatus = 'error'

  return { deudas, historicas, cheques, bcraStatus }
}
