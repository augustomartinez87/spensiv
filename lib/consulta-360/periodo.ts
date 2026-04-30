// Helpers de formato de período BCRA ("YYYYMM").
// BCRA reporta los datos referidos a un mes calendario (no en tiempo real).

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MES_LARGO = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function periodoIsValid(periodo: string | null | undefined): boolean {
  return !!periodo && /^\d{6}$/.test(periodo)
}

/** "202604" → "abr 2026" */
export function formatPeriodoCorto(periodo: string | null | undefined): string {
  if (!periodoIsValid(periodo)) return '—'
  const y = periodo!.slice(0, 4)
  const m = parseInt(periodo!.slice(4, 6), 10)
  return `${MES_CORTO[m - 1] ?? '?'} ${y}`
}

/** "202604" → "Abril de 2026" */
export function formatPeriodoLargo(periodo: string | null | undefined): string {
  if (!periodoIsValid(periodo)) return '—'
  const y = periodo!.slice(0, 4)
  const m = parseInt(periodo!.slice(4, 6), 10)
  const mes = MES_LARGO[m - 1] ?? '?'
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)} de ${y}`
}

/** Devuelve cuántos meses pasaron entre el período y hoy (en miles, máx 24). */
export function antiguedadDelPeriodo(periodo: string | null | undefined): number | null {
  if (!periodoIsValid(periodo)) return null
  const y = parseInt(periodo!.slice(0, 4), 10)
  const m = parseInt(periodo!.slice(4, 6), 10)
  const now = new Date()
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m)
}
