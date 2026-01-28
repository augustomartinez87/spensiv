/**
 * Utilidades para manejo de periodos financieros (YYYY-MM)
 * 
 * EVITA EL USO DE toISOString() que causa desfasajes por UTC.
 * Usamos siempre métodos locales para Argentina (o donde este el servidor/usuario).
 */

/**
 * Formatear una fecha a periodo YYYY-MM utilizando hora local
 */
export function formatPeriod(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
}

/**
 * Parsear un periodo YYYY-MM a objeto con año y mes
 */
export function parsePeriod(period: string): { year: number; month: number } {
    const [year, month] = period.split('-').map(Number)
    return { year, month }
}

/**
 * Obtener el periodo actual
 */
export function getCurrentPeriod(): string {
    return formatPeriod(new Date())
}

/**
 * Mover un periodo N meses hacia adelante o atrás
 */
export function addMonthsToPeriod(period: string, months: number): string {
    const { year, month } = parsePeriod(period)
    const date = new Date(year, month - 1 + months, 1)
    return formatPeriod(date)
}
