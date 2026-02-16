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
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

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
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border dark:border-border flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="text-cyan-500" />
                <path d="M12 7v10M9 9.5h4.5a2 2 0 010 4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-600 dark:text-cyan-400" />
                <path d="M16 5l2-2M18 7l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-teal-500" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-xl text-foreground">Spensiv</span>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Tu motor de cashflow</p>
            </div>
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-accent-foreground" : "text-muted-foreground")} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer: UserButton only */}
        <div className="p-4 border-t flex items-center justify-center">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-64">
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 items-center justify-end px-8 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30 gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </Button>
          <ThemeToggle />
        </header>

        {/* Mobile Header */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b bg-card sticky top-0 z-30">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="text-cyan-500" />
                <path d="M12 7v10M9 9.5h4.5a2 2 0 010 4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-600 dark:text-cyan-400" />
              </svg>
            </div>
            <span className="font-bold text-lg">Spensiv</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
            </Button>
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
