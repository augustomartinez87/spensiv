'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  FileUp,
  CreditCard as CardsIcon,
  ListOrdered,
  Receipt,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tarjetas', href: '/dashboard/cards', icon: CardsIcon },
  { name: 'Movimientos', href: '/dashboard/transactions', icon: ListOrdered },
  { name: 'Proyecciones', href: '/dashboard/projections', icon: TrendingUp },
  { name: 'Importar', href: '/dashboard/import', icon: FileUp },
]

const mobileNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Movimientos', href: '/dashboard/transactions', icon: Receipt },
  { name: 'Proyecciones', href: '/dashboard/projections', icon: TrendingUp },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 bg-card border-r flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b">
          <Link href="/dashboard" className="font-bold text-2xl flex items-center gap-2">
            <span className="text-primary">💳</span> Spensiv
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-accent-foreground" : "text-muted-foreground")} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer: ThemeToggle + UserButton */}
        <div className="p-4 border-t flex items-center justify-between">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-64">
        {/* Mobile Header */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b bg-card sticky top-0 z-30">
          <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2">
            <span>💳</span> Spensiv
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t h-16 flex items-center justify-around px-2">
        {mobileNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors min-w-[64px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
              {item.name}
            </Link>
          )
        })}
        <div className="flex flex-col items-center gap-1 px-3 py-1.5 min-w-[64px]">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-5 w-5",
              }
            }}
          />
          <span className="text-[10px] font-medium text-muted-foreground">Perfil</span>
        </div>
      </nav>
    </div>
  )
}
