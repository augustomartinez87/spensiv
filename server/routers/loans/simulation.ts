import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { simulateLoan, reverseFromInstallment } from '@/lib/loan-calculator'
import type { SimulationResult } from '@/lib/loan-calculator'

const simulateInput = z.object({
  capital: z.number().positive('El capital debe ser positivo'),
  termMonths: z.number().int().min(1).max(360),
  smartDueDate: z.boolean().optional(),
  tnaTarget: z.number().min(0.001, 'La TNA debe ser mayor a 0'),
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
  accrualType: z.enum(['linear', 'exponential']).default('exponential'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  terms: z.array(z.number().int().min(1).max(360)).min(1).max(4),
  roundingMultiple: z.number().int().min(0).optional(),
  firstInstallmentMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

export const loanSimulationRouter = router({
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
})
