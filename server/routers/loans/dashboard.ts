import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { getDolarMep, pesify } from '@/lib/dolar'
import { getCurrentPeriod, parsePeriod } from '@/lib/periods'

export const loanDashboardRouter = router({
  getDashboardMetrics: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const { year: currentYear, month: currentMonth } = parsePeriod(getCurrentPeriod())

    const [activeLoans, mepRate, monthlyAccruals, amortizedLoans] = await Promise.all([
      ctx.prisma.loan.findMany({
        where: { userId: ctx.user.id, status: 'active', direction: 'lender' },
        include: {
          person: { select: { name: true, alias: true } },
          loanInstallments: {
            where: {
              OR: [
                { isPaid: false },
                { dueDate: { gte: startOfMonth, lte: endOfMonth } },
              ],
            },
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              number: true,
              dueDate: true,
              amount: true,
              paidAmount: true,
              isPaid: true,
            },
          },
        },
      }),
      getDolarMep(),
      ctx.prisma.loanAccrualMonthly.findMany({
        where: {
          year: currentYear,
          month: currentMonth,
          loan: { userId: ctx.user.id, direction: 'lender' },
        },
        select: {
          interestExpected: true,
          interestCollectedCurrent: true,
          overdueInterestCollected: true,
          loan: { select: { currency: true } },
        },
      }),
      // Para la métrica "Ganancia nominal · Amortizados".
      // Incluye active+completed+defaulted: lo cobrado en completed cuenta como ganancia,
      // y los defaulted aportan a la pérdida (intereses no cobrables + capital).
      ctx.prisma.loan.findMany({
        where: {
          userId: ctx.user.id,
          direction: 'lender',
          loanType: 'amortized',
          status: { in: ['active', 'completed', 'defaulted'] },
        },
        select: {
          status: true,
          currency: true,
          principalOutstanding: true,
          loanInstallments: {
            select: {
              interest: true,
              amount: true,
              paidAmount: true,
              isPaid: true,
            },
          },
        },
      }),
    ])

    const totalCapitalActive = activeLoans.reduce(
      (sum, loan) => sum + pesify(Number(loan.capital), loan.currency, mepRate),
      0
    )

    // Helper: zero-rate loans (any type) have no installment schedule
    const getEffectiveInstallments = (loan: { loanType: string; monthlyRate: unknown; loanInstallments: unknown[] }) =>
      Number(loan.monthlyRate) === 0 ? [] : loan.loanInstallments as typeof activeLoans[0]['loanInstallments']

    const totalPending = activeLoans.reduce(
      (sum, loan) =>
        sum + getEffectiveInstallments(loan)
          .filter((i) => !i.isPaid)
          .reduce(
            (s, i) => s + pesify(Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0), loan.currency, mepRate),
            0
          ),
      0
    )

    // Skip $0 installments (e.g. interest_only loans at 0% TNA) and zero-rate amortized
    const allUnpaid = activeLoans.flatMap((loan) =>
      getEffectiveInstallments(loan)
        .filter((i) => !i.isPaid && Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0) > 0)
        .map((i) => {
          const remaining = Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0)
          const baseName = loan.person
            ? loan.person.name || loan.person.alias || loan.borrowerName.split(' - ')[0]
            : loan.borrowerName.split(' - ')[0]
          const borrowerName = loan.person && loan.concept ? `${baseName} (${loan.concept})` : baseName
          return {
            ...i,
            amount: remaining,
            amountArs: pesify(remaining, loan.currency, mepRate),
            borrowerName,
            loanId: loan.id,
            currency: loan.currency,
          }
        })
    )

    const overdueInstallments = allUnpaid.filter((i) => i.dueDate < now)
    const overdueCount = overdueInstallments.length
    const overdueAmount = overdueInstallments.reduce((s, i) => s + i.amountArs, 0)

    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thisWeek = allUnpaid.filter(
      (i) => i.dueDate >= now && i.dueDate <= weekFromNow
    )

    const upcomingInstallments = allUnpaid
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5)

    const thisMonthInstallments = activeLoans.flatMap((loan) =>
      loan.loanInstallments
        .filter((i) => i.dueDate >= startOfMonth && i.dueDate <= endOfMonth)
        .map((i) => ({ ...i, currency: loan.currency, loanType: loan.loanType }))
    )

    const totalDueThisMonth = thisMonthInstallments.reduce(
      (sum, i) => sum + pesify(Number(i.amount), i.currency, mepRate), 0
    )
    const totalCollectedThisMonth = thisMonthInstallments.reduce(
      (sum, i) => sum + pesify(Number(i.paidAmount), i.currency, mepRate), 0
    )

    const collectionPct = totalDueThisMonth > 0
      ? (totalCollectedThisMonth / totalDueThisMonth) * 100
      : null

    const morosityPct = totalCapitalActive > 0 ? (overdueAmount / totalCapitalActive) * 100 : 0

    const interestOnlyRent: Record<string, number> = {}
    const interestOnlyCapital: Record<string, number> = {}
    for (const loan of activeLoans.filter(l => l.loanType === 'interest_only')) {
      interestOnlyRent[loan.currency] = (interestOnlyRent[loan.currency] || 0) + Number(loan.installmentAmount)
      interestOnlyCapital[loan.currency] = (interestOnlyCapital[loan.currency] || 0) + Number(loan.capital)
    }

    const interestOnlyCollected: Record<string, number> = {}
    for (const i of thisMonthInstallments.filter(i => i.loanType === 'interest_only')) {
      interestOnlyCollected[i.currency] = (interestOnlyCollected[i.currency] || 0) + Number(i.paidAmount)
    }

    // Intereses devengados vs cobrados del mes actual (pesificado a ARS).
    // Económico = lo que ya se ganó por calendario (interestExpected).
    // Financiero = lo que efectivamente entró a caja (interestCollectedCurrent + overdueInterestCollected).
    let interestAccruedThisMonth = 0
    let interestCollectedThisMonth = 0
    for (const row of monthlyAccruals) {
      const currency = row.loan.currency
      interestAccruedThisMonth += pesify(Number(row.interestExpected), currency, mepRate)
      interestCollectedThisMonth += pesify(
        Number(row.interestCollectedCurrent) + Number(row.overdueInterestCollected),
        currency,
        mepRate,
      )
    }
    const interestGap = Math.max(interestAccruedThisMonth - interestCollectedThisMonth, 0)

    // ── Ganancia nominal · solo préstamos amortizados ───────────────────
    // Por cuota: el waterfall paga intereses antes que capital, así que
    // interés cobrado = min(paidAmount, interest) en cada cuota.
    let amortizedInterestCollected = 0
    let amortizedInterestRemaining = 0
    let amortizedInterestContractual = 0
    let amortizedInterestLost = 0
    let amortizedPrincipalLost = 0
    let amortizedActiveCount = 0
    let amortizedCompletedCount = 0
    let amortizedDefaultedCount = 0

    for (const loan of amortizedLoans) {
      const currency = loan.currency
      let loanInterestCollected = 0
      let loanInterestRemaining = 0
      let loanInterestTotal = 0

      for (const inst of loan.loanInstallments) {
        const interest = Number(inst.interest)
        const paidAmount = Number(inst.paidAmount ?? 0)
        const collectedInterest = Math.min(paidAmount, interest)
        const remainingInterest = Math.max(interest - collectedInterest, 0)
        loanInterestCollected += collectedInterest
        loanInterestRemaining += remainingInterest
        loanInterestTotal += interest
      }

      const collectedArs = pesify(loanInterestCollected, currency, mepRate)
      const remainingArs = pesify(loanInterestRemaining, currency, mepRate)
      const contractualArs = pesify(loanInterestTotal, currency, mepRate)

      amortizedInterestCollected += collectedArs
      amortizedInterestContractual += contractualArs

      if (loan.status === 'active') {
        amortizedActiveCount++
        amortizedInterestRemaining += remainingArs
      } else if (loan.status === 'completed') {
        amortizedCompletedCount++
      } else if (loan.status === 'defaulted') {
        amortizedDefaultedCount++
        amortizedInterestLost += remainingArs
        amortizedPrincipalLost += pesify(Number(loan.principalOutstanding), currency, mepRate)
      }
    }

    return {
      activeLoansCount: activeLoans.length,
      totalCapitalActive,
      totalPending,
      overdueCount,
      overdueAmount,
      morosityPct,
      thisWeekCount: thisWeek.length,
      thisWeekAmount: thisWeek.reduce((s, i) => s + i.amountArs, 0),
      upcomingInstallments,
      collectionPct,
      interestOnlyRent,
      interestOnlyCollected,
      interestOnlyCapital,
      interestAccruedThisMonth,
      interestCollectedThisMonth,
      interestGap,
      amortizedYield: {
        interestCollected: amortizedInterestCollected,
        interestRemaining: amortizedInterestRemaining,
        interestContractual: amortizedInterestContractual,
        interestLost: amortizedInterestLost,
        principalLost: amortizedPrincipalLost,
        activeCount: amortizedActiveCount,
        completedCount: amortizedCompletedCount,
        defaultedCount: amortizedDefaultedCount,
      },
    }
  }),

  getDashboardMetricsDebtor: protectedProcedure.query(async ({ ctx }) => {
    const [activeDebts, mepRate] = await Promise.all([
      ctx.prisma.loan.findMany({
        where: { userId: ctx.user.id, status: 'active', direction: 'borrower' },
        include: {
          loanInstallments: {
            where: { isPaid: false },
            orderBy: { dueDate: 'asc' },
            select: { id: true, number: true, dueDate: true, amount: true, paidAmount: true },
          },
        },
      }),
      getDolarMep(),
    ])

    const totalDebt = activeDebts.reduce(
      (sum, loan) => sum + pesify(Number(loan.capital), loan.currency, mepRate), 0
    )
    // Zero-rate loans (any type) have no installment schedule
    const getEffectiveInstallments = (loan: typeof activeDebts[0]) =>
      Number(loan.monthlyRate) === 0 ? [] : loan.loanInstallments

    const totalPending = activeDebts.reduce(
      (sum, loan) => sum + getEffectiveInstallments(loan).reduce(
        (s, i) => s + pesify(Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0), loan.currency, mepRate), 0
      ), 0
    )

    const now = new Date()
    // Skip $0 installments (e.g. interest_only loans at 0% TNA) and zero-rate amortized
    const allUnpaid = activeDebts.flatMap((loan) =>
      getEffectiveInstallments(loan).map((i) => {
        const remaining = Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0)
        return {
          ...i,
          amount: remaining,
          amountArs: pesify(remaining, loan.currency, mepRate),
          creditorName: loan.creditorName || loan.borrowerName,
          loanId: loan.id,
          currency: loan.currency,
        }
      }).filter((i) => i.amount > 0)
    )

    const overdueCount = allUnpaid.filter((i) => i.dueDate < now).length
    const overdueAmount = allUnpaid.filter((i) => i.dueDate < now).reduce((s, i) => s + i.amountArs, 0)

    const nextInstallment = allUnpaid
      .filter((i) => i.dueDate >= now)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] || null

    return {
      activeDebtsCount: activeDebts.length,
      totalDebt,
      totalPending,
      overdueCount,
      overdueAmount,
      nextInstallment,
    }
  }),

  getMonthlyAccruals: protectedProcedure
    .input(z.object({ loanId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.loanAccrualMonthly.findMany({
        where: { loanId: input.loanId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      })
    }),
})
