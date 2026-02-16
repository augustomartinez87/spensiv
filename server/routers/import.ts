import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { createTransactionWithInstallments } from '@/lib/installment-engine'
import { PaymentMethod } from '@/lib/installment-engine'

const incomeItemSchema = z.object({
    date: z.string(),
    description: z.string(),
    category: z.string(),
    subcategory: z.string().optional(),
    amount: z.number(),
    impactMonth: z.string().optional(),
})

const importItemSchema = z.object({
    date: z.string(),
    description: z.string(),
    category: z.string(),
    subcategory: z.string().optional(),
    expenseType: z.enum(['structural', 'emotional_recurrent', 'emotional_impulsive']).optional(),
    paymentMethod: z.enum(['credit_card', 'cash', 'transfer', 'debit_card']),
    bank: z.string().optional(),
    cardName: z.string().optional(),
    amount: z.number(),
    installments: z.number().default(1),
})

export const importRouter = router({
    bulkTransactions: protectedProcedure
        .input(z.array(importItemSchema))
        .mutation(async ({ ctx, input }) => {
            const results = {
                success: 0,
                errors: [] as string[],
            }

            // 1. Get all cards for this user to match by name
            const userCards = await ctx.prisma.creditCard.findMany({
                where: { userId: ctx.user.id }
            })

            // 2. Get or create categories
            // For now, we'll just map to the most likely category or create on the fly
            // (Simplified logic for now)

            for (const item of input) {
                try {
                    // 2. Get or create category
                    let categoryId: string | undefined
                    if (item.category) {
                        const category = await ctx.prisma.category.upsert({
                            where: {
                                userId_name: {
                                    userId: ctx.user.id,
                                    name: item.category,
                                }
                            },
                            update: {},
                            create: {
                                userId: ctx.user.id,
                                name: item.category,
                            }
                        })
                        categoryId = category.id

                        // 3. Get or create subcategory if present
                        if (item.subcategory) {
                            await ctx.prisma.subCategory.upsert({
                                where: {
                                    categoryId_name: {
                                        categoryId: category.id,
                                        name: item.subcategory,
                                    }
                                },
                                update: {},
                                create: {
                                    categoryId: category.id,
                                    name: item.subcategory,
                                }
                            })
                        }
                    }

                    let cardId: string | undefined

                    if (item.paymentMethod === 'credit_card' && item.cardName) {
                        let card = userCards.find(c =>
                            c.name.toLowerCase().trim() === item.cardName!.toLowerCase().trim() ||
                            c.name.toLowerCase().includes(item.cardName!.toLowerCase()) ||
                            item.cardName!.toLowerCase().includes(c.name.toLowerCase())
                        )

                        // SI NO EXISTE, LA CREAMOS AUTOMATICAMENTE
                        if (!card) {
                            card = await ctx.prisma.creditCard.create({
                                data: {
                                    userId: ctx.user.id,
                                    name: item.cardName!,
                                    bank: item.bank || item.cardName!.split(' ')[0] || 'Desconocido',
                                    brand: item.cardName!.toLowerCase().includes('master') ? 'mastercard' : 'visa',
                                    closingDay: 20, // Default conservador
                                    dueDay: 1,      // Default conservador
                                }
                            })
                            // Actualizamos la lista local para no crearla dos veces
                            userCards.push(card)
                        }
                        cardId = card.id
                    }

                    // We use the existing engine to handle installments correctly
                    await createTransactionWithInstallments({
                        userId: ctx.user.id,
                        description: item.description,
                        totalAmount: item.amount,
                        purchaseDate: new Date(item.date),
                        paymentMethod: item.paymentMethod as PaymentMethod,
                        cardId,
                        installments: item.installments,
                        expenseType: item.expenseType,
                        categoryId,
                        notes: item.subcategory ? `${item.category} > ${item.subcategory}` : item.category,
                    })

                    results.success++
                } catch (error: any) {
                    results.errors.push(`Error en "${item.description}": ${error.message}`)
                }
            }

            return results
        }),

    bulkIncomes: protectedProcedure
        .input(z.array(incomeItemSchema))
        .mutation(async ({ ctx, input }) => {
            const results = {
                success: 0,
                errors: [] as string[],
            }

            for (const item of input) {
                try {
                    // If impactMonth is provided, use first day of that month as date
                    let incomeDate = new Date(item.date)
                    if (item.impactMonth) {
                        const [year, month] = item.impactMonth.split('-').map(Number)
                        incomeDate = new Date(year, month - 1, 1)
                    }

                    await ctx.prisma.income.create({
                        data: {
                            userId: ctx.user.id,
                            description: item.description,
                            amount: item.amount,
                            date: incomeDate,
                            category: item.category,
                            subcategory: item.subcategory,
                        },
                    })

                    results.success++
                } catch (error: any) {
                    results.errors.push(`Error en "${item.description}": ${error.message}`)
                }
            }

            return results
        }),
})
