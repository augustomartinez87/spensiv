import { prisma } from './prisma'
import { formatPeriod } from './periods'
import { getNonCreditPaymentMethodLabel, type NonCreditPaymentMethod } from './payment-methods'
import { formatExpenseType } from './utils'

/**
 * Obtener balance mensual (Ingresos - Egresos)
 * 
 * Esta función calcula el balance de un mes específico considerando:
 * - INGRESOS: Todos los ingresos registrados en ese mes
 * - EGRESOS: Todas las CUOTAS que impactan en ese mes (no las compras)
 */
export async function getMonthlyBalance(userId: string, period: string) {
    // period = "2025-01" (YYYY-MM)

    const { year, month } = {
        year: parseInt(period.split('-')[0]),
        month: parseInt(period.split('-')[1])
    }
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    // ========== INGRESOS Y EGRESOS EN PARALELO ==========
    const [incomes, installments, cashTransactions] = await Promise.all([
        prisma.income.findMany({
            where: {
                userId,
                date: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            orderBy: {
                date: 'desc',
            },
        }),
        prisma.installment.findMany({
            where: {
                billingCycle: {
                    period,
                    card: {
                        userId,
                    },
                },
                transaction: {
                    isVoided: false,
                    isForThirdParty: false,
                },
            },
            include: {
                transaction: {
                    include: {
                        category: true,
                        card: true,
                    },
                },
                billingCycle: true,
            },
            orderBy: {
                impactDate: 'asc',
            },
        }),
        // Transacciones no-crédito (efectivo, transferencia, débito)
        prisma.transaction.findMany({
            where: {
                userId,
                isVoided: false,
                isForThirdParty: false,
                paymentMethod: { in: ['cash', 'transfer', 'debit_card'] },
                purchaseDate: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            include: {
                category: true,
            },
            orderBy: {
                purchaseDate: 'asc',
            },
        }),
    ])

    const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0)
    const totalCreditExpense = installments.reduce(
        (sum, inst) => sum + Number(inst.amount),
        0
    )
    const totalCashExpense = cashTransactions.reduce(
        (sum, tx) => sum + Number(tx.totalAmount),
        0
    )
    const totalExpense = totalCreditExpense + totalCashExpense

    // ========== AGREGACIONES ==========

    // Gastos por categoría
    const expensesByCategory = installments.reduce(
        (acc: Record<string, number>, inst) => {
            const catName = inst.transaction.category?.name || 'Sin categoría'
            acc[catName] = (acc[catName] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )
    // Sumar transacciones no-crédito a categorías
    for (const tx of cashTransactions) {
        const catName = tx.category?.name || 'Sin categoría'
        expensesByCategory[catName] = (expensesByCategory[catName] || 0) + Number(tx.totalAmount)
    }

    // Gastos por tipo (con traducción a español)
    const expensesByType = installments.reduce(
        (acc: Record<string, number>, inst) => {
            const type = formatExpenseType(inst.transaction.expenseType)
            acc[type] = (acc[type] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )
    // Sumar transacciones no-crédito a tipos
    for (const tx of cashTransactions) {
        const type = formatExpenseType(tx.expenseType)
        expensesByType[type] = (expensesByType[type] || 0) + Number(tx.totalAmount)
    }

    // Gastos por tarjeta/medio de pago
    const expensesByCard = installments.reduce(
        (acc: Record<string, number>, inst) => {
            const cardName = inst.transaction.card?.name || 'Sin tarjeta'
            acc[cardName] = (acc[cardName] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )
    // Sumar transacciones no-crédito agrupadas por medio de pago
    for (const tx of cashTransactions) {
        const label = getNonCreditPaymentMethodLabel(tx.paymentMethod as NonCreditPaymentMethod)
        expensesByCard[label] = (expensesByCard[label] || 0) + Number(tx.totalAmount)
    }

    // Ingresos por categoría
    const incomesByCategory = incomes.reduce(
        (acc: Record<string, number>, inc) => {
            acc[inc.category] = (acc[inc.category] || 0) + Number(inc.amount)
            return acc
        },
        {} as Record<string, number>
    )

    // ========== BALANCE ==========
    const balance = totalIncome - totalExpense

    return {
        period,
        totalIncome,
        totalExpense,
        balance,
        incomes,
        installments,
        cashTransactions,
        aggregations: {
            expensesByCategory,
            expensesByType,
            expensesByCard,
            incomesByCategory,
        },
    }
}

/**
 * Versión ligera de getMonthlyBalance: solo devuelve totales usando aggregations.
 * Evita cargar todos los registros en memoria — ideal para evolution/sparklines.
 */
export async function getMonthlyTotals(userId: string, period: string) {
    const year = parseInt(period.split('-')[0])
    const month = parseInt(period.split('-')[1])
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    const [incomeAgg, creditAgg, cashAgg] = await Promise.all([
        prisma.income.aggregate({
            where: { userId, date: { gte: startDate, lt: endDate } },
            _sum: { amount: true },
        }),
        prisma.installment.aggregate({
            where: {
                billingCycle: { period, card: { userId } },
                transaction: { isVoided: false, isForThirdParty: false },
            },
            _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
            where: {
                userId,
                isVoided: false,
                isForThirdParty: false,
                paymentMethod: { in: ['cash', 'transfer', 'debit_card'] },
                purchaseDate: { gte: startDate, lt: endDate },
            },
            _sum: { totalAmount: true },
        }),
    ])

    const totalIncome = Number(incomeAgg._sum.amount ?? 0)
    const totalExpense = Number(creditAgg._sum.amount ?? 0) + Number(cashAgg._sum.totalAmount ?? 0)

    return { period, totalIncome, totalExpense, balance: totalIncome - totalExpense }
}

/**
 * Obtener proyección de flujo de caja para los próximos N meses
 * Incluye ingresos recurrentes proyectados
 */
export async function getCashFlowProjection(
    userId: string,
    startPeriod: string,
    months: number = 6
) {
    // Obtener ingresos recurrentes del usuario
    const recurringIncomes = await prisma.income.findMany({
        where: {
            userId,
            isRecurring: true,
        },
    })

    // Calcular el promedio de ingresos recurrentes
    const avgRecurringIncome = recurringIncomes.length > 0
        ? recurringIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0) / recurringIncomes.length
        : 0

    // Generar los periodos
    const periods = Array.from({ length: months }, (_, i) => {
        const [year, month] = startPeriod.split('-').map(Number)
        const date = new Date(year, month - 1 + i, 1)
        return formatPeriod(date)
    })

    // Ejecutar todas las consultas en paralelo
    const projections = await Promise.all(
        periods.map(async (period) => {
            const balance = await getMonthlyBalance(userId, period)
            
            // Calcular ingresos recurrentes proyectados para este período
            const projectedIncome = avgRecurringIncome
            
            // Calcular ingresos reales ya registrados para este período
            const actualIncome = balance.totalIncome
            
            // Si hay ingresos reales, no proyectamos (ya están contabilizados)
            // Si no hay ingresos reales, usamos la proyección
            const hasActualIncome = actualIncome > 0
            
            return {
                ...balance,
                actualIncome,
                projectedIncome: hasActualIncome ? 0 : projectedIncome,
                totalIncomeWithProjection: hasActualIncome ? actualIncome : projectedIncome,
                hasProjectedIncome: !hasActualIncome && projectedIncome > 0,
                balanceWithProjection: (hasActualIncome ? actualIncome : projectedIncome) - balance.totalExpense,
            }
        })
    )

    return projections
}

