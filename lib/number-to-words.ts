/**
 * Converts a number to its Spanish text representation for legal documents.
 * e.g. 800000 → "OCHOCIENTOS MIL", 1650000 → "UN MILLÓN SEISCIENTOS CINCUENTA MIL"
 */

const UNITS = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const TEENS = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
]
const TENS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const HUNDREDS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
  'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
]

function convertHundreds(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'

  const h = Math.floor(n / 100)
  const remainder = n % 100
  const parts: string[] = []

  if (h > 0) parts.push(HUNDREDS[h])

  if (remainder > 0) {
    if (remainder < 10) {
      parts.push(UNITS[remainder])
    } else if (remainder < 20) {
      parts.push(TEENS[remainder - 10])
    } else if (remainder < 30 && remainder > 20) {
      parts.push('VEINTI' + UNITS[remainder - 20])
    } else if (remainder === 20) {
      parts.push('VEINTE')
    } else {
      const t = Math.floor(remainder / 10)
      const u = remainder % 10
      if (u === 0) {
        parts.push(TENS[t])
      } else {
        parts.push(TENS[t] + ' Y ' + UNITS[u])
      }
    }
  }

  return parts.join(' ')
}

export function numberToWords(n: number): string {
  if (n === 0) return 'CERO'
  if (n < 0) return 'MENOS ' + numberToWords(-n)

  // Only handle integers (truncate decimals for legal use)
  n = Math.floor(n)

  if (n < 1000) return convertHundreds(n)

  const parts: string[] = []

  // Millions
  const millions = Math.floor(n / 1_000_000)
  if (millions > 0) {
    if (millions === 1) {
      parts.push('UN MILLÓN')
    } else {
      parts.push(convertHundreds(millions) + ' MILLONES')
    }
  }

  // Thousands
  const thousands = Math.floor((n % 1_000_000) / 1000)
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('MIL')
    } else {
      parts.push(convertHundreds(thousands) + ' MIL')
    }
  }

  // Hundreds
  const hundreds = n % 1000
  if (hundreds > 0) {
    parts.push(convertHundreds(hundreds))
  }

  return parts.join(' ')
}

/**
 * Formats a number as legal currency text.
 * e.g. 800000 → "PESOS OCHOCIENTOS MIL"
 */
export function amountToLegalText(amount: number, currency: string = 'ARS'): string {
  const prefix = currency === 'USD' ? 'DÓLARES ESTADOUNIDENSES' : currency === 'EUR' ? 'EUROS' : 'PESOS'
  return `${prefix} ${numberToWords(amount)}`
}

