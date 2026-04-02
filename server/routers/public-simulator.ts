import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '@/lib/trpc'
import { simulateLoan } from '@/lib/loan-calculator'
import type { SimulationResult } from '@/lib/loan-calculator'

export const publicSimulatorRouter = router({
  getConfig: publicProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.publicSimulatorConfig.findFirst()
    if (!config) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Simulador no configurado' })
    }
    return {
      tna: Number(config.tna),
      currency: config.currency,
      terms: config.terms.split(',').map(Number).filter(n => n > 0),
      whatsapp: config.whatsapp,
    }
  }),

  simulate: publicProcedure
    .input(z.object({
      capital: z.number().positive(),
      terms: z.array(z.number().int().min(1).max(360)).min(1).max(4),
    }))
    .mutation(async ({ ctx, input }): Promise<SimulationResult[]> => {
      const config = await ctx.prisma.publicSimulatorConfig.findFirst()
      if (!config) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Simulador no configurado' })
      }

      const baseTna = Number(config.tna)

      // Leer ajustes por plazo del mismo usuario
      const adjustments = await ctx.prisma.durationAdjustment.findMany({
        where: { userId: config.userId },
        orderBy: { minMonths: 'asc' },
      })

      const today = new Date()
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      return input.terms.map((term) => {
        const adj = [...adjustments].sort((a, b) => b.minMonths - a.minMonths).find(a => a.minMonths <= term && a.maxMonths >= term)
        const tna = (baseTna + (adj ? Number(adj.adjustment) : 0)) / 100

        return simulateLoan({
          capital: input.capital,
          termMonths: term,
          tnaTarget: tna,
          loanType: 'amortized',
          accrualType: 'exponential',
          startDate,
          roundingMultiple: config.currency === 'USD' ? 0 : 1000,
          smartDueDate: true,
        })
      })
    }),
})
