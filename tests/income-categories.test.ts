import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCanonicalIncomeCategoryName,
  getCanonicalIncomeSubcategoryName,
  getIncomeCategoryMappingByName,
  sortIncomeCategoriesByTaxonomy,
  sortIncomeSubcategoriesByTaxonomy,
} from '../lib/income-categories'

test('getIncomeCategoryMappingByName mapea categorias legacy', () => {
  assert.deepEqual(getIncomeCategoryMappingByName('active_income'), {
    category: 'Ingresos Activos',
  })
  assert.deepEqual(getIncomeCategoryMappingByName('Ingresos Pasivos'), {
    category: 'Ingresos Pasivos',
  })
  assert.deepEqual(getIncomeCategoryMappingByName('sueldo'), {
    category: 'Ingresos Activos',
    subcategory: 'Sueldo',
  })
})

test('canonicaliza categoria y subcategoria de ingresos', () => {
  assert.equal(getCanonicalIncomeCategoryName(' ingresos activos '), 'Ingresos Activos')
  assert.equal(
    getCanonicalIncomeSubcategoryName('Ingresos Activos', 'comisiones/bonos'),
    'Comisiones/Bonos'
  )
  assert.equal(
    getCanonicalIncomeSubcategoryName('Otros Ingresos', 'Transferencia de terceros'),
    'Transferencia de terceros'
  )
})

test('ordena categorias y subcategorias segun taxonomia', () => {
  const categories = sortIncomeCategoriesByTaxonomy([
    { name: 'Otros Ingresos' },
    { name: 'Ingresos Pasivos' },
    { name: 'Ingresos Activos' },
    { name: 'Categoria Custom' },
  ])

  assert.deepEqual(categories.map((category) => category.name), [
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

  assert.deepEqual(subcategories.map((subcategory) => subcategory.name), [
    'Sueldo',
    'Freelance',
    'Aguinaldo',
    'Custom',
  ])
})
