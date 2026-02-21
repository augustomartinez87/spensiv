import test from 'node:test'
import assert from 'node:assert/strict'
import { addMonthsEOM, buildFrenchLoanWithMinimumTna } from '../lib/financial-engine'

const EPS = 1e-8

function validateInvariants(result: ReturnType<typeof buildFrenchLoanWithMinimumTna>, capital: number, tnaMinima: number) {
  const rows = result.schedule.schedule
  assert.ok(rows.length >= 1)

  const principalSum = rows.reduce((acc, row) => acc + row.principal, 0)
  const finalBalance = rows[rows.length - 1].balance

  assert.ok(Math.abs(principalSum - capital) <= EPS, `principal sum mismatch: ${principalSum} vs ${capital}`)
  assert.ok(Math.abs(finalBalance) <= EPS, `final balance must be 0, got ${finalBalance}`)
  assert.ok(result.irrTnaNominal + EPS >= tnaMinima, `irr tna ${result.irrTnaNominal} < min ${tnaMinima}`)

  for (const row of rows) {
    assert.ok(row.interest >= -EPS, `negative interest at period ${row.period}`)
    assert.ok(row.balance >= -EPS, `negative balance at period ${row.period}`)
  }
}

test('1 cuota - invariants', () => {
  const result = buildFrenchLoanWithMinimumTna({
    capital: 100000,
    termMonths: 1,
    tnaMinima: 0.55,
    startDate: '2026-01-15',
    roundingMultiple: 1,
  })
  validateInvariants(result, 100000, 0.55)
})

test('2 cuotas - invariants', () => {
  const result = buildFrenchLoanWithMinimumTna({
    capital: 100000,
    termMonths: 2,
    tnaMinima: 0.55,
    startDate: '2026-01-15',
    roundingMultiple: 1,
  })
  validateInvariants(result, 100000, 0.55)
})

test('360 cuotas - 0.01% TNA - multiple 1', () => {
  const result = buildFrenchLoanWithMinimumTna({
    capital: 1_000_000,
    termMonths: 360,
    tnaMinima: 0.0001,
    startDate: '2026-01-15',
    roundingMultiple: 1,
  })
  validateInvariants(result, 1_000_000, 0.0001)
})

test('360 cuotas - 300% TNA - multiple 1', () => {
  const result = buildFrenchLoanWithMinimumTna({
    capital: 100000,
    termMonths: 360,
    tnaMinima: 3.0,
    startDate: '2026-01-15',
    roundingMultiple: 1,
  })
  validateInvariants(result, 100000, 3.0)
})

test('360 cuotas - multiple 1000', () => {
  const result = buildFrenchLoanWithMinimumTna({
    capital: 1_000_000,
    termMonths: 360,
    tnaMinima: 0.55,
    startDate: '2026-01-15',
    roundingMultiple: 1000,
  })
  validateInvariants(result, 1_000_000, 0.55)
  assert.equal(result.roundedInstallment % 1000, 0)
})

test('EOM policy - start 31/01', () => {
  const d = new Date(2026, 0, 31)
  assert.equal(addMonthsEOM(d, 1).toISOString().slice(0, 10), '2026-02-28')
  assert.equal(addMonthsEOM(d, 2).toISOString().slice(0, 10), '2026-03-31')
})

test('EOM policy - start 29/02 leap year', () => {
  const d = new Date(2024, 1, 29)
  assert.equal(addMonthsEOM(d, 1).toISOString().slice(0, 10), '2024-03-31')
  assert.equal(addMonthsEOM(d, 12).toISOString().slice(0, 10), '2025-02-28')
})

