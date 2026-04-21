import { unstable_cache } from 'next/cache'

const fetchMepRate = unstable_cache(
  async (): Promise<number | null> => {
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/bolsa')
      if (!res.ok) return null
      const data = await res.json()
      const venta = data?.venta
      return typeof venta === 'number' ? venta : null
    } catch {
      return null
    }
  },
  ['dolar-mep'],
  { revalidate: 900 }
)

export async function getDolarMep(): Promise<number | null> {
  return fetchMepRate()
}

export function pesify(amount: number, currency: string, mepRate: number | null): number {
  if (currency === 'ARS') return amount
  if (!mepRate) return 0
  if (currency === 'USD') return amount * mepRate
  if (currency === 'EUR') return amount * mepRate * 1.08
  return amount
}
