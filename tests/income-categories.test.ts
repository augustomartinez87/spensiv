import { test, expect } from 'vitest'
import {
  getCanonicalIncomeCategoryName,
  getCanonicalIncomeSubcategoryName,
  getIncomeCategoryMappingByName,
  sortIncomeCategoriesByTaxonomy,
  sortIncomeSubcategoriesByTaxonomy,
} from '../lib/categories/income-categories'

test('getIncomeCategoryMappingByName mapea categorias legacy', () => {
  expect(getIncomeCategoryMappingByName('active_income')).toEqual({
    category: 'Ingresos Activos',
  })
  expect(getIncomeCategoryMappingByName('Ingresos Pasivos')).toEqual({
    category: 'Ingresos Pasivos',
  })
  expect(getIncomeCategoryMappingByName('sueldo')).toEqual({
    category: 'Ingresos Activos',
    subcategory: 'Sueldo',
  })
})

test('canonicaliza categoria y subcategoria de ingresos', () => {
  expect(getCanonicalIncomeCategoryName(' ingresos activos ')).toBe('Ingresos Activos')
  expect(
    getCanonicalIncomeSubcategoryName('Ingresos Activos', 'comisiones/bonos')
  ).toBe('Comisiones/Bonos')
  expect(
    getCanonicalIncomeSubcategoryName('Otros Ingresos', 'Transferencia de terceros')
  ).toBe('Transferencia de terceros')
})

test('ordena categorias y subcategorias segun taxonomia', () => {
  const categories = sortIncomeCategoriesByTaxonomy([
    { name: 'Otros Ingresos' },
    { name: 'Ingresos Pasivos' },
    { name: 'Ingresos Activos' },
    { name: 'Categoria Custom' },
  ])

  expect(categories.map((category) => category.name)).toEqual([
    'Ingresos Activos',
    'Ingresos Pasivos',
    'Otros Ingresos',
    'Categoria Custom',
  ])

  const subcategories = sortIncomeSubcategoriesByTaxonomy('Ingresos Activos', [
    { name: 'Aguinaldo' },
    { name: 'Freelance' },
    { name: 'Sueldo' },
    { name: 'Custom' },
  ])

  expect(subcategories.map((subcategory) => subcategory.name)).toEqual([
    'Sueldo',
    'Freelance',
    'Aguinaldo',
    'Custom',
  ])
})
