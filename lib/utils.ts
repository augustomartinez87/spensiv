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

export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : (plural ?? singular + 's')
}

// Re-exports from date-utils for backwards compatibility.
// New code should import directly from '@/lib/date-utils'.
export { formatDateToInput, parseInputDate, getDaysUntilClosing } from './date-utils'
