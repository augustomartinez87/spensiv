export type ExpenseCategoryTaxonomyEntry = {
  name: string
  subcategories: string[]
}

export const EXPENSE_CATEGORY_TAXONOMY: ExpenseCategoryTaxonomyEntry[] = [
  {
    name: 'Gastos Fijos',
    subcategories: [
      'Mascotas',
      'Salud',
      'Deporte y Bienestar',
      'Belleza y Cuidado Personal',
      'Transporte',
      'Seguros',
      'Alquiler',
      'Servicios',
      'Comida Básica',
    ],
  },
  {
    name: 'Educación',
    subcategories: ['Facultad', 'Cursos', 'Libros'],
  },
  {
    name: 'Lujos',
    subcategories: [
      'Suscripciones',
      'Gastos Generales',
      'Salidas',
      'Ropa',
      'Entretenimiento',
      'Transporte',
      'Consumo',
    ],
  },
  {
    name: 'Deudas',
    subcategories: ['Préstamos Personales'],
  },
  {
    name: 'Inversiones',
    subcategories: [
      'Inversiones Financieras',
      'Ahorros Específicos',
      'Restante/Buffer',
      'FCI',
      'Acciones',
      'Otros Activos',
    ],
  },
]

export const MASTER_EXPENSE_CATEGORY_NAMES = EXPENSE_CATEGORY_TAXONOMY.map(
  (entry) => entry.name
)

const MASTER_CATEGORY_NAME_BY_NORMALIZED = new Map(
  MASTER_EXPENSE_CATEGORY_NAMES.map((name) => [normalizeExpenseCategoryText(name), name])
)

const MASTER_CATEGORY_ORDER = new Map(
  MASTER_EXPENSE_CATEGORY_NAMES.map((name, index) => [normalizeExpenseCategoryText(name), index])
)

const SUBCATEGORY_ORDER_BY_CATEGORY = new Map(
  EXPENSE_CATEGORY_TAXONOMY.map((entry) => [
    normalizeExpenseCategoryText(entry.name),
    new Map(
      entry.subcategories.map((subcategory, index) => [
        normalizeExpenseCategoryText(subcategory),
        index,
      ])
    ),
  ])
)

const SUBCATEGORY_NAME_BY_CATEGORY = new Map(
  EXPENSE_CATEGORY_TAXONOMY.map((entry) => [
    normalizeExpenseCategoryText(entry.name),
    new Map(
      entry.subcategories.map((subcategory) => [
        normalizeExpenseCategoryText(subcategory),
        subcategory,
      ])
    ),
  ])
)

type ExpenseCategoryMapping = {
  category: string
  subcategory?: string
}

