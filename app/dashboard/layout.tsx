import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { CreditCard, LayoutDashboard, Plus, Settings } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-bold text-xl">
              💳 Spensiv
            </Link>
            
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link 
                href="/dashboard/cards" 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
              >
                <CreditCard className="h-4 w-4" />
                Tarjetas
              </Link>
              <Link 
                href="/dashboard/transactions" 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
              >
                <Plus className="h-4 w-4" />
                Gastos
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {children}
      </main>
    </div>
  )
}
