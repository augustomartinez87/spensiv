import { getIncomeCategoryMappingByName, normalizeIncomeCategoryText } from '@/lib/income-categories'

export const PENDING_CLASSIFICATION_FILTER = '__pending_classification__'
export const PENDING_CLASSIFICATION_LABEL = 'Pendiente de clasificar'

export function getExpenseTypeLabel(type: string | null) {
  switch (type) {
    case 'structural':
      return 'Estructural'
    case 'emotional_recurrent':
      return 'Emocional Recurrente'
    case 'emotional_impulsive':
      return 'Emocional Impulsivo'
    default:
      return 'Sin clasificar'
  }
}

export function getExpenseTypeColor(type: string | null) {
  switch (type) {
    case 'structural':
      return 'bg-[#1f6c9c]/15 text-[#4da8d4]'
    case 'emotional_recurrent':
      return 'bg-[#feb92e]/15 text-[#feb92e]'
    case 'emotional_impulsive':
      return 'bg-[#e54352]/15 text-[#f07a85]'
    default:
      return 'bg-secondary text-muted-foreground'
  }
}

export function getPaymentMethodLabel(method: string) {
  switch (method) {
    case 'credit_card':
      return 'Tarjeta Crédito'
    case 'debit_card':
      return 'Tarjeta Débito'
    case 'cash':
      return 'Efectivo'
    case 'transfer':
      return 'Transferencia'
    default:
      return method
  }
}

export function getPaymentMethodColor(method: string) {
  switch (method) {
    case 'credit_card':
      return 'bg-indigo-500/15 text-indigo-400'
    case 'debit_card':
      return 'bg-blue-500/15 text-blue-400'
    case 'cash':
      return 'bg-green-500/15 text-green-400'
    case 'transfer':
      return 'bg-cyan-500/15 text-cyan-400'
    default:
      return 'bg-secondary text-muted-foreground'
  }
}

export function isTransactionPendingClassification(transaction: { categoryId: string | null; subcategoryId: string | null }) {
  return !transaction.categoryId && !transaction.subcategoryId
}

export function getTransactionCategoryLabel(transaction: { categoryId: string | null; subcategoryId: string | null; category?: { name: string } | null }) {
  if (isTransactionPendingClassification(transaction)) {
    return PENDING_CLASSIFICATION_LABEL
  }
  return transaction.category?.name || 'Sin categoría'
}

export function getIncomeCategoryLabel(category: string) {
  return getIncomeCategoryMappingByName(category)?.category || category
}

export function getIncomeCategoryColor(category: string) {
  const normalized = normalizeIncomeCategoryText(getIncomeCategoryLabel(category))

  if (normalized === normalizeIncomeCategoryText('Ingresos Activos')) {
    return 'bg-green-500/15 text-green-400'
  }
  if (normalized === normalizeIncomeCategoryText('Ingresos Pasivos')) {
    return 'bg-emerald-500/15 text-emerald-400'
  }
  if (normalized === normalizeIncomeCategoryText('Otros Ingresos')) {
    return 'bg-blue-500/15 text-blue-400'
  }

  return 'bg-secondary text-muted-foreground'
}
