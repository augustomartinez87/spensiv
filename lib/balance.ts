import { prisma } from './prisma'
import { formatPeriod, parsePeriod } from './periods'
import { getPaymentMethodLabelWithCard } from './transaction-utils'
import { getExpenseTypeLabel } from './transaction-utils'

export type BalanceViewMode = 'economic' | 'financial'

const DIRECT_PAYMENT_METHODS: Record<BalanceViewMode, string[]> = {
    financial: ['cash', 'transfer', 'debit_card'],
    economic: ['cash', 'transfer', 'debit_card', 'credit_card'],
}

/**
 * Obtener balance mensual (Ingresos - Egresos)
 *
 * Soporta dos modos contables:
 * - 'financial' (default): agrupa por cuándo sale la plata. Cuotas de tarjeta por
 *   periodo del resumen, cash/débito/transfer por purchaseDate.
 * - 'economic': agrupa por cuándo se concreta la operación. Las compras con tarjeta
 *   se muestran completas (totalAmount) en el mes de purchaseDate, sin cuotas.
 */
export async function getMonthlyBalance(
    userId: string,
    period: string,
    viewMode: BalanceViewMode = 'financial'
) {
    const { year, month } = parsePeriod(period)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    const installmentsQuery = prisma.installment.findMany({
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
    })
    type InstallmentRow = Awaited<typeof installmentsQuery>[number]

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
        viewMode === 'economic'
            ? Promise.resolve([] as InstallmentRow[])
            : installmentsQuery,
        // Transacciones directas. En 'financial' solo cash/transfer/debit.
        // En 'economic' también credit_card (la compra completa en su mes).
        prisma.transaction.findMany({
            where: {
                userId,
                isVoided: false,
                isForThirdParty: false,
                paymentMethod: { in: DIRECT_PAYMENT_METHODS[viewMode] },
                purchaseDate: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            include: {
                category: true,
                card: true,
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
            const type = getExpenseTypeLabel(inst.transaction.expenseType)
            acc[type] = (acc[type] || 0) + Number(inst.amount)
            return acc
        },
        {} as Record<string, number>
    )
    // Sumar transacciones no-crédito a tipos
    for (const tx of cashTransactions) {
        const type = getExpenseTypeLabel(tx.expenseType)
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
    for (const tx of cashTransactions) {
        const label = getPaymentMethodLabelWithCard(tx.paymentMethod, tx.card)
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
export async function getMonthlyTotals(
    userId: string,
    period: string,
    viewMode: BalanceViewMode = 'financial'
) {
    const { year, month } = parsePeriod(period)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1)

    const installmentAggPromise = viewMode === 'economic'
        ? null
        : prisma.installment.aggregate({
            where: {
                billingCycle: { period, card: { userId } },
                transaction: { isVoided: false, isForThirdParty: false },
            },
            _sum: { amount: true },
        })

    const [incomeAgg, creditAgg, cashAgg] = await Promise.all([
        prisma.income.aggregate({
            where: { userId, date: { gte: startDate, lt: endDate } },
            _sum: { amount: true },
        }),
        installmentAggPromise,
        prisma.transaction.aggregate({
            where: {
                userId,
                isVoided: false,
                isForThirdParty: false,
                paymentMethod: { in: DIRECT_PAYMENT_METHODS[viewMode] },
                purchaseDate: { gte: startDate, lt: endDate },
            },
            _sum: { totalAmount: true },
        }),
    ])

    const totalIncome = Number(incomeAgg._sum.amount ?? 0)
    const totalExpense = Number(creditAgg?._sum.amount ?? 0) + Number(cashAgg._sum.totalAmount ?? 0)

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

    // Usar getMonthlyTotals (aggregates) en vez de getMonthlyBalance (full rows) — mucho más liviano
    const projections = await Promise.all(
        periods.map(async (period) => {
            const [totals, installmentCount] = await Promise.all([
                getMonthlyTotals(userId, period),
                prisma.installment.count({
                    where: {
                        billingCycle: { period, card: { userId } },
                        transaction: { isVoided: false, isForThirdParty: false },
                    },
                }),
            ])

            const actualIncome = totals.totalIncome
            const hasActualIncome = actualIncome > 0
            const projectedIncome = avgRecurringIncome

            return {
                period: totals.period,
                totalIncome: totals.totalIncome,
                totalExpense: totals.totalExpense,
                balance: totals.balance,
                installmentCount,
                actualIncome,
                projectedIncome: hasActualIncome ? 0 : projectedIncome,
                totalIncomeWithProjection: hasActualIncome ? actualIncome : projectedIncome,
                hasProjectedIncome: !hasActualIncome && projectedIncome > 0,
                balanceWithProjection: (hasActualIncome ? actualIncome : projectedIncome) - totals.totalExpense,
            }
        })
    )

    return projections
}

