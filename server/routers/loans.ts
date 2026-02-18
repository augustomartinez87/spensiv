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

const compareInput = z.object({
  capital: z.number().positive(),
  termMonths: z.number().int().min(1).max(360),
  tnaTarget: z.number().min(0.001),
  hurdleRate: z.number().min(0),
  accrualType: z.enum(['linear', 'exponential']).default('exponential'),
  customInstallment: z.number().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const createLoanInput = z.object({
  borrowerName: z.string().min(1, 'El nombre del deudor es requerido'),
  capital: z.number().positive(),
  tna: z.number().positive(), // decimal, e.g. 0.55
  termMonths: z.number().int().min(1).max(360),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const loansRouter = router({
  simulate: protectedProcedure
    .input(simulateInput)
    .mutation(({ input }): SimulationResult => {
      return simulateLoan(input)
    }),

  compare: protectedProcedure
    .input(compareInput)
    .mutation(({ input }): ComparisonResult => {
      return compareLoanTypes(input)
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

      const startDate = new Date(input.startDate + 'T00:00:00')

      const loan = await ctx.prisma.loan.create({
        data: {
          userId: ctx.user.id,
          borrowerName: input.borrowerName,
          capital: input.capital,
          tna: input.tna,
          termMonths: input.termMonths,
          monthlyRate,
          installmentAmount,
          totalAmount,
          startDate,
          status: 'active',
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

  list: protectedProcedure.query(async ({ ctx }) => {
    const loans = await ctx.prisma.loan.findMany({
      where: { userId: ctx.user.id },
      include: {
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

      // Check if all installments are paid → mark loan as completed
      const remaining = await ctx.prisma.loanInstallment.count({
        where: { loanId: installment.loanId, isPaid: false },
      })

      if (remaining === 0) {
        await ctx.prisma.loan.update({
          where: { id: installment.loanId },
          data: { status: 'completed' },
        })
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
    const now = new Date()

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

    // Next 5 installments due across all loans
    const upcomingInstallments = activeLoans
      .flatMap((loan) =>
        loan.loanInstallments.map((i) => ({
          ...i,
          amount: Number(i.amount),
          borrowerName: loan.borrowerName,
          loanId: loan.id,
        }))
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5)

    return {
      activeLoansCount: activeLoans.length,
      totalCapitalActive,
      totalPending,
      upcomingInstallments,
    }
  }),
})
