import Decimal from 'decimal.js'
import { Prisma, PrismaClient } from '@prisma/client'
import { calculateXirrAnnualRobust } from '../../lib/financial-engine'

const CENT_TOLERANCE = new Decimal(0.01)
const ZERO = new Decimal(0)

type TxClient = Prisma.TransactionClient

export interface PaymentWaterfallInput {
  paymentAmount: number
  overdueInterestPending: number
  currentInterestPending: number
  principalPending: number
}

export interface PaymentWaterfallResult {
  interestOverdueApplied: number
  interestCurrentApplied: number
  principalApplied: number
  totalApplied: number
  totalPending: number
}

export interface RegisterPaymentInput {
  loanId: string
  userId: string
  paymentDate: string | Date
  amount: number
  note?: string
  externalRef?: string
}

export interface RebuildMonthlyAccrualsResult {
  rows: Array<{
    year: number
    month: number
    openingPrincipal: number
    interestExpected: number
    interestCollectedCurrent: number
    overdueInterestOpening: number
    overdueInterestGenerated: number
    overdueInterestCollected: number
    overdueInterestClosing: number
    principalCollected: number
    closingPrincipal: number
    deviationAmount: number
    deviationPct: number
    status: string
  }>
  principalOutstanding: number
  overdueInterestOutstanding: number
}

export function applyPaymentWaterfall(input: PaymentWaterfallInput): PaymentWaterfallResult {
  const paymentAmount = money(input.paymentAmount)
  const overduePending = money(input.overdueInterestPending)
  const currentPending = money(input.currentInterestPending)
  const principalPending = money(input.principalPending)

  if (paymentAmount.lte(0)) {
    throw new Error('El pago debe ser mayor a 0')
  }
  if (overduePending.lt(0) || currentPending.lt(0) || principalPending.lt(0)) {
    throw new Error('Los buckets pendientes no pueden ser negativos')
  }

  const totalPending = overduePending.plus(currentPending).plus(principalPending)
  if (paymentAmount.gt(totalPending.plus(CENT_TOLERANCE))) {
    throw new Error('El pago excede la deuda total pendiente')
  }

  let remaining = paymentAmount
  const interestOverdueApplied = Decimal.min(remaining, overduePending)
  remaining = remaining.minus(interestOverdueApplied)

  const interestCurrentApplied = Decimal.min(remaining, currentPending)
  remaining = remaining.minus(interestCurrentApplied)

  const principalApplied = Decimal.min(remaining, principalPending)
  remaining = remaining.minus(principalApplied)

  if (remaining.gt(CENT_TOLERANCE)) {
    throw new Error('No se pudo aplicar la totalidad del pago con el waterfall actual')
  }

  const totalApplied = paymentAmount.minus(remaining)
  return {
    interestOverdueApplied: round2(interestOverdueApplied),
    interestCurrentApplied: round2(interestCurrentApplied),
    principalApplied: round2(principalApplied),
    totalApplied: round2(totalApplied),
    totalPending: round2(totalPending),
  }
}

export class LoanAccountingService {
  constructor(private readonly prisma: PrismaClient) {}

