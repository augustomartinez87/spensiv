import { describe, test, expect } from 'vitest'
import { isValidCuit, normalizeCuit, formatCuit, cuitKind } from '../lib/cuit'

describe('normalizeCuit', () => {
  test('quita guiones, puntos y espacios', () => {
    expect(normalizeCuit('20-12345678-9')).toBe('20123456789')
    expect(normalizeCuit('20.123.456.78-9')).toBe('20123456789')
    expect(normalizeCuit('  20 12345678 9  ')).toBe('20123456789')
  })

  test('preserva CUIT ya normalizado', () => {
    expect(normalizeCuit('20123456789')).toBe('20123456789')
  })
})

describe('formatCuit', () => {
  test('formatea XX-XXXXXXXX-X cuando tiene 11 dígitos', () => {
    expect(formatCuit('20123456789')).toBe('20-12345678-9')
  })

  test('devuelve el input si no tiene 11 dígitos', () => {
    expect(formatCuit('123')).toBe('123')
  })
})

describe('isValidCuit', () => {
  // CUITs reales conocidos (públicos): AFIP/BCRA tienen test data públicas.
  // Usamos algunos calculados a mano siguiendo el algoritmo oficial.

  test('CUIT válido de empresa (30-50001091-2 — ejemplo BCRA)', () => {
    expect(isValidCuit('30500010912')).toBe(true)
  })

  test('CUIT válido con formato libre', () => {
    expect(isValidCuit('30-50001091-2')).toBe(true)
    expect(isValidCuit('30.50001091.2')).toBe(true)
  })

  test('rechaza CUIT con dígito verificador incorrecto', () => {
    expect(isValidCuit('30500010913')).toBe(false) // dígito mal
    expect(isValidCuit('20123456780')).toBe(false)
  })

  test('rechaza prefijo inválido', () => {
    // 11 dígitos, pero prefijo 99 no es válido en AR
    expect(isValidCuit('99500010912')).toBe(false)
    expect(isValidCuit('00500010912')).toBe(false)
  })

  test('rechaza longitud distinta a 11', () => {
    expect(isValidCuit('305000109')).toBe(false)
    expect(isValidCuit('305000109120')).toBe(false)
    expect(isValidCuit('')).toBe(false)
  })

  test('rechaza no-dígitos', () => {
    expect(isValidCuit('abcdefghijk')).toBe(false)
    expect(isValidCuit('20-1234567X-9')).toBe(false)
  })

  test('regla 10 → 9: dígito esperado debe ser 9 cuando módulo da 1', () => {
    // Cuando 11 - mod = 10, el dígito verificador se reemplaza por 9.
    // 27-22222221-?: suma = 5·2+4·7+3·2+2·2+7·2+6·2+5·2+4·2+3·2+2·1 = 100
    // 100 % 11 = 1 → 11-1 = 10 → regla → 9. CUIT válido: 27-22222221-9.
    expect(isValidCuit('27222222219')).toBe(true)
    // Si fuera el dígito calculado sin la regla (10), sería inválido:
    expect(isValidCuit('27222222218')).toBe(false)
  })

  test('CUITs persona física comunes', () => {
    // 20-12345678-X y 27-12345678-X — calculamos los dígitos verificadores válidos.
    // Para 20-12345678: 5*2+4*0+3*1+2*2+7*3+6*4+5*5+4*6+3*7+2*8 = 10+0+3+4+21+24+25+24+21+16 = 148
    // 148 % 11 = 5, 11-5 = 6. CUIT válido: 20123456786.
    expect(isValidCuit('20123456786')).toBe(true)
    expect(isValidCuit('20123456789')).toBe(false)
  })
})

describe('cuitKind', () => {
  test('clasifica personas físicas', () => {
    expect(cuitKind('20123456786')).toBe('persona')
    expect(cuitKind('27123456786')).toBe('persona')
    expect(cuitKind('23123456786')).toBe('persona')
  })

  test('clasifica empresas', () => {
    expect(cuitKind('30500010912')).toBe('empresa')
    expect(cuitKind('33500010912')).toBe('empresa')
  })

  test('clasifica jurídicas extranjeras', () => {
    expect(cuitKind('50500010912')).toBe('extranjera')
  })

  test('desconocido para prefijos no estándar', () => {
    expect(cuitKind('99500010912')).toBe('desconocido')
  })
})
