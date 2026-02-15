import { prisma } from './prisma'
import { formatPeriod } from './periods'

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
    const [incomes, installments] = await Promise.all([
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
                },
            },
            include: {
                transaction: {
                    include: {
                        category: true,
                        card: true,
                    },
                },
                billingCycle: {
                    include: {
                        card: true,
                    },
                },
            },
            orderBy: {
                impactDate: 'asc',
            },
        })
    ])

    const totalIncome = incomes.reduce((sum: number, inc: any) => sum + Number(inc.amount), 0)
    const totalExpense = installments.reduce(
        (sum: number, inst: any) => sum + Number(inst.amount),
        0
    )

    // ========== AGREGACIONES ==========

    // Gastos por categoría
    const expensesByCategory = installments.reduce(
        (acc: Record<string, number>, inst: any) => {
            const catName = inst.transaction.category?.name || 'Sin categoría'
            acc[catName] = (acc[catName] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )

    // Gastos por tipo (con traducción a español)
    const expenseTypeLabels: Record<string, string> = {
        structural: 'Estructural',
        emotional_recurrent: 'Emocional - Recurrente',
        emotional_impulsive: 'Emocional - Impulsivo',
        sin_clasificar: 'Sin clasificar',
    }
    const expensesByType = installments.reduce(
        (acc: Record<string, number>, inst: any) => {
            const rawType = inst.transaction.expenseType || 'sin_clasificar'
            const type = expenseTypeLabels[rawType] || rawType
            acc[type] = (acc[type] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )

    // Gastos por tarjeta
    const expensesByCard = installments.reduce(
        (acc: Record<string, number>, inst: any) => {
            const cardName = inst.billingCycle.card.name
            acc[cardName] = (acc[cardName] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )

    // Ingresos por categoría
    const incomesByCategory = incomes.reduce(
        (acc: Record<string, number>, inc: any) => {
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
        aggregations: {
            expensesByCategory,
            expensesByType,
            expensesByCard,
            incomesByCategory,
        },
    }
}

/**
 * Obtener proyección de flujo de caja para los próximos N meses
 */
export async function getCashFlowProjection(
    userId: string,
    startPeriod: string,
    months: number = 6
) {
    const [startYear, startMonth] = startPeriod.split('-').map(Number)

    // Generar los periodos primero
    const periods = Array.from({ length: months }, (_, i) => {
        const [year, month] = startPeriod.split('-').map(Number)
        const date = new Date(year, month - 1 + i, 1)
        return formatPeriod(date)
    })

    // Ejecutar todas las consultas en paralelo
    const projections = await Promise.all(
        periods.map(period => getMonthlyBalance(userId, period))
    )

    return projections
}
