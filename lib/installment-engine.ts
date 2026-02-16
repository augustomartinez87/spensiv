import { prisma } from './prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { formatPeriod } from './periods'

/**
 * MOTOR DE CUOTAS - LÓGICA CORE DE SPENSIV
 * 
 * Esta es la lógica portada desde tu Apps Script
 */

export type PaymentMethod = 'credit_card' | 'debit_card' | 'cash' | 'transfer'

export interface CreateTransactionInput {
  userId: string
  paymentMethod: PaymentMethod
  cardId?: string // Solo requerido si paymentMethod = 'credit_card'
  description: string
  totalAmount: number
  purchaseDate: Date
  installments: number // Solo aplica a credit_card
  categoryId?: string
  expenseType?: string
  isForThirdParty?: boolean
  thirdPartyId?: string
  notes?: string
}

/**
 * Obtener los días de cierre y vencimiento para un mes/año específico
 * Primero busca en CardClosingSchedule, si no existe usa los defaults de la tarjeta
 */
async function getClosingDaysForMonth(
  cardId: string,
  year: number,
  month: number
): Promise<{ closingDay: number; dueDay: number }> {
  // Buscar schedule específico para este mes/año
  const schedule = await prisma.cardClosingSchedule.findUnique({
    where: {
      cardId_year_month: {
        cardId,
        year,
        month,
      },
    },
  })

  if (schedule) {
    return {
      closingDay: schedule.closingDay,
      dueDay: schedule.dueDay,
    }
  }

  // Si no hay schedule, usar defaults de la tarjeta
  const card = await prisma.creditCard.findUnique({
    where: { id: cardId },
    select: { closingDay: true, dueDay: true },
  })

  if (!card) {
    throw new Error('Card not found')
  }

  return {
    closingDay: card.closingDay,
    dueDay: card.dueDay,
  }
}

/**
 * Calcular en qué mes impacta una compra según la fecha de cierre
 * 
 * REGLA (validada al 100%):
 * - Si día_compra <= día_cierre → impacta MISMO mes
 * - Si día_compra > día_cierre → impacta MES SIGUIENTE
 */
export function calculateImpactDate(
  purchaseDate: Date,
  closingDay: number
): Date {
  const purchaseDay = purchaseDate.getDate()

  let impactDate = new Date(purchaseDate)
  impactDate.setDate(1) // Primer día del mes
  impactDate.setHours(0, 0, 0, 0)

  // Si compraste DESPUÉS del cierre, impacta mes siguiente
  if (purchaseDay > closingDay) {
    impactDate.setMonth(impactDate.getMonth() + 1)
  }

  return impactDate
}

/**
 * Obtener o crear billing cycle para un mes específico
 */
async function getOrCreateBillingCycle(
  cardId: string,
  impactDate: Date
): Promise<{ id: string; closeDate: Date; dueDate: Date }> {
  const period = formatPeriod(impactDate) // "2025-01"

  // Buscar si ya existe
  let cycle = await prisma.billingCycle.findUnique({
    where: {
      cardId_period: {
        cardId,
        period,
      },
    },
  })

  if (cycle) return cycle

  // Obtener días de cierre/vencimiento (schedule o defaults)
  const year = impactDate.getFullYear()
  const month = impactDate.getMonth() + 1 // Los meses en JS son 0-indexed, pero en DB son 1-12
  
  const { closingDay, dueDay } = await getClosingDaysForMonth(cardId, year, month)

  // Calcular fecha de cierre y vencimiento
  const closeDate = new Date(year, month - 1, closingDay)

  // Vencimiento es en el mes siguiente
  let dueDate = new Date(year, month, dueDay)

  // Si el día de vencimiento es antes del cierre, sumar un mes más
  if (dueDay < closingDay) {
    dueDate.setMonth(dueDate.getMonth() + 1)
  }

  cycle = await prisma.billingCycle.create({
    data: {
      cardId,
      period,
      closeDate,
      dueDate,
      status: 'open',
    },
  })

  return cycle
}

/**
 * Generar ID único tipo Excel
 * Formato: YYYYMMDD + Monto + Cuotas + Timestamp
 */
function generateTransactionId(
  purchaseDate: Date,
  totalAmount: number,
  installments: number
): string {
  const dateStr = purchaseDate.toISOString().slice(0, 10).replace(/-/g, '')
  const amountStr = Math.round(totalAmount).toString()
  const installmentsStr = installments.toString().padStart(2, '0')
  const timestamp = Date.now().toString().slice(-6)

  return `${dateStr}${amountStr}${installmentsStr}${timestamp}`
}

/**
 * Crear transacción con cuotas automáticas
 * Soporta: credit_card (con cuotas), cash, transfer (sin cuotas)
 */
