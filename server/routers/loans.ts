import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/lib/trpc'
import { simulateLoan, compareLoanTypes, reverseFromInstallment, tnaToMonthlyRate, frenchInstallment, generateAmortizationTable, generateSmartAmortizationTable, strategicRoundInstallment } from '@/lib/loan-calculator'
import type { SimulationResult, ComparisonResult } from '@/lib/loan-calculator'
import { addMonths } from 'date-fns'
import { getDolarMep, pesify } from '@/lib/dolar'
import { getSmartDueDates, getSmartDueDatesFromFirst, getNthBusinessDay } from '@/lib/business-days'
import { LoanAccountingService } from '../services/loan-accounting.service'

const simulateInput = z.object({
  capital: z.number().positive('El capital debe ser positivo'),
  termMonths: z.number().int().min(1).max(360),
  smartDueDate: z.boolean().optional(),
  tnaTarget: z.number().min(0.001, 'La TNA debe ser mayor a 0'),
  hurdleRate: z.number().min(0),
  loanType: z.enum(['bullet', 'amortized']),
  accrualType: z.enum(['linear', 'exponential']).default('exponential'),
  customInstallment: z.number().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roundingMultiple: z.number().int().min(0).optional(),
  firstInstallmentMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

const compareTermsInput = z.object({
  capital: z.number().positive(),
  tnaTarget: z.number().min(0.001),
  smartDueDate: z.boolean().optional(),
  hurdleRate: z.number().min(0),
  accrualType: z.enum(['linear', 'exponential']).default('exponential'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  terms: z.array(z.number().int().min(1).max(360)).min(1).max(4),
  roundingMultiple: z.number().int().min(0).optional(),
  firstInstallmentMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

const createLoanInput = z.object({
  borrowerName: z.string().min(1, 'El nombre del deudor es requerido'),
  capital: z.number().positive(),
  currency: z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
  loanType: z.enum(['amortized', 'interest_only']).default('amortized'),
  tna: z.number().min(0).optional(), // for amortized (0 = sin intereses)
  monthlyInterestRate: z.number().min(0).optional(), // for interest_only (0 = sin intereses)
  termMonths: z.number().int().min(1).max(360).optional(), // required for amortized
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  personId: z.string().optional(),
  roundingMultiple: z.number().int().min(0).optional(),
  smartDueDate: z.boolean().optional(),
  firstInstallmentMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  direction: z.enum(['lender', 'borrower']).default('lender'),
  creditorName: z.string().optional(),
})

export const loansRouter = router({
  simulate: protectedProcedure
    .input(simulateInput)
    .mutation(({ input }): SimulationResult => {
      return simulateLoan(input)
    }),

  compareTerms: protectedProcedure
    .input(compareTermsInput)
    .mutation(({ input }): SimulationResult[] => {
      return input.terms.map((term) =>
        simulateLoan({
          capital: input.capital,
          termMonths: term,
          tnaTarget: input.tnaTarget,
          hurdleRate: input.hurdleRate,
          loanType: 'amortized',
          accrualType: input.accrualType,
          startDate: input.startDate,
          roundingMultiple: input.roundingMultiple,
          smartDueDate: input.smartDueDate,
          firstInstallmentMonth: input.firstInstallmentMonth,
        })
      )
    }),

  reverseFromInstallment: protectedProcedure
    .input(z.object({
      capital: z.number().positive(),
      termMonths: z.number().int().min(1).max(360),
      desiredInstallment: z.number().positive(),
    }))
    .mutation(({ input }) => {
      const result = reverseFromInstallment(input.capital, input.termMonths, input.desiredInstallment)
      if (!result) {
        return { success: false as const, monthlyRate: 0, tna: 0 }
      }
      return { success: true as const, monthlyRate: result.monthlyRate, tna: result.tna }
    }),

  create: protectedProcedure
    .input(createLoanInput)
    .mutation(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate + 'T12:00:00')

      if (input.loanType === 'interest_only') {
        // Interest-only: no fixed term, monthly interest payments
        const rate = input.monthlyInterestRate
        if (rate === undefined || rate === null) throw new TRPCError({ code: 'BAD_REQUEST', message: 'La tasa mensual es requerida para préstamos interest-only' })

        const monthlyInterest = input.capital * rate
        // Store TNA nominal: TNA = rate * 12
        const tna = rate * 12

        // Generate 12 initial interest-only installments (ONLY if rate > 0)
        let installments: any[] = []
        if (rate > 0) {
          const dueDates = input.smartDueDate
            ? getSmartDueDates(startDate, 12)
            : Array.from({ length: 12 }, (_, i) => addMonths(startDate, i + 1))

          installments = dueDates.map((dueDate, i) => ({
            number: i + 1,
            dueDate,
            amount: monthlyInterest,
            interest: monthlyInterest,
            principal: 0,
            balance: input.capital,
          }))
        }

        const loan = await ctx.prisma.loan.create({
          data: {
            userId: ctx.user.id,
            borrowerName: input.borrowerName,
            capital: input.capital,
            currency: input.currency,
            loanType: 'interest_only',
            tna,
            rateIsNominal: true,
            termMonths: null,
            monthlyRate: rate,
            installmentAmount: monthlyInterest,
            totalAmount: null,
            startDate,
            status: 'active',
            principalOutstanding: input.capital,
            overdueInterestOutstanding: 0,
            personId: input.personId ?? null,
            direction: input.direction,
            creditorName: input.creditorName ?? null,
            ...(installments.length > 0 ? { loanInstallments: { create: installments } } : {})
          },
          include: {
            loanInstallments: { orderBy: { number: 'asc' } },
          },
        })

        return loan
      }

      // Amortized loan
      if (!input.termMonths) throw new TRPCError({ code: 'BAD_REQUEST', message: 'El plazo es requerido para préstamos amortizados' })
      if (input.tna === undefined || input.tna === null) throw new TRPCError({ code: 'BAD_REQUEST', message: 'La TNA es requerida para préstamos amortizados' })

      const monthlyRate = tnaToMonthlyRate(input.tna)

      // ── Smart due date path: días reales, interés diario ──────────────────
      // Also force smart path when firstInstallmentMonth is set (irregular first period)
      if (input.smartDueDate || input.firstInstallmentMonth) {
        const smart = generateSmartAmortizationTable(
          input.capital,
          input.tna,
          input.startDate,
          input.termMonths,
          input.roundingMultiple ?? 0,
          input.firstInstallmentMonth,
        )

        // Use effective TNA (recalculated after rounding) so stored rate matches installments
        const effectiveTna = smart.effectiveTna
        const effectiveMonthlyRate = effectiveTna / 12

        const loan = await ctx.prisma.loan.create({
          data: {
            userId: ctx.user.id,
            borrowerName: input.borrowerName,
            capital: input.capital,
            currency: input.currency,
            loanType: 'amortized',
            tna: effectiveTna,
            rateIsNominal: true,
            termMonths: input.termMonths,
            monthlyRate: effectiveMonthlyRate,
            installmentAmount: smart.installmentAmount,
            totalAmount: smart.totalPaid,
            startDate,
            status: 'active',
            principalOutstanding: input.capital,
            overdueInterestOutstanding: 0,
            personId: input.personId ?? null,
            direction: input.direction,
            creditorName: input.creditorName ?? null,
            loanInstallments: {
              create: smart.rows.map((row) => ({
                number: row.month,
                dueDate: new Date(row.date + 'T12:00:00'),
                amount: row.installment,
                interest: row.interest,
                principal: row.principal,
                balance: row.balance,
              })),
            },
          },
          include: { loanInstallments: { orderBy: { number: 'asc' } } },
        })
        return loan
      }

      // ── Standard French amortization path ────────────────────────────────
      const exactInstallment = frenchInstallment(input.capital, monthlyRate, input.termMonths)
      const installmentAmount = input.roundingMultiple && input.roundingMultiple > 0
        ? strategicRoundInstallment(input.capital, input.termMonths, exactInstallment, input.tna, input.roundingMultiple)
        : exactInstallment

      // If rounding changed the installment, recalculate the real TNA/rate
      let tna = input.tna
      let effectiveMonthlyRate = monthlyRate
      if (installmentAmount !== exactInstallment) {
        const real = reverseFromInstallment(input.capital, input.termMonths, installmentAmount)
        if (real) {
          tna = real.tna
          effectiveMonthlyRate = real.monthlyRate
        }
      }

      const totalAmount = installmentAmount * input.termMonths

      const table = generateAmortizationTable(
        input.capital,
        effectiveMonthlyRate,
        input.termMonths,
        installmentAmount,
        input.startDate,
      )

      const loan = await ctx.prisma.loan.create({
        data: {
          userId: ctx.user.id,
          borrowerName: input.borrowerName,
          capital: input.capital,
          currency: input.currency,
          loanType: 'amortized',
          tna,
          rateIsNominal: true,
          termMonths: input.termMonths,
          monthlyRate: effectiveMonthlyRate,
          installmentAmount,
          totalAmount,
          startDate,
          status: 'active',
          principalOutstanding: input.capital,
          overdueInterestOutstanding: 0,
          personId: input.personId ?? null,
          direction: input.direction,
          creditorName: input.creditorName ?? null,
          loanInstallments: {
            create: table.map((row) => ({
              number: row.month,
              dueDate: new Date(row.date + 'T12:00:00'),
              amount: row.installment,
              interest: row.interest,
              principal: row.principal,
              balance: row.balance,
            })),
          },
        },
        include: { loanInstallments: { orderBy: { number: 'asc' } } },
      })

      return loan
    }),

  generateMoreInstallments: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      count: z.number().int().min(1).max(24).default(12),
      smartDueDate: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id, loanType: 'interest_only' },
        include: {
          loanInstallments: { orderBy: { number: 'desc' }, take: 1 },
        },
      })

      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Prestamo interest-only no encontrado' })

      const lastInstallment = loan.loanInstallments[0]
      if (!lastInstallment) throw new TRPCError({ code: 'NOT_FOUND', message: 'No hay cuotas existentes' })

      const monthlyInterest = Number(loan.installmentAmount)
      const startNumber = lastInstallment.number + 1
      const lastDueDate = new Date(lastInstallment.dueDate)

      const nextMonthDate = addMonths(lastDueDate, 1)
      const dueDates = input.smartDueDate
        ? getSmartDueDatesFromFirst(
            getNthBusinessDay(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 2),
            input.count,
          )
        : Array.from({ length: input.count }, (_, i) => addMonths(lastDueDate, i + 1))

      const newInstallments = dueDates.map((dueDate, i) => ({
        loanId: loan.id,
        number: startNumber + i,
        dueDate,
        amount: monthlyInterest,
        interest: monthlyInterest,
        principal: 0,
        balance: Number(loan.capital),
      }))

      await ctx.prisma.loanInstallment.createMany({ data: newInstallments })

      return { added: input.count, fromNumber: startNumber }
    }),

  completeLoan: protectedProcedure
    .input(z.object({ loanId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id, status: 'active' },
        include: {
          loanInstallments: {
            where: { isPaid: false },
            select: { id: true },
            take: 1,
          },
        },
      })

      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Prestamo no encontrado' })

      if (loan.loanInstallments.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No se puede completar un préstamo con cuotas impagas',
        })
      }

      return ctx.prisma.loan.update({
        where: { id: input.loanId },
        data: { status: 'completed' },
      })
    }),

  list: protectedProcedure
    .input(z.object({
      direction: z.enum(['lender', 'borrower']).optional(),
      status: z.enum(['active', 'completed', 'refinanced']).optional(),
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
      const paid = loan.loanInstallments.filter((i) => i.isPaid).length
      const total = loan.loanInstallments.length
      const nextInstallment = loan.loanInstallments.find((i) => !i.isPaid)

      return {
        ...loan,
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

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      borrowerName: z.string().min(1).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      personId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: { loanInstallments: { orderBy: { number: 'asc' } } },
      })

      if (!loan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })
      }

      const updates: Record<string, any> = {}
      if (input.borrowerName) updates.borrowerName = input.borrowerName
      if (input.startDate) updates.startDate = new Date(input.startDate + 'T12:00:00')
      if (input.personId !== undefined) updates.personId = input.personId

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

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          person: {
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

      return loan
    }),

  registerPayment: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number().positive(),
      note: z.string().optional(),
      externalRef: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new LoanAccountingService(ctx.prisma)
      return service.registerPayment({
        loanId: input.loanId,
        userId: ctx.user.id,
        paymentDate: new Date(input.paymentDate + 'T12:00:00'),
        amount: input.amount,
        note: input.note,
        externalRef: input.externalRef,
      })
    }),

  getLoanPayments: protectedProcedure
    .input(z.object({ loanId: z.string() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id },
      })
      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })

      return ctx.prisma.loanPayment.findMany({
        where: { loanId: input.loanId },
        orderBy: { paymentDate: 'desc' },
        include: {
          realCashflows: {
            select: { component: true, amountSigned: true, flowDate: true },
          },
        },
      })
    }),

  addActivityLog: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      note: z.string().min(1),
      tag: z.enum(['llamada', 'pago', 'acuerdo', 'otro']).default('otro'),
      logDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id },
      })
      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })

      return ctx.prisma.loanActivityLog.create({
        data: {
          loanId: input.loanId,
          userId: ctx.user.id,
          note: input.note,
          tag: input.tag,
          logDate: input.logDate ? new Date(input.logDate) : new Date(),
        },
      })
    }),

  deleteActivityLog: protectedProcedure
    .input(z.object({ logId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.prisma.loanActivityLog.findFirst({
        where: { id: input.logId, userId: ctx.user.id },
      })
      if (!log) throw new TRPCError({ code: 'NOT_FOUND', message: 'Log no encontrado' })

      await ctx.prisma.loanActivityLog.delete({ where: { id: input.logId } })
      return { success: true }
    }),

  markInstallmentPaid: protectedProcedure
    .input(z.object({ installmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const installment = await ctx.prisma.loanInstallment.findFirst({
        where: {
          id: input.installmentId,
          loan: { userId: ctx.user.id },
        },
      })

      if (!installment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cuota no encontrada' })
      }

      const updated = await ctx.prisma.loanInstallment.update({
        where: { id: input.installmentId },
        data: { isPaid: true, paidAt: new Date() },
      })

      // For amortized loans: check if all installments are paid → mark loan as completed
      const loan = await ctx.prisma.loan.findUnique({ where: { id: installment.loanId } })
      if (loan?.loanType === 'amortized') {
        const remaining = await ctx.prisma.loanInstallment.count({
          where: { loanId: installment.loanId, isPaid: false },
        })

        if (remaining === 0) {
          await ctx.prisma.loan.update({
            where: { id: installment.loanId },
            data: { status: 'completed' },
          })
        }
      }

      return updated
    }),

  unmarkInstallmentPaid: protectedProcedure
    .input(z.object({ installmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.loanInstallment.findFirst({
        where: {
          id: input.installmentId,
          loan: { userId: ctx.user.id },
        },
      })

      if (!installment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cuota no encontrada' })
      }

      const updated = await ctx.prisma.loanInstallment.update({
        where: { id: input.installmentId },
        data: { isPaid: false, paidAt: null, paidAmount: 0 },
      })

      // Reactivate loan if it was completed
      await ctx.prisma.loan.update({
        where: { id: installment.loanId },
        data: { status: 'active' },
      })

      return updated
    }),

  createPreApproved: protectedProcedure
    .input(createLoanInput)
    .mutation(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate + 'T12:00:00')

      if (input.loanType === 'interest_only') {
        const rate = input.monthlyInterestRate
        if (rate === undefined || rate === null) throw new TRPCError({ code: 'BAD_REQUEST', message: 'La tasa mensual es requerida para préstamos interest-only' })

        const monthlyInterest = input.capital * rate
        const tna = rate * 12  // Store TNA nominal

        const loan = await ctx.prisma.loan.create({
          data: {
            userId: ctx.user.id,
            borrowerName: input.borrowerName,
            capital: input.capital,
            currency: input.currency,
            loanType: 'interest_only',
            tna,
            rateIsNominal: true,
            termMonths: null,
            monthlyRate: rate,
            installmentAmount: monthlyInterest,
            totalAmount: null,
            startDate,
            status: 'pre_approved',
            principalOutstanding: input.capital,
            overdueInterestOutstanding: 0,
            personId: input.personId ?? null,
            direction: input.direction,
            creditorName: input.creditorName ?? null,
          },
        })

        return loan
      }

      // Amortized
      if (!input.termMonths) throw new TRPCError({ code: 'BAD_REQUEST', message: 'El plazo es requerido para préstamos amortizados' })
      if (input.tna === undefined || input.tna === null) throw new TRPCError({ code: 'BAD_REQUEST', message: 'La TNA es requerida para préstamos amortizados' })

      let monthlyRate = tnaToMonthlyRate(input.tna)
      const exactInstallment = frenchInstallment(input.capital, monthlyRate, input.termMonths)
      const installmentAmount = input.roundingMultiple && input.roundingMultiple > 0
        ? strategicRoundInstallment(input.capital, input.termMonths, exactInstallment, input.tna, input.roundingMultiple)
        : exactInstallment

      // If rounding changed the installment, recalculate the real TNA/rate
      let tna = input.tna
      if (installmentAmount !== exactInstallment) {
        const real = reverseFromInstallment(input.capital, input.termMonths, installmentAmount)
        if (real) {
          tna = real.tna
          monthlyRate = real.monthlyRate
        }
      }

      const totalAmount = installmentAmount * input.termMonths

      const loan = await ctx.prisma.loan.create({
        data: {
          userId: ctx.user.id,
          borrowerName: input.borrowerName,
          capital: input.capital,
          currency: input.currency,
          loanType: 'amortized',
          tna,
          rateIsNominal: true,
          termMonths: input.termMonths,
          monthlyRate,
          installmentAmount,
          totalAmount,
          startDate,
          status: 'pre_approved',
          principalOutstanding: input.capital,
          overdueInterestOutstanding: 0,
          personId: input.personId ?? null,
          direction: input.direction,
          creditorName: input.creditorName ?? null,
        },
      })

      return loan
    }),

  confirmPreApproved: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
        const termMonths = loan.termMonths!
        const installmentAmount = Number(loan.installmentAmount)

        const table = generateAmortizationTable(
          Number(loan.capital),
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

      const updated = await ctx.prisma.loan.update({
        where: { id: loan.id },
        data: { startDate, status: 'active' },
        include: {
          loanInstallments: { orderBy: { number: 'asc' } },
        },
      })

      return updated
    }),

  refinanceLoan: protectedProcedure
    .input(z.object({
      loanId: z.string(),
      capitalizeInterest: z.boolean().default(false),
      tna: z.number().min(0),
      termMonths: z.number().int().min(1).max(360),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().optional(),
      roundingMultiple: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Preliminary check outside transaction
      const loanCheck = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id, status: 'active' },
        select: { id: true },
      })
      if (!loanCheck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo activo no encontrado' })

      const startDate = new Date(input.startDate + 'T12:00:00')
      const noteText = input.note || 'Préstamo refinanciado'

      // Interactive transaction: re-read installments inside to avoid stale data
      const newLoan = await ctx.prisma.$transaction(async (tx) => {
        const loan = await tx.loan.findFirst({
          where: { id: input.loanId, userId: ctx.user.id, status: 'active' },
          include: {
            loanInstallments: { where: { isPaid: false }, orderBy: { number: 'asc' } },
          },
        })
        if (!loan) throw new TRPCError({ code: 'CONFLICT', message: 'El préstamo ya no está activo' })

        // Calculate new capital: sum of remaining unpaid principal (accounting for partial payments)
        let newCapital = loan.loanInstallments.reduce((sum, i) => {
          const paid = Number(i.paidAmount ?? 0)
          const paidInterest = Math.min(paid, Number(i.interest))
          const paidPrincipal = Math.max(paid - paidInterest, 0)
          return sum + Math.max(Number(i.principal) - paidPrincipal, 0)
        }, 0)
        if (input.capitalizeInterest) {
          newCapital += loan.loanInstallments.reduce((sum, i) => {
            const paid = Number(i.paidAmount ?? 0)
            const paidInterest = Math.min(paid, Number(i.interest))
            return sum + Math.max(Number(i.interest) - paidInterest, 0)
          }, 0)
        }

        let monthlyRate = tnaToMonthlyRate(input.tna)
        const exactInstallment = frenchInstallment(newCapital, monthlyRate, input.termMonths)
        const installmentAmount = input.roundingMultiple && input.roundingMultiple > 0
          ? strategicRoundInstallment(newCapital, input.termMonths, exactInstallment, input.tna, input.roundingMultiple)
          : exactInstallment

        let tna = input.tna
        if (installmentAmount !== exactInstallment) {
          const real = reverseFromInstallment(newCapital, input.termMonths, installmentAmount)
          if (real) {
            tna = real.tna
            monthlyRate = real.monthlyRate
          }
        }

        const totalAmount = installmentAmount * input.termMonths
        const table = generateAmortizationTable(newCapital, monthlyRate, input.termMonths, installmentAmount, input.startDate)

        await tx.loan.update({
          where: { id: loan.id },
          data: { status: 'refinanced' },
        })

        const created = await tx.loan.create({
          data: {
            userId: ctx.user.id,
            borrowerName: loan.borrowerName,
            capital: newCapital,
            currency: loan.currency,
            loanType: 'amortized',
            tna,
            rateIsNominal: true,
            termMonths: input.termMonths,
            monthlyRate,
            installmentAmount,
            totalAmount,
            startDate,
            status: 'active',
            principalOutstanding: newCapital,
            overdueInterestOutstanding: 0,
            personId: loan.personId,
            originalLoanId: loan.id,
            loanInstallments: {
              create: table.map((row) => ({
                number: row.month,
                dueDate: addMonths(startDate, row.month),
                amount: row.installment,
                interest: row.interest,
                principal: row.principal,
                balance: row.balance,
              })),
            },
          },
        })

        await tx.loan.update({
          where: { id: loan.id },
          data: { refinancedByLoanId: created.id },
        })

        await tx.loanActivityLog.createMany({
          data: [
            { loanId: loan.id, userId: ctx.user.id, tag: 'acuerdo', note: `Refinanciado → nuevo préstamo` },
            { loanId: created.id, userId: ctx.user.id, tag: 'acuerdo', note: `Refinanciamiento de préstamo anterior. ${noteText}` },
          ],
        })

        return created
      })

      return newLoan
    }),

  getDashboardMetrics: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const [activeLoans, mepRate] = await Promise.all([
      ctx.prisma.loan.findMany({
        where: { userId: ctx.user.id, status: 'active', direction: 'lender' },
        include: {
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
    ])

    const totalCapitalActive = activeLoans.reduce(
      (sum, loan) => sum + pesify(Number(loan.capital), loan.currency, mepRate),
      0
    )

    const totalPending = activeLoans.reduce(
      (sum, loan) =>
        sum + loan.loanInstallments
          .filter((i) => !i.isPaid)
          .reduce(
            (s, i) => s + pesify(Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0), loan.currency, mepRate),
            0
          ),
      0
    )

    // All unpaid installments flattened (keep original currency for display)
    const allUnpaid = activeLoans.flatMap((loan) =>
      loan.loanInstallments
        .filter((i) => !i.isPaid)
        .map((i) => {
          const remaining = Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0)
          return {
            ...i,
            amount: remaining,
            amountArs: pesify(remaining, loan.currency, mepRate),
            borrowerName: loan.borrowerName,
            loanId: loan.id,
            currency: loan.currency,
          }
        })
    )

    // Overdue (past due date)
    const overdueInstallments = allUnpaid.filter((i) => i.dueDate < now)
    const overdueCount = overdueInstallments.length
    const overdueAmount = overdueInstallments.reduce((s, i) => s + i.amountArs, 0)

    // This week's installments
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thisWeek = allUnpaid.filter(
      (i) => i.dueDate >= now && i.dueDate <= weekFromNow
    )

    // Next 5 upcoming
    const upcomingInstallments = allUnpaid
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5)

    // Cobranza del mes: partition this month's installments from the combined query
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

    // Cobranza del mes: null when no installments due, otherwise percentage
    const collectionPct = totalDueThisMonth > 0
      ? (totalCollectedThisMonth / totalDueThisMonth) * 100
      : null

    // Mora
    const morosityPct = totalCapitalActive > 0 ? (overdueAmount / totalCapitalActive) * 100 : 0

    // Renta mensual (interest-only loans)
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
    const totalPending = activeDebts.reduce(
      (sum, loan) => sum + loan.loanInstallments.reduce(
        (s, i) => s + pesify(Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0), loan.currency, mepRate), 0
      ), 0
    )

    const now = new Date()
    const allUnpaid = activeDebts.flatMap((loan) =>
      loan.loanInstallments.map((i) => {
        const remaining = Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0)
        return {
          ...i,
          amount: remaining,
          amountArs: pesify(remaining, loan.currency, mepRate),
          creditorName: loan.creditorName || loan.borrowerName,
          loanId: loan.id,
          currency: loan.currency,
        }
      })
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

  updatePaymentNote: protectedProcedure
    .input(z.object({ paymentId: z.string(), note: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.prisma.loanPayment.findFirst({
        where: { id: input.paymentId, loan: { userId: ctx.user.id } },
      })
      if (!payment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pago no encontrado' })
      return ctx.prisma.loanPayment.update({
        where: { id: input.paymentId },
        data: { note: input.note || null },
      })
    }),

  deletePayment: protectedProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new LoanAccountingService(ctx.prisma)
      return service.deletePayment({ paymentId: input.paymentId, userId: ctx.user.id })
    }),

  payInstallment: protectedProcedure
    .input(z.object({
      installmentId: z.string(),
      paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.loanInstallment.findFirst({
        where: { id: input.installmentId, loan: { userId: ctx.user.id } },
      })
      if (!installment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cuota no encontrada' })
      if (installment.isPaid) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'La cuota ya está cobrada' })

      const remaining = Math.max(Number(installment.amount) - Number(installment.paidAmount ?? 0), 0)
      if (remaining <= 0.01) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'La cuota ya está completamente pagada' })

      const service = new LoanAccountingService(ctx.prisma)
      return service.registerPayment({
        loanId: installment.loanId,
        userId: ctx.user.id,
        paymentDate: new Date(input.paymentDate + 'T12:00:00'),
        amount: remaining,
        note: input.note,
      })
    }),

  updateInstallment: protectedProcedure
    .input(z.object({
      installmentId: z.string(),
      amount: z.number().positive().optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.loanInstallment.findFirst({
        where: { id: input.installmentId, loan: { userId: ctx.user.id } },
        include: { loan: true },
      })

      if (!installment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cuota no encontrada' })
      if (installment.isPaid) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No se puede editar una cuota cobrada' })
      if (Number(installment.paidAmount ?? 0) > 0) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No se puede editar una cuota con pagos parciales' })
      if (!input.amount && !input.dueDate) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Debe indicar monto o fecha a modificar' })

      const updates: Record<string, any> = {}

      if (input.amount !== undefined) {
        const loan = installment.loan
        if (loan.loanType === 'interest_only') {
          // For interest-only: amount = interest, principal stays 0
          updates.amount = input.amount
          updates.interest = input.amount
        } else {
          // For amortized: update amount, recalculate interest/principal split
          // Find the previous installment's balance to determine interest portion
          const prevInstallment = await ctx.prisma.loanInstallment.findFirst({
            where: {
              loanId: loan.id,
              number: installment.number - 1,
            },
          })
          const prevBalance = prevInstallment ? Number(prevInstallment.balance) : Number(loan.capital)
          const monthlyRate = Number(loan.monthlyRate)
          const interest = prevBalance * monthlyRate
          const principal = Math.max(input.amount - interest, 0)
          const balance = Math.max(prevBalance - principal, 0)

          updates.amount = input.amount
          updates.interest = interest
          updates.principal = principal
          updates.balance = balance
        }
      }

      if (input.dueDate !== undefined) {
        updates.dueDate = new Date(input.dueDate + 'T12:00:00')
      }

      await ctx.prisma.loanInstallment.update({
        where: { id: input.installmentId },
        data: updates,
      })

      // Trigger full recalculation
      const service = new LoanAccountingService(ctx.prisma)
      await service.reconcileInstallmentStates(installment.loanId)
      await service.rebuildMonthlyAccruals(installment.loanId)
      await service.recalculateIrrCache(installment.loanId)

      return { success: true }
    }),

  waiveInstallmentBalance: protectedProcedure
    .input(z.object({
      installmentId: z.string(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.loanInstallment.findFirst({
        where: { id: input.installmentId, loan: { userId: ctx.user.id } },
      })
      if (!installment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cuota no encontrada' })
      if (installment.isPaid) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'La cuota ya está completamente pagada' })

      const remaining = Math.max(Number(installment.amount) - Number(installment.paidAmount ?? 0), 0)
      if (remaining <= 0.01) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No hay saldo pendiente para condonar' })

      const service = new LoanAccountingService(ctx.prisma)
      return service.applyWaiver({
        loanId: installment.loanId,
        userId: ctx.user.id,
        installmentId: input.installmentId,
        note: input.note,
      })
    }),

  recalculate: protectedProcedure
    .input(z.object({ loanId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new LoanAccountingService(ctx.prisma)
      await service.reconcileInstallmentStates(input.loanId)
      await service.rebuildMonthlyAccruals(input.loanId)
      await service.recalculateIrrCache(input.loanId)
      return { success: true }
    }),

  /**
   * Reparar préstamos a tasa 0% que quedaron con cuotas de $0.
   * Recalcula: installmentAmount = capital / termMonths, interest = 0.
   * Respeta cuotas ya pagadas (no modifica paidAmount/paidAt).
   */
  repairZeroRateLoans: protectedProcedure.mutation(async ({ ctx }) => {
    const loans = await ctx.prisma.loan.findMany({
      where: {
        userId: ctx.user.id,
        loanType: 'amortized',
        tna: 0,
        status: { in: ['active', 'completed'] },
      },
      include: {
        loanInstallments: { orderBy: { number: 'asc' } },
      },
    })

    let loansFixed = 0
    let installmentsFixed = 0

    for (const loan of loans) {
      const capital = Number(loan.capital)
      const termMonths = loan.termMonths!
      const installmentAmount = Math.round((capital / termMonths) * 100) / 100

      // Check if this loan actually has broken installments
      const hasBrokenInstallments = loan.loanInstallments.some(
        (inst) => Number(inst.amount) === 0 && !inst.isPaid
      )
      if (!hasBrokenInstallments) continue

      // Recalculate: each installment = capital/N, interest = 0, balance decreases
      let balance = capital
      const updates = loan.loanInstallments.map((inst) => {
        const isLast = inst.number === termMonths
        const cuota = isLast ? balance : installmentAmount
        const newBalance = isLast ? 0 : Math.round((balance - cuota) * 100) / 100
        const result = {
          id: inst.id,
          amount: cuota,
          interest: 0,
          principal: cuota,
          balance: newBalance,
        }
        balance = newBalance
        return result
      })

      await ctx.prisma.$transaction(async (tx) => {
        // Update loan-level amounts
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            installmentAmount,
            totalAmount: capital,
            monthlyRate: 0,
          },
        })

        // Update each installment
        for (const upd of updates) {
          await tx.loanInstallment.update({
            where: { id: upd.id },
            data: {
              amount: upd.amount,
              interest: upd.interest,
              principal: upd.principal,
              balance: upd.balance,
            },
          })
        }

        installmentsFixed += updates.length
      })

      loansFixed++
    }

    return { loansFixed, installmentsFixed }
  }),
})
