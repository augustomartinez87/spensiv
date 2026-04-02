'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
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
  Users,
  PieChart,
  Target,
  Eye,
  EyeOff,
  Percent,
  ShieldCheck,
  HandCoins,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PrivacyProvider, usePrivacy } from '@/lib/contexts/privacy-context'
import { CurrencyProvider } from '@/lib/contexts/currency-context'

const TransactionForm = dynamic(
  () => import('@/components/transactions/transaction-form').then((m) => m.TransactionForm),
  { ssr: false }
)

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard }
type NavSection = { label: string; items: NavItem[]; adminOnly?: boolean }

const navigation: NavSection[] = [
  {
    label: 'Inicio',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { name: 'Movimientos', href: '/dashboard/transactions', icon: ListOrdered },
      { name: 'Presupuesto', href: '/dashboard/budget', icon: Target },
      { name: 'Tarjetas & Cuotas', href: '/dashboard/cards', icon: CardsIcon },
      { name: 'Cuotas', href: '/dashboard/installments', icon: Layers },
      { name: 'Cuotas de Terceros', href: '/dashboard/third-party', icon: HandCoins },
      { name: 'Proyecciones', href: '/dashboard/projections', icon: TrendingUp },
    ],
  },
  {
    label: 'Préstamos',
    adminOnly: true,
    items: [
      { name: 'Cartera', href: '/dashboard/portfolio', icon: PieChart },
      { name: 'Préstamos', href: '/dashboard/loans', icon: Banknote },
      { name: 'Personas', href: '/dashboard/persons', icon: Users },
      { name: 'Simulador', href: '/dashboard/simulator', icon: Calculator },
      { name: 'Reglas de Tasas', href: '/dashboard/rate-rules', icon: Percent },
    ],
  },
  {
    label: 'Administración',
    adminOnly: true,
    items: [
      { name: 'Usuarios', href: '/dashboard/admin', icon: ShieldCheck },
    ],
  },
]

const mobileNavBase = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Simulador', href: '/dashboard/simulator', icon: Calculator },
]

const mobileNavAdmin = [
  { name: 'Préstamos', href: '/dashboard/loans', icon: Banknote },
  { name: 'Personas', href: '/dashboard/persons', icon: Users },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PrivacyProvider>
      <CurrencyProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </CurrencyProvider>
    </PrivacyProvider>
  )
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user } = useUser()
  const { isPrivate, togglePrivacy } = usePrivacy()

  const displayName = user?.fullName || user?.firstName || 'Usuario'
  const userIsAdmin = user?.publicMetadata?.role === 'admin'

  // Ctrl+B keyboard shortcut to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const visibleNavigation = navigation.filter(s => !s.adminOnly || userIsAdmin)
  const mobileNav = userIsAdmin
    ? [...mobileNavBase, ...mobileNavAdmin]
    : mobileNavBase

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
              <span className="font-bold text-lg text-white tracking-tight">Spensiv</span>
            )}
          </Link>
        </div>

        {/* Nav Links */}
        <nav className={cn("flex-1 py-4 overflow-y-auto transition-all duration-300", sidebarCollapsed ? "px-2" : "px-3")}>
          {visibleNavigation.map((section, sectionIdx) => (
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9", isPrivate ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              onClick={togglePrivacy}
              title={isPrivate ? 'Mostrar montos' : 'Ocultar montos'}
            >
              {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
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
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9", isPrivate ? "text-primary" : "text-muted-foreground")}
              onClick={togglePrivacy}
              title={isPrivate ? 'Mostrar montos' : 'Ocultar montos'}
            >
              {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
              <Bell className="h-4 w-4" />
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile FAB — Nuevo Gasto */}
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        <TransactionForm
          size="icon"
          triggerText=""
          className="h-14 w-14 rounded-full shadow-xl bg-rose-500 hover:bg-rose-600 text-white border-0 [&>svg]:mr-0"
        />
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
