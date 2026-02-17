import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { simulateLoan, compareLoanTypes, reverseFromInstallment } from '@/lib/loan-calculator'
import type { SimulationResult, ComparisonResult } from '@/lib/loan-calculator'

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

export const loansRouter = router({
  /**
   * Simula un préstamo individual (bullet o amortizado)
   */
  simulate: protectedProcedure
    .input(simulateInput)
    .mutation(({ input }): SimulationResult => {
      return simulateLoan(input)
    }),

  /**
   * Compara ambos tipos de préstamo lado a lado
   */
  compare: protectedProcedure
    .input(compareInput)
    .mutation(({ input }): ComparisonResult => {
      return compareLoanTypes(input)
    }),

  /**
   * Dado capital, plazo y cuota deseada, calcula la TNA implícita
   */
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
