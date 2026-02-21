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
  assert.throws(() => {
    buildFrenchLoanWithMinimumTna({
      capital: 100000,
      termMonths: 360,
      tnaMinima: 3.0,
      startDate: '2026-01-15',
      roundingMultiple: 1,
    })
  })
})

test('360 cuotas - multiple 1000', () => {
  assert.throws(() => {
    buildFrenchLoanWithMinimumTna({
      capital: 1_000_000,
      termMonths: 360,
      tnaMinima: 0.55,
      startDate: '2026-01-15',
      roundingMultiple: 1000,
    })
  })
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

test('fixed-term regression: 6/9/12 months must not collapse to same flow', () => {
  const terms = [6, 9, 12] as const
  const results = terms.map((term) =>
    buildFrenchLoanWithMinimumTna({
      capital: 50_000,
      termMonths: term,
      tnaMinima: 0.9,
      startDate: '2026-01-15',
      roundingMultiple: 1000,
    })
  )

  for (let i = 0; i < results.length; i++) {
    const term = terms[i]
    const result = results[i]
    assert.equal(result.schedule.periods, term)
    assert.equal(result.schedule.schedule.length, term)
    assert.equal(result.schedule.schedule[result.schedule.schedule.length - 1].period, term)
    assert.ok(Math.abs(result.schedule.schedule[result.schedule.schedule.length - 1].balance) <= EPS)
  }

  const totals = results.map((r) => r.schedule.totalPaid)
  assert.ok(totals[0] < totals[1], `Expected total(6) < total(9), got ${totals[0]} vs ${totals[1]}`)
  assert.ok(totals[1] < totals[2], `Expected total(9) < total(12), got ${totals[1]} vs ${totals[2]}`)
})
