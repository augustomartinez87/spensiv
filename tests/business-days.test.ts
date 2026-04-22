import { test, expect } from 'vitest'
import { getNthBusinessDay, isArHoliday, getSmartFirstDueDate } from '../lib/business-days'

test('1/may/2026 es feriado (Día del Trabajador)', () => {
  expect(isArHoliday(new Date(2026, 4, 1))).toBe(true)
})

test('2° día hábil de mayo 2026 es el 5 (no el 4) porque el 1/may es feriado', () => {
  const d = getNthBusinessDay(2026, 5, 2)
  expect(d.getFullYear()).toBe(2026)
  expect(d.getMonth()).toBe(4)
  expect(d.getDate()).toBe(5)
})

test('2° día hábil de julio 2026 es el 2 (ningún feriado en los primeros días)', () => {
  // 1/jul/2026 = mié, 2/jul = jue → 1° y 2° hábil
  const d = getNthBusinessDay(2026, 7, 2)
  expect(d.getDate()).toBe(2)
})

test('2° día hábil de enero 2026 salta el 1/ene feriado', () => {
  // 1/ene/2026 = jue (feriado), 2/ene = vie (1° hábil), 5/ene = lun (2° hábil)
  const d = getNthBusinessDay(2026, 1, 2)
  expect(d.getDate()).toBe(5)
})

test('2° día hábil de marzo 2026 salta el 24/mar feriado si cae temprano', () => {
  // 24/mar es feriado pero cae tarde; los primeros hábiles son 2/mar (lun) y 3/mar (mar)
  const d = getNthBusinessDay(2026, 3, 2)
  expect(d.getDate()).toBe(3)
})

test('1er vencimiento inteligente desde 22/abr/2026 cae en junio (gap <25 días al 5/may)', () => {
  // 22/abr → 5/may = 13 días, < 25 → salta a junio
  // 1/jun = lun, 2/jun = mar (2° hábil)
  const due = getSmartFirstDueDate(new Date(2026, 3, 22))
  expect(due.getMonth()).toBe(5) // junio (0-indexed)
  expect(due.getDate()).toBe(2)
})
