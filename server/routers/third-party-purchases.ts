import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { createTransactionWithInstallments, voidTransaction } from '@/lib/installment-engine'
import { Decimal } from '@prisma/client/runtime/library'

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
        firstDueDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const purchaseDate = new Date(input.purchaseDate)
      const installmentAmount = input.totalAmount / input.installments

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
      })

      // 2. Create ThirdPartyPurchase for collection tracking
      const firstDueDate = input.firstDueDate ? new Date(input.firstDueDate) : null

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
          installmentAmount: new Decimal(installmentAmount),
          currency: input.currency,
          purchaseDate,
          firstDueDate,
          notes: input.notes,
          collectionInstallments: {
            create: Array.from({ length: input.installments }, (_, i) => {
              const dueDate = new Date(firstDueDate || purchaseDate)
              dueDate.setMonth(dueDate.getMonth() + i)
              return {
                number: i + 1,
                amount: new Decimal(installmentAmount),
                dueDate,
              }
            }),
          },
        },
        include: {
          collectionInstallments: true,
        },
      })

      return thirdPartyPurchase
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
      const where: any = { userId: ctx.user.id }
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

      return purchases.map((p) => {
        const collected = p.collectionInstallments.filter((i) => i.isCollected).length
        const collectedAmount = p.collectionInstallments
          .filter((i) => i.isCollected)
          .reduce((sum, i) => sum + Number(i.amount), 0)

        return {
          ...p,
          totalAmount: Number(p.totalAmount),
          installmentAmount: Number(p.installmentAmount),
          collectedCount: collected,
          collectedAmount,
          pendingCount: p.installments - collected,
          pendingAmount: Number(p.totalAmount) - collectedAmount,
          collectionInstallments: p.collectionInstallments.map((i) => ({
            ...i,
            amount: Number(i.amount),
          })),
        }
      })
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

      const collected = purchase.collectionInstallments.filter((i) => i.isCollected).length
      const collectedAmount = purchase.collectionInstallments
        .filter((i) => i.isCollected)
        .reduce((sum, i) => sum + Number(i.amount), 0)

      return {
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        installmentAmount: Number(purchase.installmentAmount),
        collectedCount: collected,
        collectedAmount,
        pendingCount: purchase.installments - collected,
        pendingAmount: Number(purchase.totalAmount) - collectedAmount,
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
   * Resumen de terceros por tarjeta
   */
  getSummaryByCard: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const purchases = await ctx.prisma.thirdPartyPurchase.findMany({
        where: {
          userId: ctx.user.id,
          cardId: input,
          status: 'active',
        },
        include: {
          collectionInstallments: true,
        },
      })

      const totalAmount = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0)
      const collectedAmount = purchases.reduce((sum, p) => {
        return sum + p.collectionInstallments
          .filter((i) => i.isCollected)
          .reduce((s, i) => s + Number(i.amount), 0)
      }, 0)

      return {
        count: purchases.length,
        totalAmount,
        collectedAmount,
        pendingAmount: totalAmount - collectedAmount,
      }
    }),
})
