import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import {
  createTransactionWithInstallments,
  voidTransaction,
  recalculateBillingCycleDates,
  recalculateThirdPartyInstallmentDates,
} from '@/lib/installment-engine'
import { Decimal } from '@prisma/client/runtime/library'

function computeCollectionStats(installments: Array<{ isCollected: boolean; amount: Decimal | number }>, totalAmount: number) {
  const collected = installments.filter((i) => i.isCollected)
  const collectedAmount = collected.reduce((sum, i) => sum + Number(i.amount), 0)
  return {
    collectedCount: collected.length,
    collectedAmount,
    pendingCount: installments.length - collected.length,
    pendingAmount: totalAmount - collectedAmount,
  }
}

export const thirdPartyPurchasesRouter = router({
  /**
   * Crear compra de tercero
   * Crea Transaction con isForThirdParty=true + ThirdPartyPurchase + N ThirdPartyInstallments
   */
  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1),
        personId: z.string().optional(),
        personName: z.string().min(1),
        cardId: z.string().min(1),
        totalAmount: z.number().positive(),
        installments: z.number().int().min(1),
        currency: z.enum(['ARS', 'USD']).default('ARS'),
        purchaseDate: z.string(), // ISO date string
        notes: z.string().optional(),
        categoryId: z.string().optional(),
        subcategoryId: z.string().optional(),
        expenseType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const purchaseDate = new Date(input.purchaseDate)
      const installmentAmount = new Decimal(input.totalAmount).div(input.installments).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

      // 1. Create the real Transaction with isForThirdParty=true
      const transaction = await createTransactionWithInstallments({
        userId: ctx.user.id,
        paymentMethod: 'credit_card',
        cardId: input.cardId,
        description: `[Tercero] ${input.description}`,
        totalAmount: input.totalAmount,
        purchaseDate,
        installments: input.installments,
        isForThirdParty: true,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        expenseType: input.expenseType,
        notes: input.notes,
      })

      try {
        // 2. Fetch installments with billing cycle dueDates
        const createdInstallments = await ctx.prisma.installment.findMany({
          where: { transactionId: transaction.id },
          include: { billingCycle: { select: { dueDate: true } } },
          orderBy: { installmentNumber: 'asc' },
        })

        // 3. Create ThirdPartyPurchase for collection tracking
        const thirdPartyPurchase = await ctx.prisma.thirdPartyPurchase.create({
          data: {
            userId: ctx.user.id,
            description: input.description,
            personId: input.personId || null,
            personName: input.personName,
            cardId: input.cardId,
            transactionId: transaction.id,
            totalAmount: new Decimal(input.totalAmount),
            installments: input.installments,
            installmentAmount,
            currency: input.currency,
            purchaseDate,
            notes: input.notes,
            collectionInstallments: {
              create: createdInstallments.map((inst) => ({
                number: inst.installmentNumber,
                amount: installmentAmount,
                dueDate: inst.billingCycle.dueDate,
              })),
            },
          },
          include: {
            collectionInstallments: true,
          },
        })

        return thirdPartyPurchase
      } catch (error) {
        // Rollback: void the transaction if ThirdPartyPurchase creation fails
        await voidTransaction(transaction.id)
        throw error
      }
    }),

  /**
   * Listar compras de terceros
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'completed', 'all']).default('all'),
        cardId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: { userId: string; status?: string; cardId?: string } = { userId: ctx.user.id }
      if (input.status !== 'all') {
        where.status = input.status
      }
      if (input.cardId) {
        where.cardId = input.cardId
      }

      const purchases = await ctx.prisma.thirdPartyPurchase.findMany({
        where,
        include: {
          person: { select: { id: true, name: true } },
          card: { select: { id: true, name: true, bank: true, brand: true } },
          collectionInstallments: {
            orderBy: { number: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return purchases.map((p) => ({
          ...p,
          totalAmount: Number(p.totalAmount),
          installmentAmount: Number(p.installmentAmount),
          ...computeCollectionStats(p.collectionInstallments, Number(p.totalAmount)),
          collectionInstallments: p.collectionInstallments.map((i) => ({
            ...i,
            amount: Number(i.amount),
          })),
        }))
    }),

  /**
   * Detalle de compra de tercero
   */
  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const purchase = await ctx.prisma.thirdPartyPurchase.findFirst({
        where: { id: input, userId: ctx.user.id },
        include: {
          person: { select: { id: true, name: true } },
          card: { select: { id: true, name: true, bank: true, brand: true } },
          collectionInstallments: {
            orderBy: { number: 'asc' },
          },
        },
      })

      if (!purchase) return null

      return {
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        installmentAmount: Number(purchase.installmentAmount),
        ...computeCollectionStats(purchase.collectionInstallments, Number(purchase.totalAmount)),
        collectionInstallments: purchase.collectionInstallments.map((i) => ({
          ...i,
          amount: Number(i.amount),
        })),
      }
    }),

  /**
   * Marcar cuota como cobrada
   */
  markInstallmentCollected: protectedProcedure
    .input(
      z.object({
        installmentId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.thirdPartyInstallment.findUnique({
        where: { id: input.installmentId },
        include: {
          thirdPartyPurchase: { select: { userId: true, id: true, installments: true } },
        },
      })

      if (!installment || installment.thirdPartyPurchase.userId !== ctx.user.id) {
        throw new Error('Cuota no encontrada')
      }

      await ctx.prisma.thirdPartyInstallment.update({
        where: { id: input.installmentId },
        data: {
          isCollected: true,
          collectedAt: new Date(),
          collectionNotes: input.notes,
        },
      })

      // Check if all installments are collected
      const allInstallments = await ctx.prisma.thirdPartyInstallment.findMany({
        where: { thirdPartyPurchaseId: installment.thirdPartyPurchaseId },
      })

      const allCollected = allInstallments.every((i) => i.id === input.installmentId || i.isCollected)

      if (allCollected) {
        await ctx.prisma.thirdPartyPurchase.update({
          where: { id: installment.thirdPartyPurchaseId },
          data: { status: 'completed' },
        })
      }

      return { success: true }
    }),

  /**
   * Revertir cobro de cuota
   */
  markInstallmentUncollected: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.prisma.thirdPartyInstallment.findUnique({
        where: { id: input },
        include: {
          thirdPartyPurchase: { select: { userId: true, id: true, status: true } },
        },
      })

      if (!installment || installment.thirdPartyPurchase.userId !== ctx.user.id) {
        throw new Error('Cuota no encontrada')
      }

      await ctx.prisma.thirdPartyInstallment.update({
        where: { id: input },
        data: {
          isCollected: false,
          collectedAt: null,
          collectionNotes: null,
        },
      })

      // If purchase was completed, revert to active
      if (installment.thirdPartyPurchase.status === 'completed') {
        await ctx.prisma.thirdPartyPurchase.update({
          where: { id: installment.thirdPartyPurchaseId },
          data: { status: 'active' },
        })
      }

      return { success: true }
    }),

  /**
   * Eliminar compra de tercero (anula el Transaction subyacente)
   */
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const purchase = await ctx.prisma.thirdPartyPurchase.findFirst({
        where: { id: input, userId: ctx.user.id },
      })

      if (!purchase) {
        throw new Error('Compra no encontrada')
      }

      // Void the underlying transaction
      await voidTransaction(purchase.transactionId)

      // Delete the third-party purchase (cascades to installments)
      await ctx.prisma.thirdPartyPurchase.delete({
        where: { id: input },
      })

      return { success: true }
    }),

  /**
   * Listar transacciones huérfanas (isForThirdParty=true sin ThirdPartyPurchase)
   */
  getPendingTransactions: protectedProcedure.query(async ({ ctx }) => {
    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        userId: ctx.user.id,
        isForThirdParty: true,
        isVoided: false,
        thirdPartyPurchase: null,
      },
      include: {
        card: { select: { id: true, name: true, bank: true, brand: true } },
      },
      orderBy: { purchaseDate: 'desc' },
    })

    return transactions.map((t) => ({
      id: t.id,
      description: t.description,
      totalAmount: Number(t.totalAmount),
      installments: t.installments,
      purchaseDate: t.purchaseDate,
      card: t.card,
      cardId: t.cardId,
    }))
  }),

  /**
   * Crear ThirdPartyPurchase a partir de transacción existente (huérfana)
   */
  createFromTransaction: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        personName: z.string().min(1),
        personId: z.string().optional(),
        currency: z.enum(['ARS', 'USD']).default('ARS'),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.prisma.transaction.findUnique({
        where: { id: input.transactionId },
        include: { thirdPartyPurchase: true },
      })

      if (!transaction || transaction.userId !== ctx.user.id) {
        throw new Error('Transacción no encontrada')
      }

      if (!transaction.isForThirdParty) {
        throw new Error('La transacción no está marcada como tercero')
      }

      if (transaction.thirdPartyPurchase) {
        throw new Error('La transacción ya tiene una compra de tercero asociada')
      }

      const installmentAmount = new Decimal(transaction.totalAmount.toString()).div(transaction.installments).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      const purchaseDate = transaction.purchaseDate

      // Fetch existing installments with billing cycle dueDates
      const existingInstallments = await ctx.prisma.installment.findMany({
        where: { transactionId: input.transactionId },
        include: { billingCycle: { select: { dueDate: true } } },
        orderBy: { installmentNumber: 'asc' },
      })

      const thirdPartyPurchase = await ctx.prisma.thirdPartyPurchase.create({
        data: {
          userId: ctx.user.id,
          description: transaction.description.replace(/^\[Tercero\] /, ''),
          personId: input.personId || null,
          personName: input.personName,
          cardId: transaction.cardId!,
          transactionId: transaction.id,
          totalAmount: transaction.totalAmount,
          installments: transaction.installments,
          installmentAmount,
          currency: input.currency,
          purchaseDate,
          notes: input.notes,
          collectionInstallments: {
            create: existingInstallments.map((inst) => ({
              number: inst.installmentNumber,
              amount: installmentAmount,
              dueDate: inst.billingCycle.dueDate,
            })),
          },
        },
        include: {
          collectionInstallments: true,
        },
      })

      return thirdPartyPurchase
    }),

  /**
   * Recalcular fechas de billing cycles y cuotas de terceros existentes.
   * Usar para corregir datos generados con el bug anterior.
   */
  recalculateDates: protectedProcedure.mutation(async ({ ctx }) => {
    const cyclesFixed = await recalculateBillingCycleDates(ctx.user.id)
    const installmentsFixed = await recalculateThirdPartyInstallmentDates(ctx.user.id)
    return { cyclesFixed, installmentsFixed }
  }),
})
