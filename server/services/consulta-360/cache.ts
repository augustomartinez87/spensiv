import type { PrismaClient } from '@prisma/client'

const TTL_BCRA_MS = 24 * 60 * 60 * 1000
const TTL_AFIP_MS = 7 * 24 * 60 * 60 * 1000

export type CacheSource = 'bcra_deudas' | 'bcra_historicas' | 'bcra_cheques' | 'afip_padron'

const TTL_BY_SOURCE: Record<CacheSource, number> = {
  bcra_deudas: TTL_BCRA_MS,
  bcra_historicas: TTL_BCRA_MS,
  bcra_cheques: TTL_BCRA_MS,
  afip_padron: TTL_AFIP_MS,
}

export function cacheKeyFor(source: CacheSource, cuit: string): string {
  return `${source}:${cuit}`
}

export async function getCached<T>(
  prisma: PrismaClient,
  source: CacheSource,
  cuit: string
): Promise<{ payload: T; status: number; fetchedAt: Date } | null> {
  const row = await prisma.consulta360Cache.findUnique({
    where: { cacheKey: cacheKeyFor(source, cuit) },
  })
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) return null
  return { payload: row.payload as T, status: row.status, fetchedAt: row.fetchedAt }
}

export async function setCached(
  prisma: PrismaClient,
  source: CacheSource,
  cuit: string,
  payload: unknown,
  status: number,
  ttlMs?: number
): Promise<void> {
  const key = cacheKeyFor(source, cuit)
  const expiresAt = new Date(Date.now() + (ttlMs ?? TTL_BY_SOURCE[source]))
  await prisma.consulta360Cache.upsert({
    where: { cacheKey: key },
    create: {
      cacheKey: key,
      source,
      cuit,
      payload: payload as never,
      status,
      expiresAt,
    },
    update: {
      payload: payload as never,
      status,
      fetchedAt: new Date(),
      expiresAt,
    },
  })
}
