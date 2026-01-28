import { prisma } from './prisma'

/**
 * Obtener balance mensual (Ingresos - Egresos)
 * 
 * Esta función calcula el balance de un mes específico considerando:
 * - INGRESOS: Todos los ingresos registrados en ese mes
 * - EGRESOS: Todas las CUOTAS que impactan en ese mes (no las compras)
 */
export async function getMonthlyBalance(userId: string, period: string) {
    // period = "2025-01" (YYYY-MM)

    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    // ========== INGRESOS ==========
    const incomes = await prisma.income.findMany({
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
    })

    const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0)

    // ========== EGRESOS ==========
    // Obtener todas las cuotas que impactan en este mes
    const installments = await prisma.installment.findMany({
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

    const totalExpense = installments.reduce(
        (sum, inst) => sum + Number(inst.amount),
        0
    )

    // ========== AGREGACIONES ==========

    // Gastos por categoría
    const expensesByCategory = installments.reduce(
        (acc, inst) => {
            const catName = inst.transaction.category?.name || 'Sin categoría'
            acc[catName] = (acc[catName] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )

    // Gastos por tipo
    const expensesByType = installments.reduce(
        (acc, inst) => {
            const type = inst.transaction.expenseType || 'sin_clasificar'
            acc[type] = (acc[type] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )

    // Gastos por tarjeta
    const expensesByCard = installments.reduce(
        (acc, inst) => {
            const cardName = inst.billingCycle.card.name
            acc[cardName] = (acc[cardName] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )

    // Ingresos por categoría
    const incomesByCategory = incomes.reduce(
        (acc, inc) => {
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
    const projections = []

    for (let i = 0; i < months; i++) {
        const [year, month] = startPeriod.split('-').map(Number)
        const date = new Date(year, month - 1 + i, 1)
        const period = date.toISOString().slice(0, 7)

        const monthlyData = await getMonthlyBalance(userId, period)
        projections.push(monthlyData)
    }

    return projections
}
