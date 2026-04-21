import { test, expect } from 'vitest'
import { addMonthsEOM, buildFrenchLoanWithMinimumTna, calculateXirrAnnualRobust } from '../lib/financial-engine'

const EPS = 1e-8

function validateInvariants(result: ReturnType<typeof buildFrenchLoanWithMinimumTna>, capital: number, tnaMinima: number) {
  const rows = result.schedule.schedule
  expect(rows.length >= 1).toBeTruthy()

  const principalSum = rows.reduce((acc, row) => acc + row.principal, 0)
  const finalBalance = rows[rows.length - 1].balance

  expect(Math.abs(principalSum - capital) <= EPS).toBeTruthy()
  expect(Math.abs(finalBalance) <= EPS).toBeTruthy()
  expect(result.irrTnaNominal + EPS >= tnaMinima).toBeTruthy()

  for (const row of rows) {
    expect(row.interest >= -EPS).toBeTruthy()
    expect(row.balance >= -EPS).toBeTruthy()
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
  expect(() => {
    buildFrenchLoanWithMinimumTna({
      capital: 100000,
      termMonths: 360,
      tnaMinima: 3.0,
      startDate: '2026-01-15',
      roundingMultiple: 1,
    })
  }).toThrow()
})

test('360 cuotas - multiple 1000', () => {
  expect(() => {
    buildFrenchLoanWithMinimumTna({
      capital: 1_000_000,
      termMonths: 360,
      tnaMinima: 0.55,
      startDate: '2026-01-15',
      roundingMultiple: 1000,
    })
  }).toThrow()
})

test('EOM policy - start 31/01', () => {
  const d = new Date(2026, 0, 31)
  expect(addMonthsEOM(d, 1).toISOString().slice(0, 10)).toBe('2026-02-28')
  expect(addMonthsEOM(d, 2).toISOString().slice(0, 10)).toBe('2026-03-31')
})

test('EOM policy - start 29/02 leap year', () => {
  const d = new Date(2024, 1, 29)
  expect(addMonthsEOM(d, 1).toISOString().slice(0, 10)).toBe('2024-03-31')
  expect(addMonthsEOM(d, 12).toISOString().slice(0, 10)).toBe('2025-02-28')
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
    expect(result.schedule.periods).toBe(term)
    expect(result.schedule.schedule.length).toBe(term)
    expect(result.schedule.schedule[result.schedule.schedule.length - 1].period).toBe(term)
    expect(Math.abs(result.schedule.schedule[result.schedule.schedule.length - 1].balance) <= EPS).toBeTruthy()
  }

  const totals = results.map((r) => r.schedule.totalPaid)
  expect(totals[0] < totals[1]).toBeTruthy()
  expect(totals[1] < totals[2]).toBeTruthy()
})

test('XIRR annual simple convergent case', () => {
  const xirr = calculateXirrAnnualRobust([
    { date: new Date('2026-01-01T00:00:00Z'), amount: -1000 },
    { date: new Date('2027-01-01T00:00:00Z'), amount: 1100 },
  ])

  expect(Math.abs(xirr - 0.1) < 1e-8).toBeTruthy()
})
