import { requireAdmin } from '@/lib/auth-guard'

export default async function RiskLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
