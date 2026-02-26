import { z } from 'zod'
import { clerkClient } from '@clerk/nextjs/server'
import { adminProcedure, router } from '@/lib/trpc'

export const adminRouter = router({
  listUsers: adminProcedure.query(async () => {
    const clerk = await clerkClient()
    const { data: users } = await clerk.users.getUserList({ limit: 100, orderBy: '-created_at' })

    return users.map(u => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? '',
      fullName: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Sin nombre',
      imageUrl: u.imageUrl,
      role: ((u.publicMetadata as { role?: string })?.role) ?? 'viewer',
      createdAt: new Date(u.createdAt),
    }))
  }),

  updateRole: adminProcedure
    .input(
      z.object({
        targetUserId: z.string(),
        role: z.enum(['admin', 'viewer']),
      })
    )
    .mutation(async ({ input }) => {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(input.targetUserId, {
        publicMetadata: { role: input.role },
      })
      return { success: true }
    }),
})
