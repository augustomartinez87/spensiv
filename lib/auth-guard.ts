import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export async function requireAdmin() {
  const user = await currentUser()
  if (user?.publicMetadata?.role !== 'admin') {
    redirect('/dashboard')
  }
}
