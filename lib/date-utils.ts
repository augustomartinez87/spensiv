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

/**
 * Formatea una fecha local a string YYYY-MM-DD sin conversión UTC.
 * Soluciona el bug donde las fechas se desfasan por zonas horarias.
 */
export function formatDateToInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Crea un objeto Date desde un string YYYY-MM-DD manteniendo hora local (00:00:00)
 */
export function parseInputDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

/**
 * Calcula días hasta el próximo cierre de tarjeta
 */
export function getDaysUntilClosing(closingDay: number): number {
  const now = new Date()
  const today = now.getDate()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let closingDate: Date
  if (today <= closingDay) {
    closingDate = new Date(currentYear, currentMonth, closingDay)
  } else {
    closingDate = new Date(currentYear, currentMonth + 1, closingDay)
  }

  const diffTime = closingDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
