import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formatea una fecha local a string YYYY-MM-DD sin conversión UTC
 * Soluciona el bug donde las fechas se desfasan por zonas horarias
 */
export function formatDateToInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

/**
 * Crea un objeto Date desde un string YYYY-MM-DD manteniendo hora local (00:00:00)
 */
export function parseInputDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}
