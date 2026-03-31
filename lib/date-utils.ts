/**
 * Returns a human-readable relative date string in Spanish.
 * E.g. "hoy", "mañana", "en 3d", "hace 2d"
 */
export function daysUntilText(date: Date, now = new Date()): string {
  const diff = Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff < 0) return `hace ${Math.abs(diff)}d`
  return `en ${diff}d`
}

/**
 * Returns the number of remaining days in the current month.
 */
export function daysRemainingInMonth(today = new Date()): number {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return daysInMonth - today.getDate()
}
