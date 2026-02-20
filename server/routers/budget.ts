import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'

const DEFAULT_CATEGORIES = [
  'Supermercado', 'Comida', 'Delivery', 'Restaurantes', 'Café',
  'Transporte', 'Combustible', 'Estacionamiento', 'Peajes',
  'Alquiler', 'Expensas', 'Servicios', 'Internet', 'Celular',
  'Electricidad', 'Gas', 'Agua',
  'Salud', 'Farmacia', 'Obra social', 'Gimnasio',
  'Educación', 'Cursos', 'Libros',
  'Ropa', 'Calzado', 'Accesorios',
  'Tecnología', 'Electrónica', 'Software', 'Suscripciones',
  'Entretenimiento', 'Streaming', 'Juegos', 'Salidas',
  'Viajes', 'Hogar', 'Mascotas', 'Regalos',
  'Seguros', 'Impuestos', 'Otros',
]

export const budgetRouter = router({
  seedDefaultCategories: protectedProcedure
    .mutation(async ({ ctx }) => {
      const operations = DEFAULT_CATEGORIES.map((name) =>
        ctx.prisma.category.upsert({
          where: { userId_name: { userId: ctx.user.id, name } },
          update: {},
          create: { userId: ctx.user.id, name },
        })
      )
      await Promise.all(operations)
      return { count: DEFAULT_CATEGORIES.length }
    }),

  setLimit: protectedProcedure
    .input(z.object({
      categoryId: z.string(),
      monthlyLimit: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify category belongs to user
      const category = await ctx.prisma.category.findFirst({
        where: { id: input.categoryId, userId: ctx.user.id },
      })
      if (!category) throw new Error('Categoría no encontrada')

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

  listCategories: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.category.findMany({
        where: { userId: ctx.user.id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    }),

  getProgress: protectedProcedure
    .input(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const { period } = input
      const [yearStr, monthStr] = period.split('-')
      const year = parseInt(yearStr)
      const month = parseInt(monthStr)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 1)

      // Get all budget limits with category info
      const limits = await ctx.prisma.budgetLimit.findMany({
        where: { userId: ctx.user.id },
        include: { category: true },
      })

      if (limits.length === 0) return []

      // Get spending for this period: installments from billing cycles + cash transactions
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

      // Sum spending by category
      const spendingByCategory: Record<string, number> = {}
      for (const inst of installments) {
        const catId = inst.transaction.categoryId
        if (catId) {
          spendingByCategory[catId] = (spendingByCategory[catId] || 0) + Number(inst.amount)
        }
      }
      for (const tx of cashTransactions) {
        if (tx.categoryId) {
          spendingByCategory[tx.categoryId] = (spendingByCategory[tx.categoryId] || 0) + Number(tx.totalAmount)
        }
      }

      return limits.map((limit) => ({
        categoryId: limit.categoryId,
        categoryName: limit.category.name,
        monthlyLimit: Number(limit.monthlyLimit),
        spent: spendingByCategory[limit.categoryId] || 0,
        percentage: limit.monthlyLimit
          ? ((spendingByCategory[limit.categoryId] || 0) / Number(limit.monthlyLimit)) * 100
          : 0,
      }))
    }),
})
