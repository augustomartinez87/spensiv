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

function chequesFor(
  detalles: { fechaRechazo: string; monto?: number; fechaPago?: string }[]
): BcraChequesResponse {
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
                    fechaPago: d.fechaPago,
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

  test('sin entidades → flag sin_historial_crediticio + componente entidades neutro + cap 600', () => {
    const r = calculateScore({
      bcraDeudas: null,
      bcraHistoricas: null,
      bcraCheques: null,
    })
    expect(r.flags).toContain('sin_historial_crediticio')
    const comp = r.components.find((c) => c.key === 'entidades')
    expect(comp?.neutral).toBe(true)
    expect(comp?.raw).toBe(500)
    // Sin historial debe capear a 600 para no marcar "apto sin reservas" a un desconocido
    expect(r.overrides.some((o) => o.capAt === 600)).toBe(true)
    expect(r.score).toBeLessThanOrEqual(600)
  })

  test('1 cheque PENDIENTE dentro de 12m → -250, comp = 750', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 3)
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([{ fechaRechazo: recent.toISOString().slice(0, 10) }]),
    })
    const comp = r.components.find((c) => c.key === 'cheques')
    expect(comp?.raw).toBe(750) // 1000 - 250 (pendiente)
    expect(r.flags).toContain('cheques_pendientes_1')
  })

  test('1 cheque PAGADO en 12m penaliza menos (-75)', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 3)
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([
        { fechaRechazo: recent.toISOString().slice(0, 10), fechaPago: '2026-01-15' },
      ]),
    })
    const comp = r.components.find((c) => c.key === 'cheques')
    expect(comp?.raw).toBe(925) // 1000 - 75 (pagado)
    expect(r.flags).toContain('cheques_regularizados_1')
  })

  test('3 cheques pendientes → cap 400 + componente bajo', () => {
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
    // 1000 - 250 - 250 - 400 = 100
    expect(comp?.raw).toBe(100)
    expect(r.overrides.some((o) => o.capAt === 400)).toBe(true)
    expect(r.score).toBeLessThanOrEqual(400)
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

  test('AFIP estado != ACTIVO → flag + cap 350', () => {
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
      afip: { estadoClave: 'INACTIVO' },
    })
    expect(r.flags.some((f) => f.startsWith('afip_'))).toBe(true)
    expect(r.overrides.some((o) => o.capAt === 350)).toBe(true)
    expect(r.score).toBeLessThanOrEqual(350)
  })

  test('AFIP estado ACTIVO no penaliza', () => {
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(1)]),
      bcraHistoricas: historicasFor([]),
      bcraCheques: chequesFor([]),
      afip: { estadoClave: 'ACTIVO' },
    })
    expect(r.flags.some((f) => f.startsWith('afip_'))).toBe(false)
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

  test('antigüedad: 24m con datos limpios → 1000', () => {
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

  test('antigüedad: 6m limpios → 400', () => {
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

  test('antigüedad: 24m de impagos NO premia (debe ser 100, no 1000)', () => {
    const periodos = Array.from({ length: 24 }, (_, i) => ({
      periodo: `2024${(i + 1).toString().padStart(2, '0')}`,
      entidades: [entidad(3)], // siempre con problemas
    }))
    const r = calculateScore({
      bcraDeudas: deudasFor([entidad(3)]),
      bcraHistoricas: historicasFor(periodos),
      bcraCheques: chequesFor([]),
    })
    const comp = r.components.find((c) => c.key === 'antiguedad')
    expect(comp?.raw).toBe(100) // antes daba 1000 — bug premiar 24m de impagos
  })
})
