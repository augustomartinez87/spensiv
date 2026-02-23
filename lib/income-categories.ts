export type IncomeCategoryTaxonomyEntry = {
  name: string
  subcategories: string[]
}

export const INCOME_CATEGORY_TAXONOMY: IncomeCategoryTaxonomyEntry[] = [
  {
    name: 'Ingresos Activos',
    subcategories: ['Sueldo', 'Freelance', 'Comisiones/Bonos', 'Aguinaldo'],
  },
  {
    name: 'Ingresos Pasivos',
    subcategories: ['Intereses', 'Dividendos'],
  },
  {
    name: 'Otros Ingresos',
    subcategories: ['Venta de activos', 'Regalos', 'Transferencia de terceros'],
  },
]

export const MASTER_INCOME_CATEGORY_NAMES = INCOME_CATEGORY_TAXONOMY.map(
  (entry) => entry.name
)

type IncomeCategoryMapping = {
  category: string
  subcategory?: string
}

const MASTER_CATEGORY_NAME_BY_NORMALIZED = new Map(
  MASTER_INCOME_CATEGORY_NAMES.map((name) => [normalizeIncomeCategoryText(name), name])
)

const MASTER_CATEGORY_ORDER = new Map(
  MASTER_INCOME_CATEGORY_NAMES.map((name, index) => [normalizeIncomeCategoryText(name), index])
)

const SUBCATEGORY_ORDER_BY_CATEGORY = new Map(
  INCOME_CATEGORY_TAXONOMY.map((entry) => [
    normalizeIncomeCategoryText(entry.name),
    new Map(
      entry.subcategories.map((subcategory, index) => [
        normalizeIncomeCategoryText(subcategory),
        index,
      ])
    ),
  ])
)

const SUBCATEGORY_NAME_BY_CATEGORY = new Map(
  INCOME_CATEGORY_TAXONOMY.map((entry) => [
    normalizeIncomeCategoryText(entry.name),
    new Map(
      entry.subcategories.map((subcategory) => [
        normalizeIncomeCategoryText(subcategory),
        subcategory,
      ])
    ),
  ])
)

const LEGACY_INCOME_CATEGORY_MAPPINGS: Record<string, IncomeCategoryMapping> = {
  active_income: { category: 'Ingresos Activos' },
  ingreso_activo: { category: 'Ingresos Activos' },
  ingresos_activos: { category: 'Ingresos Activos' },
  'ingreso activo': { category: 'Ingresos Activos' },
  'ingresos activos': { category: 'Ingresos Activos' },

  passive_income: { category: 'Ingresos Pasivos' },
  ingreso_pasivo: { category: 'Ingresos Pasivos' },
  ingresos_pasivos: { category: 'Ingresos Pasivos' },
  'ingreso pasivo': { category: 'Ingresos Pasivos' },
  'ingresos pasivos': { category: 'Ingresos Pasivos' },

  other_income: { category: 'Otros Ingresos' },
  ingreso_otro: { category: 'Otros Ingresos' },
  otros_ingresos: { category: 'Otros Ingresos' },
  'otro ingreso': { category: 'Otros Ingresos' },
  'otros ingresos': { category: 'Otros Ingresos' },

  sueldo: { category: 'Ingresos Activos', subcategory: 'Sueldo' },
  salario: { category: 'Ingresos Activos', subcategory: 'Sueldo' },
  freelance: { category: 'Ingresos Activos', subcategory: 'Freelance' },
  comisiones: { category: 'Ingresos Activos', subcategory: 'Comisiones/Bonos' },
  bonus: { category: 'Ingresos Activos', subcategory: 'Comisiones/Bonos' },
  bonos: { category: 'Ingresos Activos', subcategory: 'Comisiones/Bonos' },
  'comisiones/bonos': { category: 'Ingresos Activos', subcategory: 'Comisiones/Bonos' },
  aguinaldo: { category: 'Ingresos Activos', subcategory: 'Aguinaldo' },

  intereses: { category: 'Ingresos Pasivos', subcategory: 'Intereses' },
  interes: { category: 'Ingresos Pasivos', subcategory: 'Intereses' },
  dividendos: { category: 'Ingresos Pasivos', subcategory: 'Dividendos' },
  dividendo: { category: 'Ingresos Pasivos', subcategory: 'Dividendos' },

  'venta de activos': { category: 'Otros Ingresos', subcategory: 'Venta de activos' },
  'venta activos': { category: 'Otros Ingresos', subcategory: 'Venta de activos' },
  'asset sale': { category: 'Otros Ingresos', subcategory: 'Venta de activos' },
  regalos: { category: 'Otros Ingresos', subcategory: 'Regalos' },
  regalo: { category: 'Otros Ingresos', subcategory: 'Regalos' },
  'transferencia de terceros': {
    category: 'Otros Ingresos',
    subcategory: 'Transferencia de terceros',
  },
  'transferencia terceros': {
    category: 'Otros Ingresos',
    subcategory: 'Transferencia de terceros',
  },
  third_party_transfer: {
    category: 'Otros Ingresos',
    subcategory: 'Transferencia de terceros',
  },
}

