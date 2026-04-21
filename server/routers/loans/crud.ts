import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/lib/trpc'
import { tnaToMonthlyRate, frenchInstallment, reverseFromInstallment, generateAmortizationTable, generateSmartAmortizationTable, strategicRoundInstallment } from '@/lib/loan-calculator'
import { addMonths, format as formatDate } from 'date-fns'
import { LoanAccountingService } from '../../services/loan-accounting.service'
import { getSmartDueDates } from '@/lib/business-days'

const createLoanInput = z.object({
  borrowerName: z.string().min(1, 'El nombre del deudor es requerido'),
  capital: z.number().positive(),
  currency: z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  loanType: z.enum(['amortized', 'interest_only']).default('amortized'),
  tna: z.number().min(0).optional(),
  monthlyInterestRate: z.number().min(0).optional(),
  termMonths: z.number().int().min(1).max(360).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  personId: z.string().optional(),
  roundingMultiple: z.number().int().min(0).optional(),
  smartDueDate: z.boolean().optional(),
  firstInstallmentMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  direction: z.enum(['lender', 'borrower']).default('lender'),
  creditorName: z.string().optional(),
  collectorId: z.string().optional(),
})

type InstallmentRow = {
  number: number
  dueDate: Date
  amount: number
  interest: number
  principal: number
  balance: number
}

type LoanPlan = {
  loanType: 'interest_only' | 'amortized'
  tna: number
  monthlyRate: number
  installmentAmount: number
  totalAmount: number | null
  termMonths: number | null
  installmentRows: InstallmentRow[]
}

function computeLoanPlan(input: z.infer<typeof createLoanInput>): LoanPlan {
  const startDate = new Date(input.startDate + 'T12:00:00')

  if (input.loanType === 'interest_only') {
    const rate = input.monthlyInterestRate
    if (rate === undefined || rate === null) throw new TRPCError({ code: 'BAD_REQUEST', message: 'La tasa mensual es requerida para préstamos interest-only' })
    const monthlyInterest = input.capital * rate
    const tna = rate * 12
    const installmentRows: InstallmentRow[] = rate > 0
      ? (input.smartDueDate
          ? getSmartDueDates(startDate, 12)
          : Array.from({ length: 12 }, (_, i) => addMonths(startDate, i + 1))
        ).map((dueDate, i) => ({ number: i + 1, dueDate, amount: monthlyInterest, interest: monthlyInterest, principal: 0, balance: input.capital }))
      : []
    return { loanType: 'interest_only', tna, monthlyRate: rate, installmentAmount: monthlyInterest, totalAmount: null, termMonths: null, installmentRows }
  }

  // Amortized
  if (!input.termMonths) throw new TRPCError({ code: 'BAD_REQUEST', message: 'El plazo es requerido para préstamos amortizados' })
  if (input.tna === undefined || input.tna === null) throw new TRPCError({ code: 'BAD_REQUEST', message: 'La TNA es requerida para préstamos amortizados' })

  if (input.smartDueDate || input.firstInstallmentMonth) {
    const smart = generateSmartAmortizationTable(input.capital, input.tna, input.startDate, input.termMonths, input.roundingMultiple ?? 0, input.firstInstallmentMonth)
    const installmentRows: InstallmentRow[] = input.tna > 0
      ? smart.rows.map(row => ({ number: row.month, dueDate: new Date(row.date + 'T12:00:00'), amount: row.installment, interest: row.interest, principal: row.principal, balance: row.balance }))
      : []
    return { loanType: 'amortized', tna: smart.effectiveTna, monthlyRate: smart.effectiveTna / 12, installmentAmount: smart.installmentAmount, totalAmount: smart.totalPaid, termMonths: input.termMonths, installmentRows }
  }

  // Standard French
  const monthlyRate = tnaToMonthlyRate(input.tna)
  const exactInstallment = frenchInstallment(input.capital, monthlyRate, input.termMonths)
  const installmentAmount = input.roundingMultiple && input.roundingMultiple > 0
    ? strategicRoundInstallment(input.capital, input.termMonths, exactInstallment, input.tna, input.roundingMultiple)
    : exactInstallment
  let tna = input.tna
  let effectiveMonthlyRate = monthlyRate
  if (installmentAmount !== exactInstallment) {
    const real = reverseFromInstallment(input.capital, input.termMonths, installmentAmount)
    if (real) { tna = real.tna; effectiveMonthlyRate = real.monthlyRate }
  }
  const totalAmount = installmentAmount * input.termMonths
  const table = generateAmortizationTable(input.capital, effectiveMonthlyRate, input.termMonths, installmentAmount, input.startDate)
  const installmentRows: InstallmentRow[] = input.tna > 0
    ? table.map(row => ({ number: row.month, dueDate: new Date(row.date + 'T12:00:00'), amount: row.installment, interest: row.interest, principal: row.principal, balance: row.balance }))
    : []
  return { loanType: 'amortized', tna, monthlyRate: effectiveMonthlyRate, installmentAmount, totalAmount, termMonths: input.termMonths, installmentRows }
}

