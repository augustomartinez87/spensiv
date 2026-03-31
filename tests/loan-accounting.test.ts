import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPaymentWaterfall } from '../server/services/loan-accounting.service'

// ── Orden del waterfall ──────────────────────────────────────────────────────

test('waterfall applies overdue then current then principal', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 400,
    overdueInterestPending: 120,
    currentInterestPending: 220,
    principalPending: 10000,
  })

  assert.equal(result.interestOverdueApplied, 120)
  assert.equal(result.interestCurrentApplied, 220)
  assert.equal(result.principalApplied, 60)
  assert.equal(result.totalApplied, 400)
})

test('pago exacto cubre solo mora — no toca interés corriente ni capital', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 150,
    overdueInterestPending: 150,
    currentInterestPending: 300,
    principalPending: 5000,
  })

  assert.equal(result.interestOverdueApplied, 150)
  assert.equal(result.interestCurrentApplied, 0)
  assert.equal(result.principalApplied, 0)
  assert.equal(result.totalApplied, 150)
})

test('pago exacto cubre mora + interés corriente — no toca capital', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 450,
    overdueInterestPending: 150,
    currentInterestPending: 300,
    principalPending: 5000,
  })

  assert.equal(result.interestOverdueApplied, 150)
  assert.equal(result.interestCurrentApplied, 300)
  assert.equal(result.principalApplied, 0)
  assert.equal(result.totalApplied, 450)
})

test('pago solo capital — sin mora ni interés corriente (préstamo 0%)', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 500000,
    overdueInterestPending: 0,
    currentInterestPending: 0,
    principalPending: 500000,
  })

  assert.equal(result.interestOverdueApplied, 0)
  assert.equal(result.interestCurrentApplied, 0)
  assert.equal(result.principalApplied, 500000)
  assert.equal(result.totalApplied, 500000)
})

test('pago parcial de capital — sin mora ni interés corriente', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 200000,
    overdueInterestPending: 0,
    currentInterestPending: 0,
    principalPending: 1000000,
  })

  assert.equal(result.principalApplied, 200000)
  assert.equal(result.totalApplied, 200000)
  assert.equal(result.totalPending, 1000000)
})

test('pago exactamente igual al total pendiente', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 100,
    overdueInterestPending: 30,
    currentInterestPending: 20,
    principalPending: 50,
  })

  assert.equal(result.totalApplied, 100)
  assert.equal(result.interestOverdueApplied, 30)
  assert.equal(result.interestCurrentApplied, 20)
  assert.equal(result.principalApplied, 50)
})

test('pago dentro de tolerancia de centavo es aceptado', () => {
  // totalPending = 100, pago = 100.005 — dentro de CENT_TOLERANCE (0.01)
  assert.doesNotThrow(() => {
    applyPaymentWaterfall({
      paymentAmount: 100.005,
      overdueInterestPending: 30,
      currentInterestPending: 20,
      principalPending: 50,
    })
  })
})

test('pago con decimales típicos de cuota francesa', () => {
  // Cuota de $312.50, interés $125.00, capital $187.50
  const result = applyPaymentWaterfall({
    paymentAmount: 312.5,
    overdueInterestPending: 0,
    currentInterestPending: 125,
    principalPending: 187.5,
  })

  assert.equal(result.interestCurrentApplied, 125)
  assert.equal(result.principalApplied, 187.5)
  assert.equal(result.totalApplied, 312.5)
})

// ── Validaciones de entrada ──────────────────────────────────────────────────

test('waterfall rechaza pago que excede la deuda total', () => {
  assert.throws(() => {
    applyPaymentWaterfall({
      paymentAmount: 100.02,
      overdueInterestPending: 30,
      currentInterestPending: 20,
      principalPending: 50,
    })
  })
})

test('waterfall rechaza pago de 0 o negativo', () => {
  assert.throws(() => {
    applyPaymentWaterfall({
      paymentAmount: 0,
      overdueInterestPending: 0,
      currentInterestPending: 100,
      principalPending: 1000,
    })
  })

  assert.throws(() => {
    applyPaymentWaterfall({
      paymentAmount: -50,
      overdueInterestPending: 0,
      currentInterestPending: 100,
      principalPending: 1000,
    })
  })
})

test('waterfall rechaza buckets negativos', () => {
  assert.throws(() => {
    applyPaymentWaterfall({
      paymentAmount: 100,
      overdueInterestPending: -10,
      currentInterestPending: 110,
      principalPending: 0,
    })
  })
})

// ── Consistencia del resultado ───────────────────────────────────────────────

test('totalApplied siempre es suma de los tres buckets', () => {
  const cases = [
    { paymentAmount: 100, overdueInterestPending: 40, currentInterestPending: 35, principalPending: 500 },
    { paymentAmount: 230000, overdueInterestPending: 0, currentInterestPending: 46000, principalPending: 184000 },
    { paymentAmount: 1, overdueInterestPending: 0, currentInterestPending: 0, principalPending: 1000000 },
  ]

  for (const input of cases) {
    const r = applyPaymentWaterfall(input)
    const bucketSum = r.interestOverdueApplied + r.interestCurrentApplied + r.principalApplied
    assert.ok(
      Math.abs(bucketSum - r.totalApplied) < 0.01,
      `bucketSum (${bucketSum}) !== totalApplied (${r.totalApplied}) for input ${JSON.stringify(input)}`
    )
  }
})

test('totalPending refleja la deuda completa independiente del pago', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 50,
    overdueInterestPending: 100,
    currentInterestPending: 200,
    principalPending: 5000,
  })

  assert.equal(result.totalPending, 5300)
})
