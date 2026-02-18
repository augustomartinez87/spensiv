'use client'

import { useState } from 'react'
import { UserButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard as CardsIcon,
  ListOrdered,
  Receipt,
  Calculator,
  Banknote,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Users,
  PieChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard }
type NavSection = { label: string; items: NavItem[] }

const navigation: NavSection[] = [
  {
    label: 'General',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { name: 'Tarjetas', href: '/dashboard/cards', icon: CardsIcon },
      { name: 'Movimientos', href: '/dashboard/transactions', icon: ListOrdered },
      { name: 'Proyecciones', href: '/dashboard/projections', icon: TrendingUp },
    ],
  },
  {
    label: 'Prestamos',
    items: [
      { name: 'Prestamos', href: '/dashboard/loans', icon: Banknote },
      { name: 'Personas', href: '/dashboard/persons', icon: Users },
      { name: 'Cartera', href: '/dashboard/portfolio', icon: PieChart },
      { name: 'Simulador', href: '/dashboard/simulator', icon: Calculator },
    ],
  },
]

const mobileNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Movimientos', href: '/dashboard/transactions', icon: Receipt },
  { name: 'Prestamos', href: '/dashboard/loans', icon: Banknote },
  { name: 'Cartera', href: '/dashboard/portfolio', icon: PieChart },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user } = useUser()

  const displayName = user?.fullName || user?.firstName || 'Usuario'

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex fixed inset-y-0 left-0 z-40 flex-col transition-all duration-300",
        "bg-[hsl(var(--sidebar))] border-r border-white/[0.06]",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn("h-16 flex items-center transition-all duration-300", sidebarCollapsed ? "px-3 justify-center" : "px-5")}>
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[hsl(var(--sidebar-active))]/15 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="text-[hsl(var(--sidebar-active))]" />
                <path d="M12 7v10M9 9.5h4.5a2 2 0 010 4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[hsl(var(--sidebar-active))]" />
                <path d="M16 5l2-2M18 7l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-teal-400" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div>
                <span className="font-bold text-lg text-white tracking-tight">Spensiv</span>
                <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] leading-none mt-0.5">Personal Premium</p>
              </div>
            )}
          </Link>
        </div>

        {/* Nav Links */}
        <nav className={cn("flex-1 py-4 overflow-y-auto transition-all duration-300", sidebarCollapsed ? "px-2" : "px-3")}>
          {navigation.map((section, sectionIdx) => (
            <div key={section.label} className={cn(sectionIdx > 0 && "mt-5")}>
              {!sidebarCollapsed && (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]/50">
                  {section.label}
                </p>
              )}
              {sidebarCollapsed && sectionIdx > 0 && (
                <div className="mx-auto mb-2 w-6 border-t border-white/[0.08]" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={cn(
                        "flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
                        sidebarCollapsed ? "px-0 justify-center" : "px-3",
                        isActive
                          ? "text-white bg-white/[0.08]"
                          : "text-[hsl(var(--sidebar-foreground))] hover:text-white hover:bg-white/[0.04]"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[hsl(var(--sidebar-active))]" />
                      )}
                      <item.icon className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        isActive ? "text-[hsl(var(--sidebar-active))]" : "text-[hsl(var(--sidebar-foreground))]"
                      )} />
                      {!sidebarCollapsed && item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Premium Plan Card */}
        {!sidebarCollapsed && (
          <div className="px-3 pb-3">
            <div className="rounded-xl bg-gradient-to-br from-[#1F1F1F] to-[#171717] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Premium Plan</span>
              </div>
              <p className="text-[11px] text-[hsl(var(--sidebar-foreground))] leading-relaxed mb-3">
                Unlock advanced analytics and projection tools.
              </p>
              <button className="w-full py-2 rounded-lg bg-[#128DDA] hover:bg-[#056FE0] text-white text-xs font-semibold transition-colors">
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* User Profile Section */}
        <div className={cn(
          "border-t border-white/[0.06] transition-all duration-300",
          sidebarCollapsed ? "p-2 flex justify-center" : "p-3"
        )}>
          {sidebarCollapsed ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <div className="flex items-center gap-3 px-1">
              <UserButton afterSignOutUrl="/" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <Link href="/dashboard" className="flex items-center gap-1 text-[10px] text-[hsl(var(--sidebar-foreground))] hover:text-white transition-colors">
                  <Settings className="h-2.5 w-2.5" />
                  Settings
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Content Area */}
      <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300", sidebarCollapsed ? "md:ml-16" : "md:ml-64")}>
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 items-center justify-between px-8 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border/50 bg-background sticky top-0 z-30">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[hsl(var(--sidebar-active))]/15 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="text-[hsl(var(--sidebar-active))]" />
                <path d="M12 7v10M9 9.5h4.5a2 2 0 010 4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[hsl(var(--sidebar-active))]" />
              </svg>
            </div>
            <span className="font-bold text-lg text-foreground">Spensiv</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
              <Bell className="h-4 w-4" />
            </Button>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[hsl(var(--sidebar))] border-t border-white/[0.06] h-16 flex items-center justify-around px-2">
        {mobileNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors min-w-[64px]",
                isActive
                  ? "text-[hsl(var(--sidebar-active))]"
                  : "text-[hsl(var(--sidebar-foreground))]"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-[hsl(var(--sidebar-active))]" : "text-[hsl(var(--sidebar-foreground))]")} />
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
          <span className="text-[10px] font-medium text-[hsl(var(--sidebar-foreground))]">Perfil</span>
        </div>
      </nav>
    </div>
  )
}