export const loanCrudRouter = router({
  create: protectedProcedure
    .input(createLoanInput)
    .mutation(async ({ ctx, input }) => {
      const plan = computeLoanPlan(input)
      const startDate = new Date(input.startDate + 'T12:00:00')
      const loan = await ctx.prisma.loan.create({
        data: {
          userId: ctx.user.id,
          borrowerName: input.borrowerName,
          capital: input.capital,
          currency: input.currency,
          loanType: plan.loanType,
          tna: plan.tna,
          rateIsNominal: true,
          termMonths: plan.termMonths,
          monthlyRate: plan.monthlyRate,
          installmentAmount: plan.installmentAmount,
          totalAmount: plan.totalAmount,
          startDate,
          status: 'active',
          principalOutstanding: input.capital,
          overdueInterestOutstanding: 0,
          personId: input.personId ?? null,
          direction: input.direction,
          creditorName: input.creditorName ?? null,
          collectorId: input.collectorId ?? null,
          ...(plan.installmentRows.length > 0 ? {
            loanInstallments: { create: plan.installmentRows },
          } : {}),
        },
        include: { loanInstallments: { orderBy: { number: 'asc' } } },
      })
      return loan
    }),

  list: protectedProcedure
    .input(z.object({
      direction: z.enum(['lender', 'borrower']).optional(),
      status: z.enum(['active', 'completed', 'refinanced']).optional(),
      collectorId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const statusFilter: Prisma.LoanWhereInput =
        input?.status === 'completed' ? { status: 'completed' } :
        input?.status === 'refinanced' ? { status: 'refinanced' } :
        { status: { in: ['active', 'pre_approved'] } }

      const loans = await ctx.prisma.loan.findMany({
        where: {
          userId: ctx.user.id,
          ...(input?.direction ? { direction: input.direction } : {}),
          ...(input?.collectorId ? { collectorId: input.collectorId } : {}),
          ...statusFilter,
        },
        include: {
          person: {
            select: {
              id: true,
              name: true,
              alias: true,
              punctualityScore: true,
              communicationScore: true,
              debtAttitudeScore: true,
              relationship: true,
              incomeType: true,
              tenureMonths: true,
              estimatedIncome: true,
              referrer: true,
              livesAlone: true,
              hasChildren: true,
              recentJobChanges: true,
              previousDebts: true,
            },
          },
          collector: {
            select: { id: true, name: true },
          },
          loanInstallments: {
            orderBy: { number: 'asc' },
            select: {
              id: true,
              number: true,
              dueDate: true,
              amount: true,
              isPaid: true,
              paidAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return loans.map((loan) => {
        // Zero-rate loans (any type) have no installment schedule — hide any legacy installments
        const effectiveInstallments = Number(loan.monthlyRate) === 0
          ? []
          : loan.loanInstallments
        const paid = effectiveInstallments.filter((i) => i.isPaid).length
        const total = effectiveInstallments.length
        const nextInstallment = effectiveInstallments.find((i) => !i.isPaid)

        return {
          ...loan,
          loanInstallments: effectiveInstallments,
          person: loan.person
            ? {
                ...loan.person,
                estimatedIncome: loan.person.estimatedIncome
                  ? Number(loan.person.estimatedIncome)
                  : null,
              }
            : null,
          paidCount: paid,
          totalCount: total,
          nextDueDate: nextInstallment?.dueDate || null,
          nextAmount: nextInstallment
            ? Math.max(Number(nextInstallment.amount) - Number(nextInstallment.paidAmount ?? 0), 0)
            : 0,
        }
      })
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          person: {
            select: { id: true, name: true, alias: true },
          },
          collector: {
            select: { id: true, name: true, alias: true },
          },
          loanInstallments: { orderBy: { number: 'asc' } },
          activityLogs: { orderBy: { logDate: 'desc' } },
          loanPayments: { select: { amount: true } },
        },
      })

      if (!loan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })
      }

      // Zero-rate loans (any type) have no installment schedule — hide any legacy installments
      if (Number(loan.monthlyRate) === 0) {
        return { ...loan, loanInstallments: [] }
      }

      return loan
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      borrowerName: z.string().min(1).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      personId: z.string().nullable().optional(),
      collectorId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: { loanInstallments: { orderBy: { number: 'asc' } } },
      })

      if (!loan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })
      }

      const updates: Prisma.LoanUncheckedUpdateInput = {}
      if (input.borrowerName) updates.borrowerName = input.borrowerName
      if (input.startDate) updates.startDate = new Date(input.startDate + 'T12:00:00')
      if (input.personId !== undefined) updates.personId = input.personId
      if (input.collectorId !== undefined) updates.collectorId = input.collectorId

      const updated = await ctx.prisma.loan.update({
        where: { id: input.id },
        data: updates,
      })

      // If start date changed, recalculate all installment due dates
      if (input.startDate) {
        const newStart = new Date(input.startDate + 'T12:00:00')
        await Promise.all(
          loan.loanInstallments.map((inst) =>
            ctx.prisma.loanInstallment.update({
              where: { id: inst.id },
              data: { dueDate: addMonths(newStart, inst.number) },
            })
          )
        )
      }

      return updated
    }),

  updateRate: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      tna: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id, status: 'active' },
        include: { loanInstallments: { orderBy: { number: 'asc' } } },
      })
      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })

      const newMonthlyRate = tnaToMonthlyRate(input.tna)
      const paidInstallments = loan.loanInstallments.filter((i) => i.isPaid)
      const paidCount = paidInstallments.length

      // Delete all unpaid installments — they'll be regenerated with new rate
      await ctx.prisma.loanInstallment.deleteMany({
        where: { loanId: loan.id, isPaid: false },
      })

      const principalRemaining = Number(loan.principalOutstanding)

      if (loan.loanType === 'amortized') {
        const remainingMonths = (loan.termMonths ?? 0) - paidCount

        if (remainingMonths > 0 && newMonthlyRate > 0 && principalRemaining > 0) {
          const newInstallment = frenchInstallment(principalRemaining, newMonthlyRate, remainingMonths)

          // Virtual start date: last paid installment's dueDate (so month 1 of new schedule = next due date)
          // If nothing is paid yet, use original loan start date
          const virtualStartDate = paidCount > 0
            ? formatDate(new Date(paidInstallments[paidCount - 1].dueDate), 'yyyy-MM-dd')
            : formatDate(new Date(loan.startDate), 'yyyy-MM-dd')

          const table = generateAmortizationTable(principalRemaining, newMonthlyRate, remainingMonths, newInstallment, virtualStartDate)

          await ctx.prisma.loanInstallment.createMany({
            data: table.map((row) => ({
              loanId: loan.id,
              number: paidCount + row.month,
              dueDate: new Date(row.date + 'T12:00:00'),
              amount: row.installment,
              interest: row.interest,
              principal: row.principal,
              balance: row.balance,
            })),
          })

          await ctx.prisma.loan.update({
            where: { id: loan.id },
            data: {
              tna: input.tna,
              monthlyRate: newMonthlyRate,
              installmentAmount: newInstallment,
              totalAmount: newInstallment * remainingMonths + paidInstallments.reduce((s, i) => s + Number(i.amount), 0),
            },
          })
        } else {
          // 0% or nothing remaining — just update rate fields
          const newInstallment = newMonthlyRate > 0 && remainingMonths > 0
            ? frenchInstallment(principalRemaining, newMonthlyRate, remainingMonths)
            : (loan.termMonths ? principalRemaining / (loan.termMonths - paidCount || 1) : principalRemaining)
          await ctx.prisma.loan.update({
            where: { id: loan.id },
            data: { tna: input.tna, monthlyRate: newMonthlyRate, installmentAmount: newInstallment },
          })
        }
      } else if (loan.loanType === 'interest_only') {
        const newMonthlyInterest = principalRemaining * newMonthlyRate

        if (newMonthlyRate > 0 && principalRemaining > 0) {
          // Regenerate 12 interest installments from today
          const virtualStartDate = paidCount > 0
            ? formatDate(new Date(paidInstallments[paidCount - 1].dueDate), 'yyyy-MM-dd')
            : formatDate(new Date(loan.startDate), 'yyyy-MM-dd')

          const installments = Array.from({ length: 12 }, (_, i) => ({
            loanId: loan.id,
            number: paidCount + i + 1,
            dueDate: addMonths(new Date(virtualStartDate + 'T12:00:00'), i + 1),
            amount: newMonthlyInterest,
            interest: newMonthlyInterest,
            principal: 0,
            balance: principalRemaining,
          }))

          await ctx.prisma.loanInstallment.createMany({ data: installments })
        }

        await ctx.prisma.loan.update({
          where: { id: loan.id },
          data: { tna: input.tna, monthlyRate: newMonthlyRate, installmentAmount: newMonthlyInterest },
        })
      }

      // Rebuild accruals and IRR with new rate (independent — run in parallel)
      const service = new LoanAccountingService(ctx.prisma)
      await Promise.all([
        service.rebuildMonthlyAccruals(loan.id),
        service.recalculateIrrCache(loan.id),
      ])

      return { success: true }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      })

      if (!loan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })
      }

      await ctx.prisma.loan.delete({ where: { id: input.id } })
      return { success: true }
    }),

  createPreApproved: protectedProcedure
    .input(createLoanInput)
    .mutation(async ({ ctx, input }) => {
      const plan = computeLoanPlan(input)
      const startDate = new Date(input.startDate + 'T12:00:00')
      const loan = await ctx.prisma.loan.create({
        data: {
          userId: ctx.user.id,
          borrowerName: input.borrowerName,
          capital: input.capital,
          currency: input.currency,
          loanType: plan.loanType,
          tna: plan.tna,
          rateIsNominal: true,
          termMonths: plan.termMonths,
          monthlyRate: plan.monthlyRate,
          installmentAmount: plan.installmentAmount,
          totalAmount: plan.totalAmount,
          startDate,
          status: 'pre_approved',
          principalOutstanding: input.capital,
          overdueInterestOutstanding: 0,
          personId: input.personId ?? null,
          direction: input.direction,
          creditorName: input.creditorName ?? null,
          collectorId: input.collectorId ?? null,
          // Pre-approved loans don't get installments until confirmed
        },
      })
      return loan
    }),

  confirmPreApproved: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      smartDueDate: z.boolean().optional(),
      firstInstallmentMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id, status: 'pre_approved' },
      })

      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo preaprobado no encontrado' })

      const startDate = new Date(input.startDate + 'T12:00:00')

      if (loan.loanType === 'interest_only') {
        const monthlyInterest = Number(loan.installmentAmount)
        if (monthlyInterest > 0) {
          const installments = Array.from({ length: 12 }, (_, i) => ({
            loanId: loan.id,
            number: i + 1,
            dueDate: addMonths(startDate, i + 1),
            amount: monthlyInterest,
            interest: monthlyInterest,
            principal: 0,
            balance: Number(loan.capital),
          }))

          await ctx.prisma.loanInstallment.createMany({ data: installments })
        }
      } else {
        const monthlyRate = Number(loan.monthlyRate)
        // Zero-rate loans have no installment schedule
        if (monthlyRate > 0) {
          const termMonths = loan.termMonths!
          const capital = Number(loan.capital)

          if (input.smartDueDate || input.firstInstallmentMonth) {
            // Smart schedule: recalculate from the new startDate using actual-day interest
            const smart = generateSmartAmortizationTable(
              capital,
              Number(loan.tna),
              input.startDate,
              termMonths,
              0, // rounding already applied during pre-approval
              input.firstInstallmentMonth,
            )

            await ctx.prisma.loanInstallment.createMany({
              data: smart.rows.map((row) => ({
                loanId: loan.id,
                number: row.month,
                dueDate: new Date(row.date + 'T12:00:00'),
                amount: row.installment,
                interest: row.interest,
                principal: row.principal,
                balance: row.balance,
              })),
            })

            // Update loan fields to match the recalculated schedule
            await ctx.prisma.loan.update({
              where: { id: loan.id },
              data: {
                installmentAmount: smart.installmentAmount,
                totalAmount: smart.totalPaid,
                tna: smart.effectiveTna,
                monthlyRate: smart.effectiveTna / 12,
              },
            })
          } else {
            // Standard French amortization
            const installmentAmount = Number(loan.installmentAmount)

            const table = generateAmortizationTable(
              capital,
              monthlyRate,
              termMonths,
              installmentAmount,
              input.startDate,
            )

            await ctx.prisma.loanInstallment.createMany({
              data: table.map((row) => ({
                loanId: loan.id,
                number: row.month,
                dueDate: addMonths(startDate, row.month),
                amount: row.installment,
                interest: row.interest,
                principal: row.principal,
                balance: row.balance,
              })),
            })
          }
        }
      }

      const updated = await ctx.prisma.loan.update({
        where: { id: loan.id },
        data: { startDate, status: 'active' },
        include: {
          loanInstallments: { orderBy: { number: 'asc' } },
        },
      })

      return updated
    }),
})