const LEGACY_CATEGORY_MAPPINGS: Record<string, ExpenseCategoryMapping> = {
  supermercado: { category: 'Gastos Fijos', subcategory: 'Comida Básica' },
  comida: { category: 'Gastos Fijos', subcategory: 'Comida Básica' },
  'comida basica': { category: 'Gastos Fijos', subcategory: 'Comida Básica' },
  delivery: { category: 'Lujos', subcategory: 'Consumo' },
  restaurantes: { category: 'Lujos', subcategory: 'Salidas' },
  cafe: { category: 'Lujos', subcategory: 'Consumo' },
  transporte: { category: 'Gastos Fijos', subcategory: 'Transporte' },
  combustible: { category: 'Gastos Fijos', subcategory: 'Transporte' },
  estacionamiento: { category: 'Gastos Fijos', subcategory: 'Transporte' },
  peajes: { category: 'Gastos Fijos', subcategory: 'Transporte' },
  alquiler: { category: 'Gastos Fijos', subcategory: 'Alquiler' },
  expensas: { category: 'Gastos Fijos', subcategory: 'Servicios' },
  servicios: { category: 'Gastos Fijos', subcategory: 'Servicios' },
  internet: { category: 'Gastos Fijos', subcategory: 'Servicios' },
  celular: { category: 'Gastos Fijos', subcategory: 'Servicios' },
  electricidad: { category: 'Gastos Fijos', subcategory: 'Servicios' },
  gas: { category: 'Gastos Fijos', subcategory: 'Servicios' },
  agua: { category: 'Gastos Fijos', subcategory: 'Servicios' },
  salud: { category: 'Gastos Fijos', subcategory: 'Salud' },
  farmacia: { category: 'Gastos Fijos', subcategory: 'Salud' },
  'obra social': { category: 'Gastos Fijos', subcategory: 'Salud' },
  gimnasio: { category: 'Gastos Fijos', subcategory: 'Deporte y Bienestar' },
  educacion: { category: 'Educación', subcategory: 'Facultad' },
  cursos: { category: 'Educación', subcategory: 'Cursos' },
  libros: { category: 'Educación', subcategory: 'Libros' },
  ropa: { category: 'Lujos', subcategory: 'Ropa' },
  calzado: { category: 'Lujos', subcategory: 'Ropa' },
  accesorios: { category: 'Lujos', subcategory: 'Ropa' },
  tecnologia: { category: 'Lujos', subcategory: 'Consumo' },
  electronica: { category: 'Lujos', subcategory: 'Consumo' },
  software: { category: 'Lujos', subcategory: 'Consumo' },
  suscripciones: { category: 'Lujos', subcategory: 'Suscripciones' },
  entretenimiento: { category: 'Lujos', subcategory: 'Entretenimiento' },
  streaming: { category: 'Lujos', subcategory: 'Entretenimiento' },
  juegos: { category: 'Lujos', subcategory: 'Entretenimiento' },
  salidas: { category: 'Lujos', subcategory: 'Salidas' },
  viajes: { category: 'Lujos', subcategory: 'Gastos Generales' },
  hogar: { category: 'Lujos', subcategory: 'Gastos Generales' },
  mascotas: { category: 'Gastos Fijos', subcategory: 'Mascotas' },
  regalos: { category: 'Lujos', subcategory: 'Gastos Generales' },
  seguros: { category: 'Gastos Fijos', subcategory: 'Seguros' },
  impuestos: { category: 'Lujos', subcategory: 'Gastos Generales' },
  otros: { category: 'Lujos', subcategory: 'Gastos Generales' },
  deudas: { category: 'Deudas' },
  prestamo: { category: 'Deudas', subcategory: 'Préstamos Personales' },
  prestamos: { category: 'Deudas', subcategory: 'Préstamos Personales' },
  'prestamo personal': { category: 'Deudas', subcategory: 'Préstamos Personales' },
  'prestamos personales': { category: 'Deudas', subcategory: 'Préstamos Personales' },
  inversiones: { category: 'Inversiones' },
  'inversiones financieras': { category: 'Inversiones', subcategory: 'Inversiones Financieras' },
  ahorros: { category: 'Inversiones', subcategory: 'Ahorros Específicos' },
  'ahorros especificos': { category: 'Inversiones', subcategory: 'Ahorros Específicos' },
  'restante/buffer': { category: 'Inversiones', subcategory: 'Restante/Buffer' },
  restante: { category: 'Inversiones', subcategory: 'Restante/Buffer' },
  buffer: { category: 'Inversiones', subcategory: 'Restante/Buffer' },
  fci: { category: 'Inversiones', subcategory: 'FCI' },
  acciones: { category: 'Inversiones', subcategory: 'Acciones' },
  'otros activos': { category: 'Inversiones', subcategory: 'Otros Activos' },
}

