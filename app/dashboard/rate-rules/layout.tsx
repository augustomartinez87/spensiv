import { requireAdmin } from '@/lib/auth-guard'

export default async function RateRulesLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
