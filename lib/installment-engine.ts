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
  subcategoryId?: string
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
 * Calcular las fechas de cierre y vencimiento de un ciclo
 *
 * REGLA:
 * - Si dueDay > closingDay → vencimiento en el MISMO mes del cierre
 * - Si dueDay <= closingDay → vencimiento en el MES SIGUIENTE al cierre
 *
 * Ejemplos:
 * - Agosto (cierre 28, venc 5): 5 <= 28 → vencimiento sep 5
 * - Septiembre (cierre 2, venc 13): 13 > 2 → vencimiento sep 13
 * - Octubre (cierre 30, venc 7): 7 <= 30 → vencimiento nov 7
 */
export function computeBillingCycleDates(
  year: number,
  month: number, // 1-indexed (1-12)
  closingDay: number,
  dueDay: number
): { closeDate: Date; dueDate: Date } {
  const closeDate = new Date(year, month - 1, closingDay)

  let dueDate: Date
  if (dueDay > closingDay) {
    // Vencimiento en el mismo mes que el cierre
    dueDate = new Date(year, month - 1, dueDay)
  } else {
    // Vencimiento en el mes siguiente al cierre
    // month (no month-1) funciona porque JS usa 0-indexed
    dueDate = new Date(year, month, dueDay)
  }

  return { closeDate, dueDate }
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

  const { closeDate, dueDate } = computeBillingCycleDates(year, month, closingDay, dueDay)

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
  const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)

  return `${dateStr}${amountStr}${installmentsStr}${uniqueSuffix}`
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
        subcategoryId: input.subcategoryId,
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

  // 4. Generar fechas de impacto y billing cycles antes de la transacción atómica
  const totalDecimal = new Decimal(input.totalAmount)
  const baseInstallment = totalDecimal.div(input.installments).toDecimalPlaces(2, Decimal.ROUND_DOWN)
  const lastInstallment = totalDecimal.minus(baseInstallment.times(input.installments - 1))

  const impactDates: Date[] = []
  for (let i = 0; i < input.installments; i++) {
    const impactDate = new Date(firstImpactDate)
    impactDate.setMonth(impactDate.getMonth() + i)
    impactDates.push(impactDate)
  }

  const billingCycles = await Promise.all(
    impactDates.map((d) => getOrCreateBillingCycle(input.cardId!, d))
  )

  // 3+4. Crear transacción e instalar cuotas de forma atómica
  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
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
        subcategoryId: input.subcategoryId,
        expenseType: input.expenseType,
        isForThirdParty: input.isForThirdParty || false,
        thirdPartyId: input.thirdPartyId,
        notes: input.notes,
      },
    })

    await tx.installment.createMany({
      data: impactDates.map((impactDate, i) => ({
        transactionId: created.id,
        billingCycleId: billingCycles[i].id,
        installmentNumber: i + 1,
        amount: i === input.installments - 1 ? lastInstallment : baseInstallment,
        impactDate,
      })),
    })

    return created
  })

  // 5. Recalcular totales de billing cycles afectados
  await recalculateBillingCycleTotals(input.cardId)

  return transaction
}

/**
 * Recalcular totales de billing cycles
 */
export async function recalculateBillingCycleTotals(cardId: string) {
  const cycles = await prisma.billingCycle.findMany({
    where: { cardId },
    include: {
      installments: {
        where: {
          isPaid: false,
          transaction: { isVoided: false },
        },
      },
    },
  })

  await Promise.all(
    cycles.map((cycle) => {
      const total = cycle.installments.reduce((sum, inst) => sum + Number(inst.amount), 0)
      return prisma.billingCycle.update({
        where: { id: cycle.id },
        data: { totalAmount: new Decimal(total) },
      })
    })
  )
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
 * Recalcular las fechas closeDate/dueDate de todos los BillingCycles de un usuario.
 * Usar cuando se corrige el bug de cálculo para arreglar datos existentes.
 */
export async function recalculateBillingCycleDates(userId: string): Promise<number> {
  // Obtener todas las tarjetas del usuario
  const cards = await prisma.creditCard.findMany({
    where: { userId },
    select: { id: true, closingDay: true, dueDay: true },
  })

  let updatedCount = 0

  await Promise.all(
    cards.map(async (card) => {
      const cycles = await prisma.billingCycle.findMany({ where: { cardId: card.id } })

      await Promise.all(
        cycles.map(async (cycle) => {
          const [yearStr, monthStr] = cycle.period.split('-')
          const year = parseInt(yearStr)
          const month = parseInt(monthStr)

          const { closingDay, dueDay } = await getClosingDaysForMonth(card.id, year, month)
          const { closeDate, dueDate } = computeBillingCycleDates(year, month, closingDay, dueDay)

          await prisma.billingCycle.update({
            where: { id: cycle.id },
            data: { closeDate, dueDate },
          })
          updatedCount++
        })
      )
    })
  )

  return updatedCount
}

/**
 * Recalcular las fechas dueDate de todas las ThirdPartyInstallments de un usuario,
 * usando la dueDate del BillingCycle correspondiente de cada cuota.
 */
export async function recalculateThirdPartyInstallmentDates(userId: string): Promise<number> {
  const purchases = await prisma.thirdPartyPurchase.findMany({
    where: { userId },
    include: {
      collectionInstallments: { orderBy: { number: 'asc' } },
      transaction: {
        include: {
          installmentsList: {
            include: { billingCycle: { select: { dueDate: true } } },
            orderBy: { installmentNumber: 'asc' },
          },
        },
      },
    },
  })

  let updatedCount = 0

  for (const purchase of purchases) {
    const installments = purchase.transaction?.installmentsList ?? []
    if (!installments.length) continue

    const installmentMap = new Map(installments.map((i) => [i.installmentNumber, i]))

    for (const collInst of purchase.collectionInstallments) {
      const matchingInst = installmentMap.get(collInst.number)
      if (!matchingInst) continue

      await prisma.thirdPartyInstallment.update({
        where: { id: collInst.id },
        data: { dueDate: matchingInst.billingCycle.dueDate },
      })
      updatedCount++
    }
  }

  return updatedCount
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
