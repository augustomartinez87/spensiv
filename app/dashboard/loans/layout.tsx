import { requireAdmin } from '@/lib/auth-guard'

export default async function LoansLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
