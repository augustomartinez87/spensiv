import { requireAdmin } from '@/lib/auth-guard'

export default async function PersonsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
