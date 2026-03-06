import { z } from 'zod'
import { router, publicProcedure } from '@/lib/trpc'

export const shareRouter = router({
  getPersonStatement: publicProcedure
    .input(z.object({ personId: z.string() }))
    .query(async ({ ctx, input }) => {
      const person = await ctx.prisma.person.findUnique({
        where: { id: input.personId },
        select: {
          name: true,
          loans: {
            where: {
              status: 'active',
              direction: 'lender',
            },
            select: {
              id: true,
              borrowerName: true,
              currency: true,
              loanType: true,
              capital: true,
              installmentAmount: true,
              monthlyRate: true,
              loanInstallments: {
                select: {
                  id: true,
                  number: true,
                  dueDate: true,
                  amount: true,
                  isPaid: true,
                  paidAmount: true,
                },
                orderBy: { number: 'asc' },
              },
            },
          },
        },
      })

      if (!person) {
        throw new Error('Persona no encontrada')
      }

      return {
        name: person.name,
        loans: person.loans.map((loan) => ({
          id: loan.id,
          borrowerName: loan.borrowerName,
          currency: loan.currency,
          loanType: loan.loanType,
          capital: Number(loan.capital),
          installmentAmount: loan.installmentAmount ? Number(loan.installmentAmount) : null,
          monthlyRate: loan.monthlyRate ? Number(loan.monthlyRate) : null,
          installments: loan.loanInstallments.map((inst) => ({
            id: inst.id,
            number: inst.number,
            dueDate: inst.dueDate,
            amount: Number(inst.amount),
            isPaid: inst.isPaid,
            paidAmount: inst.paidAmount ? Number(inst.paidAmount) : null,
          })),
        })),
      }
    }),
})
