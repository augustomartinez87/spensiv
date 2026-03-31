import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import {
  INCOME_CATEGORY_TAXONOMY,
  getCanonicalIncomeCategoryName,
  getCanonicalIncomeSubcategoryName,
  getIncomeCategoryMappingByName,
  normalizeIncomeCategoryText,
  sortIncomeCategoriesByTaxonomy,
  sortIncomeSubcategoriesByTaxonomy,
} from '@/lib/categories/income-categories'

const incomeCategoryInputSchema = z.string().min(1).max(80)
const incomeSubcategoryInputSchema = z.string().min(1).max(80)

function canonicalizeIncomeCategory(rawCategory: string): {
  category: string
  mappedSubcategory?: string
} {
  const trimmedCategory = rawCategory.trim()
  const mapping = getIncomeCategoryMappingByName(trimmedCategory)

  if (mapping) {
    return {
      category: mapping.category,
      mappedSubcategory: mapping.subcategory,
    }
  }

  return {
    category: getCanonicalIncomeCategoryName(trimmedCategory),
  }
}

function canonicalizeIncomeSubcategory(
  category: string,
  rawSubcategory?: string | null
): string | null {
  if (rawSubcategory === undefined || rawSubcategory === null) return null

  const trimmedSubcategory = rawSubcategory.trim()
  if (!trimmedSubcategory) return null

  return getCanonicalIncomeSubcategoryName(category, trimmedSubcategory)
}

function getIncomeCategoryCatalogFromIncomes(
  incomes: Array<{ category: string; subcategory: string | null }>
) {
  const categoryMap = new Map<string, { name: string; subcategories: Set<string> }>()

  for (const taxonomyCategory of INCOME_CATEGORY_TAXONOMY) {
    categoryMap.set(normalizeIncomeCategoryText(taxonomyCategory.name), {
      name: taxonomyCategory.name,
      subcategories: new Set(taxonomyCategory.subcategories),
    })
  }

  for (const income of incomes) {
    const categoryCanonical = canonicalizeIncomeCategory(income.category)
    const normalizedCategory = normalizeIncomeCategoryText(categoryCanonical.category)
    const categoryEntry = categoryMap.get(normalizedCategory) ?? {
      name: categoryCanonical.category,
      subcategories: new Set<string>(),
    }

    const resolvedSubcategory =
      canonicalizeIncomeSubcategory(categoryEntry.name, income.subcategory) ??
      categoryCanonical.mappedSubcategory ??
      null

    if (resolvedSubcategory) {
      categoryEntry.subcategories.add(resolvedSubcategory)
    }

    categoryMap.set(normalizedCategory, categoryEntry)
  }

  const categories = Array.from(categoryMap.values()).map((entry) => ({
    name: entry.name,
    subcategories: sortIncomeSubcategoriesByTaxonomy(
      entry.name,
      Array.from(entry.subcategories).map((subcategory) => ({ name: subcategory }))
    ).map((subcategory) => subcategory.name),
  }))

  return sortIncomeCategoriesByTaxonomy(categories)
}

