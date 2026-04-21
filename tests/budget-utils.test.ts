import { test, expect } from 'vitest'
import {
  isValidPeriod,
  getPeriodDateRange,
  calculateBudgetPercentage,
} from '../lib/budget-analytics'
import { getNonCreditPaymentMethodLabel } from '../lib/transaction-utils'

test('isValidPeriod valida formato y rango de mes', () => {
  expect(isValidPeriod('2026-01')).toBe(true)
  expect(isValidPeriod('2026-12')).toBe(true)
  expect(isValidPeriod('2026-00')).toBe(false)
  expect(isValidPeriod('2026-13')).toBe(false)
  expect(isValidPeriod('26-01')).toBe(false)
  expect(isValidPeriod('2026-1')).toBe(false)
})

test('getPeriodDateRange devuelve primer dia de mes y primer dia del mes siguiente', () => {
  const jan = getPeriodDateRange('2026-01')
  expect(jan.startDate.toISOString().slice(0, 10)).toBe('2026-01-01')
  expect(jan.endDate.toISOString().slice(0, 10)).toBe('2026-02-01')

  const leap = getPeriodDateRange('2024-02')
  expect(leap.startDate.toISOString().slice(0, 10)).toBe('2024-02-01')
  expect(leap.endDate.toISOString().slice(0, 10)).toBe('2024-03-01')
})

test('getPeriodDateRange lanza error en periodos invalidos', () => {
  expect(() => getPeriodDateRange('2026-13')).toThrow()
  expect(() => getPeriodDateRange('2026-00')).toThrow()
})

test('calculateBudgetPercentage calcula porcentaje y protege limite no positivo', () => {
  expect(calculateBudgetPercentage(0, 1000)).toBe(0)
  expect(calculateBudgetPercentage(500, 1000)).toBe(50)
  expect(calculateBudgetPercentage(1500, 1000)).toBe(150)
  expect(calculateBudgetPercentage(100, 0)).toBe(0)
})

test('getNonCreditPaymentMethodLabel devuelve etiquetas correctas', () => {
  expect(getNonCreditPaymentMethodLabel('cash')).toBe('Efectivo')
  expect(getNonCreditPaymentMethodLabel('transfer')).toBe('Transferencia')
  expect(getNonCreditPaymentMethodLabel('debit_card')).toBe('Tarjeta de débito')
})