const UNIQUE_SUBCATEGORY_MAPPINGS = (() => {
  const byNormalizedSubcategory = new Map<
    string,
    Array<{ category: string; subcategory: string }>
  >()

  for (const entry of INCOME_CATEGORY_TAXONOMY) {
    for (const subcategory of entry.subcategories) {
      const key = normalizeIncomeCategoryText(subcategory)
      const current = byNormalizedSubcategory.get(key) || []
      current.push({ category: entry.name, subcategory })
      byNormalizedSubcategory.set(key, current)
    }
  }

  const unique = new Map<string, { category: string; subcategory: string }>()
  for (const [key, entries] of byNormalizedSubcategory.entries()) {
    if (entries.length === 1) {
      unique.set(key, entries[0])
    }
  }

  return unique
})()

export function normalizeIncomeCategoryText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function isMasterIncomeCategory(name: string): boolean {
  return MASTER_CATEGORY_ORDER.has(normalizeIncomeCategoryText(name))
}

export function getCanonicalIncomeCategoryName(rawName: string): string {
  const normalized = normalizeIncomeCategoryText(rawName)
  return MASTER_CATEGORY_NAME_BY_NORMALIZED.get(normalized) ?? rawName.trim()
}

export function getCanonicalIncomeSubcategoryName(
  categoryName: string,
  rawSubcategoryName: string
): string {
  const normalizedCategory = normalizeIncomeCategoryText(categoryName)
  const normalizedSubcategory = normalizeIncomeCategoryText(rawSubcategoryName)

  const canonicalSubcategory = SUBCATEGORY_NAME_BY_CATEGORY
    .get(normalizedCategory)
    ?.get(normalizedSubcategory)

  return canonicalSubcategory ?? rawSubcategoryName.trim()
}

export function getIncomeCategoryMappingByName(rawCategoryName: string): IncomeCategoryMapping | null {
  const normalized = normalizeIncomeCategoryText(rawCategoryName)

  const legacyMapping = LEGACY_INCOME_CATEGORY_MAPPINGS[normalized]
  if (legacyMapping) return legacyMapping

  const canonicalCategoryName = MASTER_CATEGORY_NAME_BY_NORMALIZED.get(normalized)
  if (canonicalCategoryName) return { category: canonicalCategoryName }

  const uniqueSubcategoryMapping = UNIQUE_SUBCATEGORY_MAPPINGS.get(normalized)
  if (uniqueSubcategoryMapping) {
    return uniqueSubcategoryMapping
  }

  return null
}

export function sortIncomeCategoriesByTaxonomy<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const aOrder = MASTER_CATEGORY_ORDER.get(normalizeIncomeCategoryText(a.name))
    const bOrder = MASTER_CATEGORY_ORDER.get(normalizeIncomeCategoryText(b.name))

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1

    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  })
}

export function sortIncomeSubcategoriesByTaxonomy<T extends { name: string }>(
  categoryName: string,
  subcategories: T[]
): T[] {
  const normalizedCategory = normalizeIncomeCategoryText(categoryName)
  const orderMap = SUBCATEGORY_ORDER_BY_CATEGORY.get(normalizedCategory)

  return [...subcategories].sort((a, b) => {
    const aOrder = orderMap?.get(normalizeIncomeCategoryText(a.name))
    const bOrder = orderMap?.get(normalizeIncomeCategoryText(b.name))

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1

    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  })
}
