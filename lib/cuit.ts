const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const

export function normalizeCuit(input: string): string {
  return input.replace(/\D/g, '')
}

export function formatCuit(cuit: string): string {
  const n = normalizeCuit(cuit)
  if (n.length !== 11) return cuit
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`
}

export function isValidCuit(input: string): boolean {
  const n = normalizeCuit(input)
  if (n.length !== 11) return false
  if (!/^\d{11}$/.test(n)) return false

  const prefix = n.slice(0, 2)
  // Prefijos válidos AR: 20/23/24/25/26/27 (personas), 30/33/34 (empresas), 50 (juridicas extranjeras)
  const validPrefixes = ['20', '23', '24', '25', '26', '27', '30', '33', '34', '50']
  if (!validPrefixes.includes(prefix)) return false

  const digits = n.split('').map(Number)
  const sum = CUIT_WEIGHTS.reduce((acc, w, i) => acc + w * digits[i], 0)
  const mod = sum % 11
  let expected = 11 - mod
  if (expected === 11) expected = 0
  if (expected === 10) expected = 9 // regla AR: si da 10, se reemplaza por 9

  return expected === digits[10]
}

export type CuitKind = 'persona' | 'empresa' | 'extranjera' | 'desconocido'

export function cuitKind(cuit: string): CuitKind {
  const n = normalizeCuit(cuit)
  const prefix = n.slice(0, 2)
  if (['20', '23', '24', '25', '26', '27'].includes(prefix)) return 'persona'
  if (['30', '33', '34'].includes(prefix)) return 'empresa'
  if (prefix === '50') return 'extranjera'
  return 'desconocido'
}
