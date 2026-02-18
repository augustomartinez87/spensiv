import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { simulateLoan, compareLoanTypes, reverseFromInstallment, tnaToMonthlyRate, frenchInstallment, generateAmortizationTable } from '@/lib/loan-calculator'
import type { SimulationResult, ComparisonResult } from '@/lib/loan-calculator'
import { addMonths } from 'date-fns'

const simulateInput = z.object({
  capital: z.number().positive('El capital debe ser positivo'),
  termMonths: z.number().int().min(1).max(360),
  tnaTarget: z.number().min(0.001, 'La TNA debe ser mayor a 0'),
  hurdleRate: z.number().min(0),
  loanType: z.enum(['bullet', 'amortized']),
  accrualType: z.enum(['linear', 'exponential']).default('exponential'),
  customInstallment: z.number().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const compareTermsInput = z.object({
  capital: z.number().positive(),
  tnaTarget: z.number().min(0.001),
  hurdleRate: z.number().min(0),
  accrualType: z.enum(['linear', 'exponential']).default('exponential'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  terms: z.array(z.number().int().min(1).max(360)).min(1).max(4),
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
      const startDate = new Date(input.startDate + 'T00:00:00')

      if (input.loanType === 'interest_only') {
        // Interest-only: no fixed term, monthly interest payments
        const rate = input.monthlyInterestRate
        if (rate === undefined || rate === null) throw new Error('La tasa mensual es requerida para prestamos interest-only')

        const monthlyInterest = input.capital * rate
        // Convert monthly rate to TNA for storage: TNA = (1 + r_m)^12 - 1
        const tna = Math.pow(1 + rate, 12) - 1

        // Generate 12 initial interest-only installments
        const installments = Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          dueDate: addMonths(startDate, i + 1),
          amount: monthlyInterest,
          interest: monthlyInterest,
          principal: 0,
          balance: input.capital,
        }))

        const loan = await ctx.prisma.loan.create({
          data: {
            userId: ctx.user.id,
            borrowerName: input.borrowerName,
            capital: input.capital,
            currency: input.currency,
            loanType: 'interest_only',
            tna,
            termMonths: null,
            monthlyRate: rate,
            installmentAmount: monthlyInterest,
            totalAmount: null,
            startDate,
            status: 'active',
            personId: input.personId ?? null,
            loanInstallments: { create: installments },
          },
          include: {
            loanInstallments: { orderBy: { number: 'asc' } },
          },
        })

        return loan
      }

      // Amortized loan (existing logic)
      if (!input.termMonths) throw new Error('El plazo es requerido para prestamos amortizados')
      if (input.tna === undefined || input.tna === null) throw new Error('La TNA es requerida para prestamos amortizados')

      const monthlyRate = tnaToMonthlyRate(input.tna)
      const installmentAmount = frenchInstallment(input.capital, monthlyRate, input.termMonths)
      const totalAmount = installmentAmount * input.termMonths

      const table = generateAmortizationTable(
        input.capital,
        monthlyRate,
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
          tna: input.tna,
          termMonths: input.termMonths,
          monthlyRate,
          installmentAmount,
          totalAmount,
          startDate,
          status: 'active',
          personId: input.personId ?? null,
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
        include: {
          loanInstallments: { orderBy: { number: 'asc' } },
        },
      })

      return loan
    }),

  generateMoreInstallments: protectedProcedure
    .input(z.object({ loanId: z.string(), count: z.number().int().min(1).max(24).default(12) }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id, loanType: 'interest_only' },
        include: {
          loanInstallments: { orderBy: { number: 'desc' }, take: 1 },
        },
      })

      if (!loan) throw new Error('Prestamo interest-only no encontrado')

      const lastInstallment = loan.loanInstallments[0]
      if (!lastInstallment) throw new Error('No hay cuotas existentes')

      const monthlyInterest = Number(loan.installmentAmount)
      const startNumber = lastInstallment.number + 1
      const lastDueDate = new Date(lastInstallment.dueDate)

      const newInstallments = Array.from({ length: input.count }, (_, i) => ({
        loanId: loan.id,
        number: startNumber + i,
        dueDate: addMonths(lastDueDate, i + 1),
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
      })

      if (!loan) throw new Error('Prestamo no encontrado')

      return ctx.prisma.loan.update({
        where: { id: input.loanId },
        data: { status: 'completed' },
      })
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const loans = await ctx.prisma.loan.findMany({
      where: { userId: ctx.user.id },
      include: {
        person: {
          select: { id: true, name: true, alias: true },
        },
        loanInstallments: {
          orderBy: { number: 'asc' },
          select: {
            id: true,
            number: true,
            dueDate: true,
            amount: true,
            isPaid: true,
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
        paidCount: paid,
        totalCount: total,
        nextDueDate: nextInstallment?.dueDate || null,
        nextAmount: nextInstallment ? Number(nextInstallment.amount) : 0,
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
        throw new Error('Préstamo no encontrado')
      }

      const updates: Record<string, any> = {}
      if (input.borrowerName) updates.borrowerName = input.borrowerName
      if (input.startDate) updates.startDate = new Date(input.startDate + 'T00:00:00')
      if (input.personId !== undefined) updates.personId = input.personId

      const updated = await ctx.prisma.loan.update({
        where: { id: input.id },
        data: updates,
      })

      // If start date changed, recalculate all installment due dates
      if (input.startDate) {
        const newStart = new Date(input.startDate + 'T00:00:00')
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
        throw new Error('Préstamo no encontrado')
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
        },
      })

      if (!loan) {
        throw new Error('Préstamo no encontrado')
      }

      return loan
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
        throw new Error('Cuota no encontrada')
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
        throw new Error('Cuota no encontrada')
      }

      const updated = await ctx.prisma.loanInstallment.update({
        where: { id: input.installmentId },
        data: { isPaid: false, paidAt: null },
      })

      // Reactivate loan if it was completed
      await ctx.prisma.loan.update({
        where: { id: installment.loanId },
        data: { status: 'active' },
      })

      return updated
    }),

  getDashboardMetrics: protectedProcedure.query(async ({ ctx }) => {
    const activeLoans = await ctx.prisma.loan.findMany({
      where: { userId: ctx.user.id, status: 'active' },
      include: {
        loanInstallments: {
          where: { isPaid: false },
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            number: true,
            dueDate: true,
            amount: true,
          },
        },
      },
    })

    const totalCapitalActive = activeLoans.reduce(
      (sum, loan) => sum + Number(loan.capital),
      0
    )

    const totalPending = activeLoans.reduce(
      (sum, loan) =>
        sum + loan.loanInstallments.reduce((s, i) => s + Number(i.amount), 0),
      0
    )

    const now = new Date()

    // All unpaid installments flattened
    const allUnpaid = activeLoans.flatMap((loan) =>
      loan.loanInstallments.map((i) => ({
        ...i,
        amount: Number(i.amount),
        borrowerName: loan.borrowerName,
        loanId: loan.id,
        currency: loan.currency,
      }))
    )

    // Overdue (past due date)
    const overdueInstallments = allUnpaid.filter((i) => i.dueDate < now)
    const overdueCount = overdueInstallments.length
    const overdueAmount = overdueInstallments.reduce((s, i) => s + i.amount, 0)

    // This week's installments
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thisWeek = allUnpaid.filter(
      (i) => i.dueDate >= now && i.dueDate <= weekFromNow
    )

    // Next 5 upcoming (not overdue)
    const upcomingInstallments = allUnpaid
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5)

    return {
      activeLoansCount: activeLoans.length,
      totalCapitalActive,
      totalPending,
      overdueCount,
      overdueAmount,
      thisWeekCount: thisWeek.length,
      thisWeekAmount: thisWeek.reduce((s, i) => s + i.amount, 0),
      upcomingInstallments,
    }
  }),
})