  async registerPayment(input: RegisterPaymentInput) {
    const paymentDate = coerceDate(input.paymentDate)
    const amount = money(input.amount)

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: input.loanId, userId: input.userId },
      })
      if (!loan) {
        throw new Error('Préstamo no encontrado')
      }

      if (amount.lte(0)) {
        throw new Error('El monto debe ser mayor a 0')
      }

      await this.ensureInitialDisbursementCashflowTx(tx, loan)

      const preState = await this.rebuildMonthlyAccrualsTx(tx, loan.id, paymentDate)
      const currentRow = findRowByYearMonth(preState.rows, paymentDate)

      const overduePending = money(preState.overdueInterestOutstanding)
      const currentPending = currentRow
        ? Decimal.max(money(currentRow.interestExpected).minus(money(currentRow.interestCollectedCurrent)), ZERO)
        : ZERO
      const principalPending = money(preState.principalOutstanding)

      const waterfall = applyPaymentWaterfall({
        paymentAmount: amount.toNumber(),
        overdueInterestPending: overduePending.toNumber(),
        currentInterestPending: currentPending.toNumber(),
        principalPending: principalPending.toNumber(),
      })

      if (waterfall.totalApplied <= 0) {
        throw new Error('No hay deuda pendiente para aplicar el pago')
      }

      const payment = await tx.loanPayment.create({
        data: {
          loanId: loan.id,
          paymentDate,
          amount: round2(amount),
          currency: loan.currency,
          note: input.note ?? null,
          externalRef: input.externalRef ?? null,
        },
      })

      const directionSign = loan.direction === 'lender' ? 1 : -1
      const cashflows: Prisma.LoanRealCashflowCreateManyInput[] = []

      if (waterfall.interestOverdueApplied > 0) {
        cashflows.push({
          loanId: loan.id,
          paymentId: payment.id,
          flowDate: paymentDate,
          amountSigned: round2(directionSign * waterfall.interestOverdueApplied),
          component: 'interest_overdue',
        })
      }

      if (waterfall.interestCurrentApplied > 0) {
        cashflows.push({
          loanId: loan.id,
          paymentId: payment.id,
          flowDate: paymentDate,
          amountSigned: round2(directionSign * waterfall.interestCurrentApplied),
          component: 'interest_current',
        })
      }

      if (waterfall.principalApplied > 0) {
        cashflows.push({
          loanId: loan.id,
          paymentId: payment.id,
          flowDate: paymentDate,
          amountSigned: round2(directionSign * waterfall.principalApplied),
          component: 'principal',
        })
      }

      if (cashflows.length > 0) {
        await tx.loanRealCashflow.createMany({ data: cashflows })
      }

      const postState = await this.rebuildMonthlyAccrualsTx(tx, loan.id, new Date())
      const irr = await this.recalculateIrrCacheTx(tx, loan.id)
      await tx.loan.update({
        where: { id: loan.id },
        data: { cashflowRevision: { increment: 1 } },
      })

      return {
        payment,
        waterfall,
        principalOutstanding: postState.principalOutstanding,
        overdueInterestOutstanding: postState.overdueInterestOutstanding,
        irr,
      }
    })
  }

  async rebuildMonthlyAccruals(loanId: string, asOfDate: Date = new Date()): Promise<RebuildMonthlyAccrualsResult> {
    return this.prisma.$transaction((tx) => this.rebuildMonthlyAccrualsTx(tx, loanId, asOfDate))
  }

  async recalculateIrrCache(loanId: string) {
    return this.prisma.$transaction((tx) => this.recalculateIrrCacheTx(tx, loanId))
  }

  async ensureInitialDisbursementCashflow(loanId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: loanId } })
      if (!loan) throw new Error('Préstamo no encontrado')
      await this.ensureInitialDisbursementCashflowTx(tx, loan)
    })
  }

  private async rebuildMonthlyAccrualsTx(
    tx: TxClient,
    loanId: string,
    asOfDate: Date,
  ): Promise<RebuildMonthlyAccrualsResult> {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        loanInstallments: {
          select: {
            dueDate: true,
            interest: true,
          },
          orderBy: { dueDate: 'asc' },
        },
        realCashflows: {
          select: {
            id: true,
            flowDate: true,
            amountSigned: true,
            component: true,
          },
          orderBy: [{ flowDate: 'asc' }, { id: 'asc' }],
        },
      },
    })

    if (!loan) {
      throw new Error('Préstamo no encontrado')
    }

    const asOfMonth = monthStart(asOfDate)
    const startMonth = monthStart(loan.startDate)
    const lastInstallmentMonth = loan.loanInstallments.length > 0
      ? monthStart(loan.loanInstallments[loan.loanInstallments.length - 1].dueDate)
      : startMonth
    const lastCashflowMonth = loan.realCashflows.length > 0
      ? monthStart(loan.realCashflows[loan.realCashflows.length - 1].flowDate)
      : startMonth
    const endMonth = maxMonth(startMonth, lastInstallmentMonth, lastCashflowMonth, asOfMonth)

    const expectedInterestByMonth = new Map<string, Decimal>()
    for (const installment of loan.loanInstallments) {
      const key = yearMonthKey(installment.dueDate)
      const prev = expectedInterestByMonth.get(key) ?? ZERO
      expectedInterestByMonth.set(key, prev.plus(money(installment.interest)))
    }

    const collectedByMonth = new Map<string, {
      interestCurrent: Decimal
      interestOverdue: Decimal
      principal: Decimal
      interestWaived: Decimal
      principalWaived: Decimal
    }>()

    for (const flow of loan.realCashflows) {
      const key = yearMonthKey(flow.flowDate)
      const prev = collectedByMonth.get(key) ?? {
        interestCurrent: ZERO,
        interestOverdue: ZERO,
        principal: ZERO,
        interestWaived: ZERO,
        principalWaived: ZERO,
      }
      const amount = money(flow.amountSigned).abs()

      if (flow.component === 'interest_current') prev.interestCurrent = prev.interestCurrent.plus(amount)
      else if (flow.component === 'interest_overdue') prev.interestOverdue = prev.interestOverdue.plus(amount)
      else if (flow.component === 'principal') prev.principal = prev.principal.plus(amount)
      else if (flow.component === 'waiver_interest') prev.interestWaived = prev.interestWaived.plus(amount)
      else if (flow.component === 'waiver_principal') prev.principalWaived = prev.principalWaived.plus(amount)

      collectedByMonth.set(key, prev)
    }

    let openingPrincipal = money(loan.capital)
    let overdueOpening = ZERO

    const rows: RebuildMonthlyAccrualsResult['rows'] = []
    const rowsForDb: Prisma.LoanAccrualMonthlyCreateManyInput[] = []

    for (const monthDate of enumerateMonths(startMonth, endMonth)) {
      const key = yearMonthKey(monthDate)
      const expected = expectedInterestByMonth.get(key) ?? ZERO
      const collected = collectedByMonth.get(key) ?? {
        interestCurrent: ZERO,
        interestOverdue: ZERO,
        principal: ZERO,
        interestWaived: ZERO,
        principalWaived: ZERO,
      }

      const isPastMonth = monthDate.getTime() < asOfMonth.getTime()
      const isFutureMonth = monthDate.getTime() > asOfMonth.getTime()

      const overdueGenerated = isPastMonth
        ? Decimal.max(expected.minus(collected.interestCurrent).minus(collected.interestWaived), ZERO)
        : ZERO
      const overdueClosing = Decimal.max(
        overdueOpening
          .plus(overdueGenerated)
          .minus(collected.interestOverdue)
          .minus(collected.interestWaived),
        ZERO,
      )
      const closingPrincipal = Decimal.max(
        openingPrincipal
          .minus(collected.principal)
          .minus(collected.principalWaived),
        ZERO,
      )

      const deviationAmount = collected.interestCurrent.minus(expected)
      const deviationPct = expected.gt(0) ? deviationAmount.div(expected) : ZERO

      let status = 'idle'
      if (isFutureMonth) {
        status = expected.gt(0) ? 'scheduled' : 'idle'
      } else if (overdueClosing.gt(0)) {
        status = 'overdue'
      } else if (expected.gt(0) && collected.interestCurrent.eq(0)) {
        status = 'no_payment'
      } else if (expected.gt(0) && collected.interestCurrent.lt(expected)) {
        status = 'partial'
      } else if (
        expected.gt(0) ||
        collected.interestCurrent.gt(0) ||
        collected.interestOverdue.gt(0) ||
        collected.principal.gt(0)
      ) {
        status = 'ok'
      }

      const row = {
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() + 1,
        openingPrincipal: round2(openingPrincipal),
        interestExpected: round2(expected),
        interestCollectedCurrent: round2(collected.interestCurrent),
        overdueInterestOpening: round2(overdueOpening),
        overdueInterestGenerated: round2(overdueGenerated),
        overdueInterestCollected: round2(collected.interestOverdue),
        overdueInterestClosing: round2(overdueClosing),
        principalCollected: round2(collected.principal),
        closingPrincipal: round2(closingPrincipal),
        deviationAmount: round2(deviationAmount),
        deviationPct: round6(deviationPct),
        status,
      }

      rows.push(row)
      rowsForDb.push({
        loanId,
        year: row.year,
        month: row.month,
        openingPrincipal: row.openingPrincipal,
        interestExpected: row.interestExpected,
        interestCollectedCurrent: row.interestCollectedCurrent,
        overdueInterestOpening: row.overdueInterestOpening,
        overdueInterestGenerated: row.overdueInterestGenerated,
        overdueInterestCollected: row.overdueInterestCollected,
        overdueInterestClosing: row.overdueInterestClosing,
        principalCollected: row.principalCollected,
        closingPrincipal: row.closingPrincipal,
        deviationAmount: row.deviationAmount,
        deviationPct: row.deviationPct,
        status: row.status,
      })

      openingPrincipal = closingPrincipal
      overdueOpening = overdueClosing
    }

    await tx.loanAccrualMonthly.deleteMany({ where: { loanId } })
    if (rowsForDb.length > 0) {
      await tx.loanAccrualMonthly.createMany({ data: rowsForDb })
    }

    const asOfRow = findRowByYearMonth(rows, asOfDate) ?? rows[rows.length - 1]
    const principalOutstanding = asOfRow ? asOfRow.closingPrincipal : round2(loan.capital)
    const overdueInterestOutstanding = asOfRow ? asOfRow.overdueInterestClosing : 0

    await tx.loan.update({
      where: { id: loanId },
      data: {
        principalOutstanding,
        overdueInterestOutstanding,
      },
    })

    return {
      rows,
      principalOutstanding,
      overdueInterestOutstanding,
    }
  }

  private async recalculateIrrCacheTx(tx: TxClient, loanId: string) {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        loanInstallments: {
          select: {
            dueDate: true,
            amount: true,
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    })

    if (!loan) {
      throw new Error('Préstamo no encontrado')
    }

    await this.ensureInitialDisbursementCashflowTx(tx, loan)

    const cashflows = await tx.loanRealCashflow.findMany({
      where: { loanId },
      orderBy: [{ flowDate: 'asc' }, { id: 'asc' }],
    })

    const contractualIrr = calculateContractualIrr(loan)
    const realResult = calculateRealIrr(cashflows)

    const slippageBps = contractualIrr !== null && realResult.rate !== null
      ? Math.round((realResult.rate - contractualIrr) * 10000)
      : null

    const updated = await tx.loan.update({
      where: { id: loanId },
      data: {
        irrContractualAnnual: contractualIrr === null ? null : round8(contractualIrr),
        irrRealAnnual: realResult.rate === null ? null : round8(realResult.rate),
        irrSlippageBps: slippageBps,
        irrStatus: realResult.status,
        irrCalculatedAt: new Date(),
      },
      select: {
        irrContractualAnnual: true,
        irrRealAnnual: true,
        irrSlippageBps: true,
        irrStatus: true,
        irrCalculatedAt: true,
      },
    })

    return {
      irrContractualAnnual: updated.irrContractualAnnual ? Number(updated.irrContractualAnnual) : null,
      irrRealAnnual: updated.irrRealAnnual ? Number(updated.irrRealAnnual) : null,
      irrSlippageBps: updated.irrSlippageBps,
      irrStatus: updated.irrStatus,
      irrCalculatedAt: updated.irrCalculatedAt,
    }
  }

  private async ensureInitialDisbursementCashflowTx(
    tx: TxClient,
    loan: {
      id: string
      capital: Prisma.Decimal | number
      direction: string
      startDate: Date
    },
  ): Promise<void> {
    const existing = await tx.loanRealCashflow.findFirst({
      where: {
        loanId: loan.id,
        component: 'disbursement',
      },
      select: { id: true },
    })

    if (existing) return

    const capital = money(loan.capital).toNumber()
    const directionSign = loan.direction === 'lender' ? 1 : -1
    const disbursement = round2(-directionSign * capital)

    await tx.loanRealCashflow.create({
      data: {
        loanId: loan.id,
        flowDate: loan.startDate,
        amountSigned: disbursement,
        component: 'disbursement',
      },
    })
  }
}

