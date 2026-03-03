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

      // Fetch all unpaid installments for max-payable validation and advance logic
      const unpaidInstallments = await tx.loanInstallment.findMany({
        where: { loanId: loan.id, isPaid: false },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, dueDate: true, amount: true, interest: true, principal: true, paidAmount: true },
      })

      const preState = await this.rebuildMonthlyAccrualsTx(tx, loan.id, paymentDate)
      const currentRow = findRowByYearMonth(preState.rows, paymentDate)

      const overduePending = money(preState.overdueInterestOutstanding)
      const currentInterestPending = currentRow
        ? Decimal.max(money(currentRow.interestExpected).minus(money(currentRow.interestCollectedCurrent)), ZERO)
        : ZERO
      const principalPending = money(preState.principalOutstanding)

      // Future installments: dueDate strictly after end of payment month
      const paymentMonthEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0, 23, 59, 59)
      const futureInstallments = unpaidInstallments.filter(
        (i) => new Date(i.dueDate) > paymentMonthEnd,
      )

      // Current-period principal = outstanding minus future installments' remaining principals
      const futurePrincipalSum = futureInstallments.reduce((s, i) => {
        const paid = money(i.paidAmount ?? 0)
        const interestAlreadyPaid = Decimal.min(paid, money(i.interest))
        const principalAlreadyPaid = Decimal.max(paid.minus(interestAlreadyPaid), ZERO)
        const remainingPrincipal = Decimal.max(money(i.principal).minus(principalAlreadyPaid), ZERO)
        return s.plus(remainingPrincipal)
      }, ZERO)
      const currentPeriodPrincipal = Decimal.max(principalPending.minus(futurePrincipalSum), ZERO)

      // Current dues: everything owed up to and including this month
      const currentDues = overduePending.plus(currentInterestPending).plus(currentPeriodPrincipal)

      // Max payable: current dues + remaining future installment amounts
      const futureInstallmentsTotal = futureInstallments.reduce((s, i) => {
        const remaining = Decimal.max(money(i.amount).minus(money(i.paidAmount ?? 0)), ZERO)
        return s.plus(remaining)
      }, ZERO)
      const maxPayable = currentDues.plus(futureInstallmentsTotal)

      if (amount.gt(maxPayable.plus(CENT_TOLERANCE))) {
        throw new Error(
          `El pago excede la deuda total del préstamo (máximo: ${round2(maxPayable)})`,
        )
      }

      // Apply waterfall for current period only (capped at currentDues)
      const amountForCurrentPeriod = Decimal.min(amount, currentDues)
      let waterfall: PaymentWaterfallResult

      if (amountForCurrentPeriod.gt(0)) {
        waterfall = applyPaymentWaterfall({
          paymentAmount: round2(amountForCurrentPeriod),
          overdueInterestPending: round2(overduePending),
          currentInterestPending: round2(currentInterestPending),
          principalPending: round2(currentPeriodPrincipal),
        })
      } else {
        waterfall = { interestOverdueApplied: 0, interestCurrentApplied: 0, principalApplied: 0, totalApplied: 0, totalPending: 0 }
      }

      if (waterfall.totalApplied <= 0 && futureInstallments.length === 0) {
        throw new Error('No hay deuda pendiente para aplicar el pago')
      }

      // Apply excess to future installments (adelanto de cuotas)
      let excessRemaining = amount.minus(money(waterfall.totalApplied))
      type AdvancePaid = { id: string; dueDate: Date; interestPaid: number; principalPaid: number; fullyPaid: boolean }
      const advancePaid: AdvancePaid[] = []

      for (const inst of futureInstallments) {
        if (excessRemaining.lte(CENT_TOLERANCE)) break

        const alreadyPaid = money(inst.paidAmount ?? 0)
        const alreadyPaidInterest = Decimal.min(alreadyPaid, money(inst.interest))
        const alreadyPaidPrincipal = Decimal.max(alreadyPaid.minus(alreadyPaidInterest), ZERO)
        const remainingInterest = Decimal.max(money(inst.interest).minus(alreadyPaidInterest), ZERO)
        const remainingPrincipal = Decimal.max(money(inst.principal).minus(alreadyPaidPrincipal), ZERO)
        const remainingTotal = remainingInterest.plus(remainingPrincipal)

        if (remainingTotal.lte(CENT_TOLERANCE)) continue // ya estaba completamente pagada

        const interestPaid = Decimal.min(excessRemaining, remainingInterest)
        excessRemaining = excessRemaining.minus(interestPaid)
        const principalPaid = Decimal.min(excessRemaining, remainingPrincipal)
        excessRemaining = excessRemaining.minus(principalPaid)

        const totalNewlyPaid = interestPaid.plus(principalPaid)
        const fullyPaid = totalNewlyPaid.gte(remainingTotal.minus(CENT_TOLERANCE))

        advancePaid.push({
          id: inst.id,
          dueDate: inst.dueDate instanceof Date ? inst.dueDate : new Date(inst.dueDate),
          interestPaid: round2(interestPaid),
          principalPaid: round2(principalPaid),
          fullyPaid,
        })
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

      // Current-period cashflows (flowDate = paymentDate)
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

      // Advance-payment cashflows (flowDate = installment.dueDate so accruals are correct)
      for (const adv of advancePaid) {
        if (adv.interestPaid > 0) {
          cashflows.push({
            loanId: loan.id,
            paymentId: payment.id,
            flowDate: adv.dueDate,
            amountSigned: round2(directionSign * adv.interestPaid),
            component: 'interest_current',
          })
        }
        if (adv.principalPaid > 0) {
          cashflows.push({
            loanId: loan.id,
            paymentId: payment.id,
            flowDate: adv.dueDate,
            amountSigned: round2(directionSign * adv.principalPaid),
            component: 'principal',
          })
        }
      }

      if (cashflows.length > 0) {
        await tx.loanRealCashflow.createMany({ data: cashflows })
      }

      // Update paidAmount (and mark isPaid) for each advance-paid installment
      for (const adv of advancePaid) {
        if (adv.interestPaid + adv.principalPaid > 0) {
          await tx.loanInstallment.update({
            where: { id: adv.id },
            data: {
              paidAmount: { increment: adv.interestPaid + adv.principalPaid },
              ...(adv.fullyPaid ? { isPaid: true, paidAt: paymentDate } : {}),
            },
          })
        }
      }

      // Update current-period installment (dueDate in same month as paymentDate)
      let currentInstNowPaid = false
      const currentInstKey = yearMonthKey(paymentDate)
      const currentInst = unpaidInstallments.find(
        (i) => yearMonthKey(new Date(i.dueDate)) === currentInstKey,
      )
      if (currentInst && (waterfall.interestCurrentApplied + waterfall.principalApplied) > 0) {
        const alreadyPaid = Number(currentInst.paidAmount ?? 0)
        const newTotal = alreadyPaid + waterfall.interestCurrentApplied + waterfall.principalApplied
        const fullyPaid = newTotal >= Number(currentInst.amount) - CENT_TOLERANCE.toNumber()
        await tx.loanInstallment.update({
          where: { id: currentInst.id },
          data: {
            paidAmount: { increment: waterfall.interestCurrentApplied + waterfall.principalApplied },
            ...(fullyPaid ? { isPaid: true, paidAt: paymentDate } : {}),
          },
        })
        if (fullyPaid) currentInstNowPaid = true
      }

      const advancedCount = advancePaid.filter((a) => a.fullyPaid).length

      // Auto-complete amortized loan if all installments are now paid
      if (loan.loanType === 'amortized' && (advancedCount > 0 || currentInstNowPaid)) {
        const remaining = await tx.loanInstallment.count({
          where: { loanId: loan.id, isPaid: false },
        })
        if (remaining === 0) {
          await tx.loan.update({ where: { id: loan.id }, data: { status: 'completed' } })
        }
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
        advancedInstallments: advancedCount,
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

  async deletePayment(input: { paymentId: string; userId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.loanPayment.findFirst({
        where: { id: input.paymentId, loan: { userId: input.userId } },
        select: { id: true, loanId: true },
      })
      if (!payment) throw new Error('Pago no encontrado')

      await tx.loanRealCashflow.deleteMany({ where: { paymentId: payment.id } })
      await tx.loanPayment.delete({ where: { id: payment.id } })

      // Reactivate loan if it was completed
      await tx.loan.update({ where: { id: payment.loanId }, data: { status: 'active' } }).catch(() => {})

      await this.reconcileInstallmentStatesTx(tx, payment.loanId)
      await this.rebuildMonthlyAccrualsTx(tx, payment.loanId, new Date())
      await this.recalculateIrrCacheTx(tx, payment.loanId)
      await tx.loan.update({
        where: { id: payment.loanId },
        data: { cashflowRevision: { increment: 1 } },
      })

      return { success: true, loanId: payment.loanId }
    })
  }

  private async reconcileInstallmentStatesTx(tx: TxClient, loanId: string): Promise<void> {
    // Reset all installment states
    await tx.loanInstallment.updateMany({
      where: { loanId },
      data: { isPaid: false, paidAt: null, paidAmount: 0 },
    })

    // Get remaining cashflows (interest_current + principal) to derive paid amounts
    const cashflows = await tx.loanRealCashflow.findMany({
      where: { loanId, component: { in: ['interest_current', 'principal'] } },
      select: { flowDate: true, amountSigned: true },
    })

    // Group by yearMonth of flowDate
    const paidByMonth = new Map<string, Decimal>()
    for (const flow of cashflows) {
      const key = yearMonthKey(new Date(flow.flowDate))
      paidByMonth.set(key, (paidByMonth.get(key) ?? ZERO).plus(money(flow.amountSigned).abs()))
    }

    // Match installments by yearMonth of dueDate and update states
    const installments = await tx.loanInstallment.findMany({
      where: { loanId },
      select: { id: true, dueDate: true, amount: true },
      orderBy: { number: 'asc' },
    })

    for (const inst of installments) {
      const key = yearMonthKey(new Date(inst.dueDate))
      const paid = paidByMonth.get(key) ?? ZERO
      if (paid.lte(CENT_TOLERANCE)) continue
      const instAmt = money(inst.amount)
      const clampedPaid = Decimal.min(paid, instAmt)
      const fullyPaid = clampedPaid.gte(instAmt.minus(CENT_TOLERANCE))
      await tx.loanInstallment.update({
        where: { id: inst.id },
        data: {
          paidAmount: round2(clampedPaid),
          isPaid: fullyPaid,
          paidAt: fullyPaid ? new Date() : null,
        },
      })
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
