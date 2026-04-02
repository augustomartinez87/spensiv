import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { del } from '@vercel/blob'
import { router, protectedProcedure } from '@/lib/trpc'

export const loanAttachmentsRouter = router({
  listAttachments: protectedProcedure
    .input(z.object({ loanId: z.string() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id },
        select: { id: true },
      })
      if (!loan) return []

      return ctx.prisma.loanAttachment.findMany({
        where: { loanId: input.loanId },
        orderBy: { createdAt: 'desc' },
      })
    }),

  createAttachment: protectedProcedure
    .input(
      z.object({
        loanId: z.string(),
        type: z.enum(['transfer_receipt', 'pagare', 'mutual', 'other']),
        fileName: z.string().min(1).max(255),
        fileUrl: z.string().url().refine(
          (url) => url.includes('.vercel-storage.com') || url.includes('.public.blob.vercel-storage.com'),
          'La URL debe ser de Vercel Blob'
        ),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findFirst({
        where: { id: input.loanId, userId: ctx.user.id },
        select: { id: true },
      })
      if (!loan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Préstamo no encontrado' })
      }

      return ctx.prisma.loanAttachment.create({
        data: {
          loanId: input.loanId,
          type: input.type,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
        },
      })
    }),

  deleteAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.prisma.loanAttachment.findFirst({
        where: {
          id: input.attachmentId,
          loan: { userId: ctx.user.id },
        },
      })
      if (!attachment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Archivo no encontrado' })
      }

      // Delete from Vercel Blob
      try {
        await del(attachment.fileUrl)
      } catch (err) {
        console.warn('Failed to delete blob:', err)
      }

      return ctx.prisma.loanAttachment.delete({
        where: { id: input.attachmentId },
      })
    }),
})