function calculateContractualIrr(loan: {
  direction: string
  capital: Prisma.Decimal | number
  startDate: Date
  loanInstallments: Array<{ dueDate: Date; amount: Prisma.Decimal | number }>
}): number | null {
  if (loan.loanInstallments.length === 0) return null

  const directionSign = loan.direction === 'lender' ? 1 : -1
  const cashflows = [
    {
      date: loan.startDate,
      amount: -directionSign * Number(loan.capital),
    },
    ...loan.loanInstallments.map((installment) => ({
      date: installment.dueDate,
      amount: directionSign * Number(installment.amount),
    })),
  ]

  try {
    return calculateXirrAnnualRobust(cashflows)
  } catch {
    return null
  }
}

function calculateRealIrr(cashflows: Array<{ flowDate: Date; amountSigned: Prisma.Decimal | number }>): {
  rate: number | null
  status: 'ok' | 'insufficient_flows' | 'no_convergence'
} {
  if (cashflows.length < 2) {
    return { rate: null, status: 'insufficient_flows' }
  }

  const formatted = cashflows.map((flow) => ({
    date: flow.flowDate,
    amount: Number(flow.amountSigned),
  }))

  try {
    const rate = calculateXirrAnnualRobust(formatted)
    return { rate, status: 'ok' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (
      message.includes('at least one positive and one negative') ||
      message.includes('at least two cash flows')
    ) {
      return { rate: null, status: 'insufficient_flows' }
    }
    return { rate: null, status: 'no_convergence' }
  }
}

function yearMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function enumerateMonths(start: Date, end: Date): Date[] {
  const months: Date[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const limit = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor.getTime() <= limit.getTime()) {
    months.push(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

function maxMonth(...dates: Date[]): Date {
  let max = dates[0]
  for (const date of dates) {
    if (date.getTime() > max.getTime()) max = date
  }
  return max
}

function findRowByYearMonth<T extends { year: number; month: number }>(rows: T[], date: Date): T | undefined {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return rows.find((row) => row.year === year && row.month === month)
}

function money(value: number | string | Prisma.Decimal): Decimal {
  return new Decimal(value ?? 0)
}

function round2(value: number | Decimal): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
}

function round6(value: number | Decimal): number {
  return new Decimal(value).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toNumber()
}

function round8(value: number | Decimal): number {
  return new Decimal(value).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber()
}

function coerceDate(value: string | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Fecha de pago inválida')
    return value
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Fecha de pago inválida')
  }
  return parsed
}
