import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/lib/trpc'
import { tnaToMonthlyRate, frenchInstallment, reverseFromInstallment, generateAmortizationTable, strategicRoundInstallment, calculateInstallmentComponents, calculateRemainingCapital } from '@/lib/loan-calculator'
import { addMonths } from 'date-fns'
import { getSmartDueDatesFromFirst, getNthBusinessDay } from '@/lib/business-days'
import { LoanAccountingService } from '../../services/loan-accounting.service'

export const loanOperationsRouter = router({
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

  markInstallmentPaid: protectedProcedure
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

      // Reactivate loan only if it was completed (not if cancelled/refinanced)
      const loan = await ctx.prisma.loan.findUnique({ where: { id: installment.loanId }, select: { status: true } })
      if (loan?.status === 'completed') {
        await ctx.prisma.loan.update({
          where: { id: installment.loanId },
          data: { status: 'active' },
        })
      }

      return updated
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

      const updates: Prisma.LoanInstallmentUpdateInput = {}

      if (input.amount !== undefined) {
        const loan = installment.loan
        if (loan.loanType === 'interest_only') {
          updates.amount = input.amount
          updates.interest = input.amount
        } else {
          const prevInstallment = await ctx.prisma.loanInstallment.findFirst({
            where: {
              loanId: loan.id,
              number: installment.number - 1,
            },
          })
          const prevBalance = prevInstallment ? Number(prevInstallment.balance) : Number(loan.capital)
          const components = calculateInstallmentComponents(prevBalance, Number(loan.monthlyRate), input.amount)

          updates.amount = input.amount
          updates.interest = components.interest
          updates.principal = components.principal
          updates.balance = components.balance
        }
      }

      if (input.dueDate !== undefined) {
        updates.dueDate = new Date(input.dueDate + 'T12:00:00')
      }

      await ctx.prisma.loanInstallment.update({
        where: { id: input.installmentId },
        data: updates,
      })

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
      const loanCheck = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id, status: 'active' },
        select: { id: true },
      })
      if (!loanCheck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo activo no encontrado' })

      const startDate = new Date(input.startDate + 'T12:00:00')
      const noteText = input.note || 'Préstamo refinanciado'

      const newLoan = await ctx.prisma.$transaction(async (tx) => {
        const loan = await tx.loan.findFirst({
          where: { id: input.loanId, userId: ctx.user.id, status: 'active' },
          include: {
            loanInstallments: { where: { isPaid: false }, orderBy: { number: 'asc' } },
          },
        })
        if (!loan) throw new TRPCError({ code: 'CONFLICT', message: 'El préstamo ya no está activo' })

        const newCapital = calculateRemainingCapital(
          loan.loanInstallments.map(i => ({
            interest: Number(i.interest),
            principal: Number(i.principal),
            paidAmount: Number(i.paidAmount ?? 0),
          })),
          input.capitalizeInterest,
        )

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

  recalculate: protectedProcedure
    .input(z.object({ loanId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new LoanAccountingService(ctx.prisma)
      await service.reconcileInstallmentStates(input.loanId)
      await service.rebuildMonthlyAccruals(input.loanId)
      await service.recalculateIrrCache(input.loanId)
      return { success: true }
    }),

  markUncollectible: protectedProcedure
    .input(z.object({ loanId: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id },
        select: { id: true, status: true },
      })
      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })
      if (loan.status !== 'active') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Solo se pueden marcar como incobrables préstamos activos' })
      }

      await ctx.prisma.$transaction([
        ctx.prisma.loan.update({
          where: { id: loan.id },
          data: { status: 'defaulted' },
        }),
        ctx.prisma.loanActivityLog.create({
          data: {
            loanId: loan.id,
            userId: ctx.user.id,
            tag: 'acuerdo',
            note: input.note?.trim() || 'Préstamo marcado como incobrable',
          },
        }),
      ])

      return { success: true }
    }),

  unmarkUncollectible: protectedProcedure
    .input(z.object({ loanId: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id },
        select: { id: true, status: true },
      })
      if (!loan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })
      if (loan.status !== 'defaulted') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'El préstamo no está marcado como incobrable' })
      }

      await ctx.prisma.$transaction([
        ctx.prisma.loan.update({
          where: { id: loan.id },
          data: { status: 'active' },
        }),
        ctx.prisma.loanActivityLog.create({
          data: {
            loanId: loan.id,
            userId: ctx.user.id,
            tag: 'acuerdo',
            note: input.note?.trim() || 'Préstamo reactivado (deshace incobrable)',
          },
        }),
      ])

      return { success: true }
    }),
})
