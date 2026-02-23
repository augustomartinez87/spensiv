import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import {
  calculateBudgetPercentage,
  getPeriodDateRange,
  isValidPeriod,
} from '@/lib/budget-utils'
import { ensureExpenseTaxonomyForUser } from '@/lib/expense-category-seeding'
import { sortCategoriesByExpenseTaxonomy } from '@/lib/expense-categories'

const periodInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine(isValidPeriod, { message: 'Periodo invalido (YYYY-MM, mes 01-12)' })

export const budgetRouter = router({
  seedDefaultCategories: protectedProcedure.mutation(async ({ ctx }) => {
    return ensureExpenseTaxonomyForUser(ctx.prisma, ctx.user.id)
  }),

  setLimit: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        monthlyLimit: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.user.id },
      })

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoria no encontrada',
        })
      }

      return ctx.prisma.budgetLimit.upsert({
        where: {
          userId_categoryId: { userId: ctx.user.id, categoryId: input.categoryId },
        },
        update: { monthlyLimit: input.monthlyLimit },
        create: {
          userId: ctx.user.id,
          categoryId: input.categoryId,
          monthlyLimit: input.monthlyLimit,
        },
      })
    }),

  deleteLimit: protectedProcedure
    .input(z.object({ categoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.budgetLimit.deleteMany({
        where: { userId: ctx.user.id, categoryId: input.categoryId },
      })

      return { success: true }
    }),

  listCategories: protectedProcedure.query(async ({ ctx }) => {
    await ensureExpenseTaxonomyForUser(ctx.prisma, ctx.user.id)

    const categories = await ctx.prisma.category.findMany({
      where: { userId: ctx.user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })

    return sortCategoriesByExpenseTaxonomy(categories)
  }),

  getProgress: protectedProcedure
    .input(z.object({ period: periodInputSchema }))
    .query(async ({ ctx, input }) => {
      const { period } = input
      const { startDate, endDate } = getPeriodDateRange(period)

      const limits = await ctx.prisma.budgetLimit.findMany({
        where: { userId: ctx.user.id },
        include: { category: true },
        orderBy: { category: { name: 'asc' } },
      })

      if (limits.length === 0) return []

      const [installments, cashTransactions] = await Promise.all([
        ctx.prisma.installment.findMany({
          where: {
            billingCycle: { period, card: { userId: ctx.user.id } },
            transaction: { isVoided: false, isForThirdParty: false },
          },
          include: {
            transaction: { select: { categoryId: true } },
          },
        }),
        ctx.prisma.transaction.findMany({
          where: {
            userId: ctx.user.id,
            isVoided: false,
            isForThirdParty: false,
            paymentMethod: { in: ['cash', 'transfer', 'debit_card'] },
            purchaseDate: { gte: startDate, lt: endDate },
          },
          select: { categoryId: true, totalAmount: true },
        }),
      ])

      const spendingByCategory: Record<string, number> = {}

      for (const inst of installments) {
        const catId = inst.transaction.categoryId
        if (!catId) continue
        spendingByCategory[catId] = (spendingByCategory[catId] || 0) + Number(inst.amount)
      }

      for (const tx of cashTransactions) {
        if (!tx.categoryId) continue
        spendingByCategory[tx.categoryId] =
          (spendingByCategory[tx.categoryId] || 0) + Number(tx.totalAmount)
      }

      return limits.map((limit) => {
        const spent = spendingByCategory[limit.categoryId] || 0
        const monthlyLimit = Number(limit.monthlyLimit)

        return {
          categoryId: limit.categoryId,
          categoryName: limit.category.name,
          monthlyLimit,
          spent,
          percentage: calculateBudgetPercentage(spent, monthlyLimit),
        }
      })
    }),
})
