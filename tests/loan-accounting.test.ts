import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPaymentWaterfall } from '../server/services/loan-accounting.service'

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

test('waterfall rejects overpayment beyond total pending debt', () => {
  assert.throws(() => {
    applyPaymentWaterfall({
      paymentAmount: 100.02,
      overdueInterestPending: 30,
      currentInterestPending: 20,
      principalPending: 50,
    })
  })
})
