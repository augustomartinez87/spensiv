let cachedRate: { venta: number; timestamp: number } | null = null
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

export async function getDolarMep(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
    return cachedRate.venta
  }

  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/bolsa', {
      next: { revalidate: 900 },
    })
    const data = await res.json()
    const venta = data.venta as number
    cachedRate = { venta, timestamp: Date.now() }
    return venta
  } catch {
    // Fallback to cached or default
    return cachedRate?.venta ?? 1200
  }
}

export function pesify(amount: number, currency: string, mepRate: number): number {
  if (currency === 'ARS') return amount
  if (currency === 'USD') return amount * mepRate
  if (currency === 'EUR') return amount * mepRate * 1.08 // rough EUR/USD
  return amount
}
