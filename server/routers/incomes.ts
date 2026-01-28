import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import { Decimal } from '@prisma/client/runtime/library'

export const incomesRouter = router({
    /**
     * Crear ingreso
     */
    create: protectedProcedure
        .input(
            z.object({
                description: z.string().min(1),
                amount: z.number().positive(),
                date: z.date(),
                category: z.enum(['active_income', 'other_income']),
                subcategory: z.string().optional(),
                isRecurring: z.boolean().optional(),
                notes: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.income.create({
                data: {
                    userId: ctx.user.id,
                    description: input.description,
                    amount: new Decimal(input.amount),
                    date: input.date,
                    category: input.category,
                    subcategory: input.subcategory,
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
                    category: z.enum(['active_income', 'other_income']).optional(),
                    limit: z.number().min(1).max(100).optional(),
                })
                .optional()
        )
        .query(async ({ ctx, input }) => {
            const where: any = {
                userId: ctx.user.id,
            }

            if (input?.startDate || input?.endDate) {
                where.date = {}
                if (input.startDate) where.date.gte = input.startDate
                if (input.endDate) where.date.lte = input.endDate
            }

            if (input?.category) {
                where.category = input.category
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
     * Obtener ingreso por ID
     */
    getById: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
        const income = await ctx.prisma.income.findUnique({
            where: { id: input },
        })

        if (!income || income.userId !== ctx.user.id) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Ingreso no encontrado',
            })
        }

        return income
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
                category: z.enum(['active_income', 'other_income']).optional(),
                subcategory: z.string().optional(),
                isRecurring: z.boolean().optional(),
                notes: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input

            // Verificar que el ingreso pertenece al usuario
            const income = await ctx.prisma.income.findUnique({
                where: { id },
            })

            if (!income || income.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Ingreso no encontrado',
                })
            }

            return ctx.prisma.income.update({
                where: { id },
                data: {
                    ...data,
                    amount: data.amount ? new Decimal(data.amount) : undefined,
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

    /**
     * Estadísticas de ingresos
     */
    getStats: protectedProcedure
        .input(
            z.object({
                startDate: z.date(),
                endDate: z.date(),
            })
        )
        .query(async ({ ctx, input }) => {
            const incomes = await ctx.prisma.income.findMany({
                where: {
                    userId: ctx.user.id,
                    date: {
                        gte: input.startDate,
                        lte: input.endDate,
                    },
                },
            })

            const total = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0)

            const byCategory = incomes.reduce(
                (acc, inc) => {
                    acc[inc.category] = (acc[inc.category] || 0) + Number(inc.amount)
                    return acc
                },
                {} as Record<string, number>
            )

            const bySubcategory = incomes.reduce(
                (acc, inc) => {
                    if (inc.subcategory) {
                        acc[inc.subcategory] = (acc[inc.subcategory] || 0) + Number(inc.amount)
                    }
                    return acc
                },
                {} as Record<string, number>
            )

            return {
                total,
                count: incomes.length,
                byCategory,
                bySubcategory,
                recurring: incomes.filter((inc) => inc.isRecurring).length,
            }
        }),
})
