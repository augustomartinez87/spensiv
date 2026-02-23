export type NonCreditPaymentMethod = 'cash' | 'transfer' | 'debit_card'

export function getNonCreditPaymentMethodLabel(method: NonCreditPaymentMethod): string {
  switch (method) {
    case 'cash':
      return 'Efectivo'
    case 'transfer':
      return 'Transferencia'
    case 'debit_card':
      return 'Tarjeta de débito'
    default:
      return 'Otro'
  }
}

