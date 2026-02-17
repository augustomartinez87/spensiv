import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { simulateLoan, compareLoanTypes } from '@/lib/loan-calculator'
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
})
