import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidPeriod,
  getPeriodDateRange,
  calculateBudgetPercentage,
} from '../lib/budget-utils'
import { getNonCreditPaymentMethodLabel } from '../lib/payment-methods'

test('isValidPeriod valida formato y rango de mes', () => {
  assert.equal(isValidPeriod('2026-01'), true)
  assert.equal(isValidPeriod('2026-12'), true)
  assert.equal(isValidPeriod('2026-00'), false)
  assert.equal(isValidPeriod('2026-13'), false)
  assert.equal(isValidPeriod('26-01'), false)
  assert.equal(isValidPeriod('2026-1'), false)
})

test('getPeriodDateRange devuelve primer dia de mes y primer dia del mes siguiente', () => {
  const jan = getPeriodDateRange('2026-01')
  assert.equal(jan.startDate.toISOString().slice(0, 10), '2026-01-01')
  assert.equal(jan.endDate.toISOString().slice(0, 10), '2026-02-01')

  const leap = getPeriodDateRange('2024-02')
  assert.equal(leap.startDate.toISOString().slice(0, 10), '2024-02-01')
  assert.equal(leap.endDate.toISOString().slice(0, 10), '2024-03-01')
})

test('getPeriodDateRange lanza error en periodos invalidos', () => {
  assert.throws(() => getPeriodDateRange('2026-13'))
  assert.throws(() => getPeriodDateRange('2026-00'))
})

test('calculateBudgetPercentage calcula porcentaje y protege limite no positivo', () => {
  assert.equal(calculateBudgetPercentage(0, 1000), 0)
  assert.equal(calculateBudgetPercentage(500, 1000), 50)
  assert.equal(calculateBudgetPercentage(1500, 1000), 150)
  assert.equal(calculateBudgetPercentage(100, 0), 0)
})

test('getNonCreditPaymentMethodLabel devuelve etiquetas correctas', () => {
  assert.equal(getNonCreditPaymentMethodLabel('cash'), 'Efectivo')
  assert.equal(getNonCreditPaymentMethodLabel('transfer'), 'Transferencia')
  assert.equal(getNonCreditPaymentMethodLabel('debit_card'), 'Tarjeta de débito')
})