const UNIQUE_SUBCATEGORY_MAPPINGS = (() => {
  const byNormalizedSubcategory = new Map<
    string,
    Array<{ category: string; subcategory: string }>
  >()

  for (const entry of EXPENSE_CATEGORY_TAXONOMY) {
    for (const subcategory of entry.subcategories) {
      const key = normalizeExpenseCategoryText(subcategory)
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

const SUBCATEGORY_CANDIDATES = (() => {
  const byNormalizedSubcategory = new Map<
    string,
    Array<{ category: string; subcategory: string }>
  >()

  for (const entry of EXPENSE_CATEGORY_TAXONOMY) {
    for (const subcategory of entry.subcategories) {
      const normalizedSubcategory = normalizeExpenseCategoryText(subcategory)
      const current = byNormalizedSubcategory.get(normalizedSubcategory) || []
      current.push({ category: entry.name, subcategory })
      byNormalizedSubcategory.set(normalizedSubcategory, current)
    }
  }

  return byNormalizedSubcategory
})()

const MASTER_SUBCATEGORY_SET_BY_CATEGORY = new Map(
  EXPENSE_CATEGORY_TAXONOMY.map((entry) => [
    normalizeExpenseCategoryText(entry.name),
    new Set(entry.subcategories.map((subcategory) => normalizeExpenseCategoryText(subcategory))),
  ])
)

const MASTER_SUBCATEGORIES_BY_CATEGORY = new Map(
  EXPENSE_CATEGORY_TAXONOMY.map((entry) => [
    normalizeExpenseCategoryText(entry.name),
    [...entry.subcategories],
  ])
)

export function normalizeExpenseCategoryText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function isMasterExpenseCategory(name: string): boolean {
  return MASTER_CATEGORY_ORDER.has(normalizeExpenseCategoryText(name))
}

export function getCanonicalExpenseCategoryName(rawName: string): string {
  const normalized = normalizeExpenseCategoryText(rawName)
  return MASTER_CATEGORY_NAME_BY_NORMALIZED.get(normalized) ?? rawName.trim()
}

export function sortCategoriesByExpenseTaxonomy<T extends { name: string }>(
  categories: T[]
): T[] {
  return [...categories].sort((a, b) => {
    const aOrder = MASTER_CATEGORY_ORDER.get(normalizeExpenseCategoryText(a.name))
    const bOrder = MASTER_CATEGORY_ORDER.get(normalizeExpenseCategoryText(b.name))

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1

    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  })
}

export function getExpenseCategoryMappingByName(
  rawCategoryName: string
): ExpenseCategoryMapping | null {
  const normalized = normalizeExpenseCategoryText(rawCategoryName)

  const legacyMapping = LEGACY_CATEGORY_MAPPINGS[normalized]
  if (legacyMapping) return legacyMapping

  const masterOrder = MASTER_CATEGORY_ORDER.get(normalized)
  if (masterOrder !== undefined) {
    return {
      category: MASTER_EXPENSE_CATEGORY_NAMES[masterOrder],
    }
  }

  const uniqueSubcategoryMapping = UNIQUE_SUBCATEGORY_MAPPINGS.get(normalized)
  if (uniqueSubcategoryMapping) {
    return uniqueSubcategoryMapping
  }

  return null
}

export function getCanonicalExpenseSubcategoryName(
  categoryName: string,
  rawSubcategoryName: string
): string {
  const normalizedCategory = normalizeExpenseCategoryText(categoryName)
  const normalizedSubcategory = normalizeExpenseCategoryText(rawSubcategoryName)

  const canonicalSubcategory = SUBCATEGORY_NAME_BY_CATEGORY
    .get(normalizedCategory)
    ?.get(normalizedSubcategory)

  return canonicalSubcategory ?? rawSubcategoryName.trim()
}

export function isMasterExpenseSubcategory(
  categoryName: string,
  subcategoryName: string
): boolean {
  const normalizedCategory = normalizeExpenseCategoryText(categoryName)
  const normalizedSubcategory = normalizeExpenseCategoryText(subcategoryName)
  return (
    MASTER_SUBCATEGORY_SET_BY_CATEGORY.get(normalizedCategory)?.has(normalizedSubcategory) ??
    false
  )
}

export function getExpenseSubcategoryCandidatesByName(
  rawSubcategoryName: string
): Array<{ category: string; subcategory: string }> {
  const normalizedSubcategory = normalizeExpenseCategoryText(rawSubcategoryName)
  return SUBCATEGORY_CANDIDATES.get(normalizedSubcategory) || []
}

export function sortSubcategoriesByExpenseTaxonomy<T extends { name: string }>(
  categoryName: string,
  subcategories: T[]
): T[] {
  const normalizedCategory = normalizeExpenseCategoryText(categoryName)
  const orderMap = SUBCATEGORY_ORDER_BY_CATEGORY.get(normalizedCategory)

  return [...subcategories].sort((a, b) => {
    const aOrder = orderMap?.get(normalizeExpenseCategoryText(a.name))
    const bOrder = orderMap?.get(normalizeExpenseCategoryText(b.name))

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1

    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  })
}
