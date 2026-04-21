import { test, expect } from 'vitest'
import { applyPaymentWaterfall } from '../server/services/loan-accounting.service'

// ── Orden del waterfall ──────────────────────────────────────────────────────

test('waterfall applies overdue then current then principal', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 400,
    overdueInterestPending: 120,
    currentInterestPending: 220,
    principalPending: 10000,
  })

  expect(result.interestOverdueApplied).toBe(120)
  expect(result.interestCurrentApplied).toBe(220)
  expect(result.principalApplied).toBe(60)
  expect(result.totalApplied).toBe(400)
})

test('pago exacto cubre solo mora — no toca interés corriente ni capital', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 150,
    overdueInterestPending: 150,
    currentInterestPending: 300,
    principalPending: 5000,
  })

  expect(result.interestOverdueApplied).toBe(150)
  expect(result.interestCurrentApplied).toBe(0)
  expect(result.principalApplied).toBe(0)
  expect(result.totalApplied).toBe(150)
})

test('pago exacto cubre mora + interés corriente — no toca capital', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 450,
    overdueInterestPending: 150,
    currentInterestPending: 300,
    principalPending: 5000,
  })

  expect(result.interestOverdueApplied).toBe(150)
  expect(result.interestCurrentApplied).toBe(300)
  expect(result.principalApplied).toBe(0)
  expect(result.totalApplied).toBe(450)
})

test('pago solo capital — sin mora ni interés corriente (préstamo 0%)', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 500000,
    overdueInterestPending: 0,
    currentInterestPending: 0,
    principalPending: 500000,
  })

  expect(result.interestOverdueApplied).toBe(0)
  expect(result.interestCurrentApplied).toBe(0)
  expect(result.principalApplied).toBe(500000)
  expect(result.totalApplied).toBe(500000)
})

test('pago parcial de capital — sin mora ni interés corriente', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 200000,
    overdueInterestPending: 0,
    currentInterestPending: 0,
    principalPending: 1000000,
  })

  expect(result.principalApplied).toBe(200000)
  expect(result.totalApplied).toBe(200000)
  expect(result.totalPending).toBe(1000000)
})

test('pago exactamente igual al total pendiente', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 100,
    overdueInterestPending: 30,
    currentInterestPending: 20,
    principalPending: 50,
  })

  expect(result.totalApplied).toBe(100)
  expect(result.interestOverdueApplied).toBe(30)
  expect(result.interestCurrentApplied).toBe(20)
  expect(result.principalApplied).toBe(50)
})

test('pago dentro de tolerancia de centavo es aceptado', () => {
  // totalPending = 100, pago = 100.005 — dentro de CENT_TOLERANCE (0.01)
  expect(() => {
    applyPaymentWaterfall({
      paymentAmount: 100.005,
      overdueInterestPending: 30,
      currentInterestPending: 20,
      principalPending: 50,
    })
  }).not.toThrow()
})

test('pago con decimales típicos de cuota francesa', () => {
  // Cuota de $312.50, interés $125.00, capital $187.50
  const result = applyPaymentWaterfall({
    paymentAmount: 312.5,
    overdueInterestPending: 0,
    currentInterestPending: 125,
    principalPending: 187.5,
  })

  expect(result.interestCurrentApplied).toBe(125)
  expect(result.principalApplied).toBe(187.5)
  expect(result.totalApplied).toBe(312.5)
})

// ── Validaciones de entrada ──────────────────────────────────────────────────

test('waterfall rechaza pago que excede la deuda total', () => {
  expect(() => {
    applyPaymentWaterfall({
      paymentAmount: 100.02,
      overdueInterestPending: 30,
      currentInterestPending: 20,
      principalPending: 50,
    })
  }).toThrow()
})

test('waterfall rechaza pago de 0 o negativo', () => {
  expect(() => {
    applyPaymentWaterfall({
      paymentAmount: 0,
      overdueInterestPending: 0,
      currentInterestPending: 100,
      principalPending: 1000,
    })
  }).toThrow()

  expect(() => {
    applyPaymentWaterfall({
      paymentAmount: -50,
      overdueInterestPending: 0,
      currentInterestPending: 100,
      principalPending: 1000,
    })
  }).toThrow()
})

test('waterfall rechaza buckets negativos', () => {
  expect(() => {
    applyPaymentWaterfall({
      paymentAmount: 100,
      overdueInterestPending: -10,
      currentInterestPending: 110,
      principalPending: 0,
    })
  }).toThrow()
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
    expect(Math.abs(bucketSum - r.totalApplied) < 0.01).toBeTruthy()
  }
})

test('totalPending refleja la deuda completa independiente del pago', () => {
  const result = applyPaymentWaterfall({
    paymentAmount: 50,
    overdueInterestPending: 100,
    currentInterestPending: 200,
    principalPending: 5000,
  })

  expect(result.totalPending).toBe(5300)
})