export async function createTransactionWithInstallments(
  input: CreateTransactionInput
) {
  // Generar ID único
  const transactionId = generateTransactionId(
    input.purchaseDate,
    input.totalAmount,
    input.installments
  )

  // Si es efectivo, débito o transferencia, no hay cuotas ni tarjeta
  if (input.paymentMethod === 'cash' || input.paymentMethod === 'transfer' || input.paymentMethod === 'debit_card') {
    const transaction = await prisma.transaction.create({
      data: {
        id: transactionId,
        userId: input.userId,
        paymentMethod: input.paymentMethod,
        cardId: null,
        description: input.description,
        totalAmount: new Decimal(input.totalAmount),
        purchaseDate: input.purchaseDate,
        installments: 1, // Siempre 1 para efectivo/transferencia/débito
        categoryId: input.categoryId,
        expenseType: input.expenseType,
        isForThirdParty: input.isForThirdParty || false,
        thirdPartyId: input.thirdPartyId,
        notes: input.notes,
      },
    })
    return transaction
  }

  // --- TARJETA DE CREDITO ---
  if (!input.cardId) {
    throw new Error('Tarjeta requerida para pagos con tarjeta de crédito')
  }

  // 1. Validar tarjeta
  const card = await prisma.creditCard.findUnique({
    where: { id: input.cardId },
  })

  if (!card) {
    throw new Error('Tarjeta no encontrada')
  }

  if (!card.isActive) {
    throw new Error('La tarjeta está inactiva')
  }

  // 2. Obtener día de cierre para el mes de la compra (puede ser schedule o default)
  const purchaseYear = input.purchaseDate.getFullYear()
  const purchaseMonth = input.purchaseDate.getMonth() + 1 // 1-12
  
  const { closingDay } = await getClosingDaysForMonth(
    input.cardId,
    purchaseYear,
    purchaseMonth
  )

  // 3. Calcular mes de impacto de la primera cuota
  const firstImpactDate = calculateImpactDate(
    input.purchaseDate,
    closingDay
  )

  // 3. Crear transacción
  const transaction = await prisma.transaction.create({
    data: {
      id: transactionId,
      userId: input.userId,
      paymentMethod: 'credit_card',
      cardId: input.cardId,
      description: input.description,
      totalAmount: new Decimal(input.totalAmount),
      purchaseDate: input.purchaseDate,
      installments: input.installments,
      categoryId: input.categoryId,
      expenseType: input.expenseType,
      isForThirdParty: input.isForThirdParty || false,
      thirdPartyId: input.thirdPartyId,
      notes: input.notes,
    },
  })

  // 4. Generar cuotas
  const installmentAmount = input.totalAmount / input.installments

  for (let i = 0; i < input.installments; i++) {
    // Calcular fecha de impacto de esta cuota
    const impactDate = new Date(firstImpactDate)
    impactDate.setMonth(impactDate.getMonth() + i)

    // Obtener o crear billing cycle
    const billingCycle = await getOrCreateBillingCycle(input.cardId, impactDate)

    // Crear installment
    await prisma.installment.create({
      data: {
        transactionId: transaction.id,
        billingCycleId: billingCycle.id,
        installmentNumber: i + 1,
        amount: new Decimal(installmentAmount),
        impactDate,
      },
    })
  }

  // 5. Recalcular totales de billing cycles afectados
  await recalculateBillingCycleTotals(input.cardId)

  return transaction
}

/**
 * Recalcular totales de billing cycles
 */
async function recalculateBillingCycleTotals(cardId: string) {
  const cycles = await prisma.billingCycle.findMany({
    where: { cardId },
    include: {
      installments: {
        where: {
          transaction: {
            isVoided: false,
          },
        },
      },
    },
  })

  for (const cycle of cycles) {
    const total = cycle.installments.reduce(
      (sum, inst) => sum + Number(inst.amount),
      0
    )

    await prisma.billingCycle.update({
      where: { id: cycle.id },
      data: { totalAmount: new Decimal(total) },
    })
  }
}

/**
 * Anular una transacción (sistema de anulación no destructivo)
 */
export async function voidTransaction(transactionId: string) {
  const transaction = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      isVoided: true,
      voidedAt: new Date(),
    },
  })

  // Recalcular totales solo si tiene tarjeta
  if (transaction.cardId) {
    await recalculateBillingCycleTotals(transaction.cardId)
  }

  return transaction
}

/**
 * Desanular una transacción
 */
export async function unvoidTransaction(transactionId: string) {
  const transaction = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      isVoided: false,
      voidedAt: null,
    },
  })

  // Recalcular totales solo si tiene tarjeta
  if (transaction.cardId) {
    await recalculateBillingCycleTotals(transaction.cardId)
  }

  return transaction
}
