import { requireAdmin } from '@/lib/auth-guard'

export default async function PortfolioLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
