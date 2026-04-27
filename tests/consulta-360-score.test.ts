import { describe, test, expect } from 'vitest'
import { calculateScore, bandaForScore } from '../lib/consulta-360/score'
import type {
  BcraDeudasResponse,
  BcraHistoricasResponse,
  BcraChequesResponse,
  BcraEntidadDeuda,
  BcraSituacion,
} from '../lib/consulta-360/types'

function entidad(situacion: BcraSituacion, overrides: Partial<BcraEntidadDeuda> = {}): BcraEntidadDeuda {
  return {
    entidad: 'BANCO TEST',
    situacion,
    monto: 1000,
    diasAtraso: 0,
    refinanciaciones: false,
    recategorizacionOblig: false,
    situacionJuridica: false,
    irrecDisposicionTecnica: false,
    enRevision: false,
    procesoJud: false,
    ...overrides,
  }
}

function deudasFor(entidades: BcraEntidadDeuda[], periodo = '202604'): BcraDeudasResponse {
  return {
    status: 200,
    results: {
      identificacion: 30500010912,
      denominacion: 'TEST SA',
      periodos: [{ periodo, entidades }],
    },
  }
}

function historicasFor(periodos: { periodo: string; entidades: BcraEntidadDeuda[] }[]): BcraHistoricasResponse {
  return {
    status: 200,
    results: { identificacion: 30500010912, denominacion: 'TEST SA', periodos },
  }
}

function chequesFor(detalles: { fechaRechazo: string; monto?: number }[]): BcraChequesResponse {
  return {
    status: 200,
    results: {
      identificacion: 30500010912,
      denominacion: 'TEST SA',
      causales: detalles.length
        ? [
            {
              causal: 'SIN FONDOS',
              entidades: [
                {
                  entidad: 1,
                  detalle: detalles.map((d, i) => ({
                    numeroCheque: 1000 + i,
                    fechaRechazo: d.fechaRechazo,
                    monto: d.monto ?? 50,
                  })),
                },
              ],
            },
          ]
        : [],
    },
  }
}

describe('bandaForScore', () => {
  test.each([
    [1000, 'bajo'],
    [800, 'bajo'],
    [799, 'medio'],
    [600, 'medio'],
    [599, 'alto'],
    [400, 'alto'],
    [399, 'critico'],
    [0, 'critico'],
  ] as const)('score %i → banda %s', (score, banda) => {
    expect(bandaForScore(score).banda).toBe(banda)
  })
})

describe('calculateScore', () => {
  test('CUIT impecable: sit 1, 24m perfectos, sin cheques, 1 entidad → score alto', () => {
    const periodos = Array.from({ length: 24 }, (_, i) => {
      const m = ((i % 12) + 1).toString().padStart(2, '0')
      const y = 2024 + Math.floor(i / 12)
      return { periodo: `${y}${m}`, entidades: [entidad(1)] }
    })
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor(periodos),
      bcraCheques: chequesFor([]),
    })
    expect(r.score).toBeGreaterThanOrEqual(950)
    expect(r.banda).toBe('bajo')
    expect(r.flags).toEqual([])
    expect(r.overrides).toEqual([])
  })

  test('sit 5 vigente → cap a 250 (override)', () => {
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(5)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
    })
    expect(r.score).toBeLessThanOrEqual(250)
    expect(r.overrides.some((o) => o.capAt === 250)).toBe(true)
  })

  test('sit 6 vigente → cap a 250', () => {
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(6)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
    })
    expect(r.score).toBeLessThanOrEqual(250)
  })

  test('proceso judicial → cap 300 + flag situacion_judicial', () => {
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(2, { procesoJud: true })]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
    })
    expect(r.flags).toContain('situacion_judicial')
    expect(r.overrides.some((o) => o.capAt === 300)).toBe(true)
    expect(r.score).toBeLessThanOrEqual(300)
  })

  test('sin entidades → flag sin_historial_crediticio + componente entidades neutro', () => {
    const r = calculateScore({
      bcraDeudas: null,
      bcraHistoricas: null,
      bcraCheques: null,
    })
    expect(r.flags).toContain('sin_historial_crediticio')
    const comp = r.components.find((c) => c.key === 'entidades')
    expect(comp?.neutral).toBe(true)
    expect(comp?.raw).toBe(500)
  })

  test('1 cheque rechazado dentro de 12m → -150, score baja', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 3)
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([{ fechaRechazo: recent.toISOString().slice(0, 10) }]),
    })
    const comp = r.components.find((c) => c.key === 'cheques')
    expect(comp?.raw).toBe(850) // 1000 - 150
  })

  test('3 cheques rechazados → -150 -150 -300 = -600, comp = 400', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 3)
    const fechas = [0, 1, 2].map((i) => {
      const d = new Date(recent)
      d.setDate(d.getDate() - i)
      return { fechaRechazo: d.toISOString().slice(0, 10) }
    })
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor(fechas),
    })
    const comp = r.components.find((c) => c.key === 'cheques')
    expect(comp?.raw).toBe(400)
  })

  test('cheques fuera de 12m no cuentan', () => {
    const old = new Date()
    old.setFullYear(old.getFullYear() - 2)
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([{ fechaRechazo: old.toISOString().slice(0, 10) }]),
    })
    const comp = r.components.find((c) => c.key === 'cheques')
    expect(comp?.raw).toBe(1000)
  })

  test('5 entidades → componente entidades = 800', () => {
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1), entidad(1), entidad(1), entidad(1), entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
    })
    const comp = r.components.find((c) => c.key === 'entidades')
    expect(comp?.raw).toBe(800)
  })

  test('sobreendeudado (>8 entidades) → 200', () => {
    const muchas = Array.from({ length: 10 }, () => entidad(1))
    const r = calculateScore({
      bcraDeudas: deudasFor(muchas),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
    })
    const comp = r.components.find((c) => c.key === 'entidades')
    expect(comp?.raw).toBe(200)
  })

  test('peor situación es la peor del último período (no la primera)', () => {
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1), entidad(3), entidad(2)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
    })
    const comp = r.components.find((c) => c.key === 'peorSituacion')
    expect(comp?.raw).toBe(400) // sit 3 → 400 pts
  })

  test('estabilidad histórica: 12/24 meses en sit 1 → componente = 500', () => {
    const periodos = Array.from({ length: 24 }, (_, i) => {
      const m = ((i % 12) + 1).toString().padStart(2, '0')
      const y = 2024 + Math.floor(i / 12)
      return {
        periodo: `${y}${m}`,
        entidades: [entidad(i < 12 ? 1 : 2)],
      }
    })
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor(periodos),
      bcraCheques: chequesFor([]),
    })
    const comp = r.components.find((c) => c.key === 'estabilidad')
    expect(comp?.raw).toBe(500)
  })

  test('antigüedad: 24m con datos → 1000', () => {
    const periodos = Array.from({ length: 24 }, (_, i) => ({
      periodo: `2024${(i + 1).toString().padStart(2, '0')}`,
      entidades: [entidad(1)],
    }))
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor(periodos),
      bcraCheques: chequesFor([]),
    })
    const comp = r.components.find((c) => c.key === 'antiguedad')
    expect(comp?.raw).toBe(1000)
  })

  test('antigüedad: 6m → 400', () => {
    const periodos = Array.from({ length: 6 }, (_, i) => ({
      periodo: `2026${(i + 1).toString().padStart(2, '0')}`,
      entidades: [entidad(1)],
    }))
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor(periodos),
      bcraCheques: chequesFor([]),
    })
    const comp = r.components.find((c) => c.key === 'antiguedad')
    expect(comp?.raw).toBe(400)
  })
})