export const incomesRouter = router({
  /**
   * Devuelve la taxonomia master de ingresos
   */
  seedDefaultCategories: protectedProcedure.mutation(async () => {
    const totalSubcategories = INCOME_CATEGORY_TAXONOMY.reduce(
      (total, entry) => total + entry.subcategories.length,
      0
    )

    return {
      totalCategories: INCOME_CATEGORY_TAXONOMY.length,
      totalSubcategories,
      createdCategories: 0,
      createdSubcategories: 0,
    }
  }),

  /**
   * Normaliza categorias/subcategorias legacy de ingresos a taxonomia actual
   */
  normalizeCategories: protectedProcedure.mutation(async ({ ctx }) => {
    const incomes = await ctx.prisma.income.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        category: true,
        subcategory: true,
      },
    })

    let normalizedIncomes = 0
    let normalizedCategories = 0
    let normalizedSubcategories = 0

    for (const income of incomes) {
      const categoryCanonical = canonicalizeIncomeCategory(income.category)
      const nextCategory = categoryCanonical.category

      const nextSubcategory =
        canonicalizeIncomeSubcategory(nextCategory, income.subcategory) ??
        categoryCanonical.mappedSubcategory ??
        null

      const categoryChanged = nextCategory !== income.category
      const subcategoryChanged = (nextSubcategory ?? null) !== (income.subcategory ?? null)

      if (!categoryChanged && !subcategoryChanged) continue

      await ctx.prisma.income.update({
        where: { id: income.id },
        data: {
          category: nextCategory,
          subcategory: nextSubcategory,
        },
      })

      normalizedIncomes += 1
      if (categoryChanged) normalizedCategories += 1
      if (subcategoryChanged) normalizedSubcategories += 1
    }

    return {
      normalizedIncomes,
      normalizedCategories,
      normalizedSubcategories,
    }
  }),

  /**
   * Lista categorias/subcategorias sugeridas + existentes en datos del usuario
   */
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const incomes = await ctx.prisma.income.findMany({
      where: { userId: ctx.user.id },
      select: { category: true, subcategory: true },
    })

    return getIncomeCategoryCatalogFromIncomes(incomes)
  }),

  /**
   * Valida/crea categoria de ingreso (persistira al guardar un ingreso)
   */
  createCategory: protectedProcedure
    .input(
      z.object({
        name: incomeCategoryInputSchema,
      })
    )
    .mutation(async ({ input }) => {
      const rawName = input.name.trim()
      if (!rawName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre de categoria invalido',
        })
      }

      const canonical = canonicalizeIncomeCategory(rawName)
      return {
        name: canonical.category,
      }
    }),

  /**
   * Valida/crea subcategoria de ingreso (persistira al guardar un ingreso)
   */
  createSubcategory: protectedProcedure
    .input(
      z.object({
        category: incomeCategoryInputSchema,
        name: incomeSubcategoryInputSchema,
      })
    )
    .mutation(async ({ input }) => {
      const categoryRaw = input.category.trim()
      const nameRaw = input.name.trim()

      if (!categoryRaw || !nameRaw) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Categoria y subcategoria son requeridas',
        })
      }

      const canonicalCategory = canonicalizeIncomeCategory(categoryRaw).category
      const canonicalSubcategory = canonicalizeIncomeSubcategory(canonicalCategory, nameRaw)

      if (!canonicalSubcategory) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre de subcategoria invalido',
        })
      }

      return {
        category: canonicalCategory,
        name: canonicalSubcategory,
      }
    }),

  /**
   * Crear ingreso
   */
  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1),
        amount: z.number().positive(),
        date: z.date(),
        category: incomeCategoryInputSchema,
        subcategory: z.string().optional(),
        isRecurring: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const canonicalCategory = canonicalizeIncomeCategory(input.category)
      const canonicalSubcategory =
        canonicalizeIncomeSubcategory(canonicalCategory.category, input.subcategory) ??
        canonicalCategory.mappedSubcategory ??
        null

      return ctx.prisma.income.create({
        data: {
          userId: ctx.user.id,
          description: input.description,
          amount: new Decimal(input.amount),
          date: input.date,
          category: canonicalCategory.category,
          subcategory: canonicalSubcategory,
          isRecurring: input.isRecurring || false,
          notes: input.notes,
        },
      })
    }),

  /**
   * Listar ingresos
   */
  list: protectedProcedure
    .input(
      z
        .object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          category: incomeCategoryInputSchema.optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.IncomeWhereInput = {
        userId: ctx.user.id,
      }

      if (input?.startDate || input?.endDate) {
        where.date = {}
        if (input.startDate) where.date.gte = input.startDate
        if (input.endDate) where.date.lte = input.endDate
      }

      if (input?.category) {
        where.category = canonicalizeIncomeCategory(input.category).category
      }

      return ctx.prisma.income.findMany({
        where,
        orderBy: {
          date: 'desc',
        },
        take: input?.limit || 50,
      })
    }),

  /**
   * Actualizar ingreso
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        description: z.string().min(1).optional(),
        amount: z.number().positive().optional(),
        date: z.date().optional(),
        category: incomeCategoryInputSchema.optional(),
        subcategory: z.string().optional().nullable(),
        isRecurring: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const income = await ctx.prisma.income.findUnique({
        where: { id },
      })

      if (!income || income.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ingreso no encontrado',
        })
      }

      let nextCategory = income.category
      let nextSubcategory: string | null = income.subcategory
      let mappedSubcategoryFromCategory: string | null = null

      if (data.category !== undefined) {
        const canonicalCategory = canonicalizeIncomeCategory(data.category)
        nextCategory = canonicalCategory.category
        mappedSubcategoryFromCategory = canonicalCategory.mappedSubcategory ?? null
      }

      if (data.subcategory !== undefined) {
        nextSubcategory = canonicalizeIncomeSubcategory(nextCategory, data.subcategory)
      } else if (mappedSubcategoryFromCategory && !nextSubcategory) {
        nextSubcategory = canonicalizeIncomeSubcategory(
          nextCategory,
          mappedSubcategoryFromCategory
        )
      } else if (nextSubcategory) {
        nextSubcategory = canonicalizeIncomeSubcategory(nextCategory, nextSubcategory)
      }

      return ctx.prisma.income.update({
        where: { id },
        data: {
          description: data.description,
          amount: data.amount ? new Decimal(data.amount) : undefined,
          date: data.date,
          category: data.category !== undefined ? nextCategory : undefined,
          subcategory:
            data.subcategory !== undefined || data.category !== undefined
              ? nextSubcategory
              : undefined,
          isRecurring: data.isRecurring,
          notes: data.notes,
        },
      })
    }),

  /**
   * Eliminar ingreso
   */
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const income = await ctx.prisma.income.findUnique({
      where: { id: input },
    })

    if (!income || income.userId !== ctx.user.id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Ingreso no encontrado',
      })
    }

    return ctx.prisma.income.delete({
      where: { id: input },
    })
  }),

})
