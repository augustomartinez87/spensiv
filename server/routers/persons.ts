import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { calculatePersonScore } from '@/lib/loan-scoring'

const personInput = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  alias: z.string().optional(),
  relationship: z.enum(['amigo', 'amigo_de_amigo', 'conocido']).default('conocido'),
  referrer: z.string().optional(),
  incomeType: z.enum(['en_blanco', 'monotributo', 'informal']).default('informal'),
  sector: z.string().optional(),
  tenureMonths: z.number().int().min(0).optional(),
  estimatedIncome: z.number().min(0).optional(),
  livesAlone: z.boolean().default(false),
  hasChildren: z.boolean().default(false),
  recentJobChanges: z.boolean().default(false),
  previousDebts: z.boolean().default(false),
  punctualityScore: z.number().int().min(1).max(5).default(3),
  communicationScore: z.number().int().min(1).max(5).default(3),
  debtAttitudeScore: z.number().int().min(1).max(5).default(3),
})

export const personsRouter = router({
  create: protectedProcedure
    .input(personInput)
    .mutation(async ({ ctx, input }) => {
      const person = await ctx.prisma.person.create({
        data: {
          userId: ctx.user.id,
          ...input,
          estimatedIncome: input.estimatedIncome ?? null,
          tenureMonths: input.tenureMonths ?? null,
          alias: input.alias ?? null,
          referrer: input.referrer ?? null,
          sector: input.sector ?? null,
        },
      })

      const score = calculatePersonScore(person)
      return { ...person, ...score }
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(personInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const existing = await ctx.prisma.person.findFirst({
        where: { id, userId: ctx.user.id },
      })
      if (!existing) throw new Error('Persona no encontrada')

      const person = await ctx.prisma.person.update({
        where: { id },
        data,
      })

      const score = calculatePersonScore(person)
      return { ...person, ...score }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const person = await ctx.prisma.person.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: { loans: { where: { status: 'active' } } },
      })
      if (!person) throw new Error('Persona no encontrada')
      if (person.loans.length > 0) {
        throw new Error('No se puede eliminar una persona con prestamos activos')
      }

      await ctx.prisma.person.delete({ where: { id: input.id } })
      return { success: true }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const persons = await ctx.prisma.person.findMany({
      where: { userId: ctx.user.id },
      include: {
        loans: {
          select: {
            id: true,
            capital: true,
            status: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return persons.map((person) => {
      const score = calculatePersonScore(person)
      const activeLoans = person.loans.filter((l) => l.status === 'active')
      const totalCapital = activeLoans.reduce(
        (sum, l) => sum + Number(l.capital),
        0
      )
      return {
        ...person,
        ...score,
        loanCount: activeLoans.length,
        totalCapital,
      }
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const person = await ctx.prisma.person.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          loans: {
            include: {
              loanInstallments: {
                select: {
                  id: true,
                  number: true,
                  amount: true,
                  interest: true,
                  isPaid: true,
                  paidAt: true,
                  dueDate: true,
                },
                orderBy: { dueDate: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!person) throw new Error('Persona no encontrada')

      const score = calculatePersonScore(person)
      const activeLoans = person.loans.filter((l) => l.status === 'active')
      const totalCapital = activeLoans.reduce(
        (sum, l) => sum + Number(l.capital),
        0
      )
      const totalInterest = person.loans.reduce(
        (sum, l) =>
          sum +
          l.loanInstallments.reduce((s, i) => s + Number(i.interest), 0),
        0
      )

      return {
        ...person,
        ...score,
        totalCapital,
        totalInterest,
      }
    }),
})
