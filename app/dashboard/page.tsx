'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { StatCard } from '@/components/dashboard/stat-card'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { CategoryPieChart } from '@/components/dashboard/category-pie-chart'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { IncomeForm } from '@/components/transactions/income-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Calendar,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Search,
  Plus,
  Star,
  Home,
  GraduationCap,
  ShoppingBag,
  Heart,
  Utensils,
  Car,
  Wifi,
  DollarSign,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
}

function getBankColor(bank: string): string {
  const colors: Record<string, string> = {
    'CIUDAD': 'bg-blue-600',
    'GALICIA': 'bg-orange-500',
    'SANTANDER': 'bg-red-600',
    'BBVA': 'bg-blue-700',
    'MACRO': 'bg-indigo-600',
    'HSBC': 'bg-red-500',
    'ICBC': 'bg-red-700',
    'BRUBANK': 'bg-purple-600',
    'UALA': 'bg-blue-500',
    'MERCADOPAGO': 'bg-sky-500',
  }
  const key = bank.toUpperCase()
  for (const [k, v] of Object.entries(colors)) {
    if (key.includes(k)) return v
  }
  return 'bg-gray-500'
}

function getBankInitials(bank: string): string {
  return bank.slice(0, 2).toUpperCase()
}

function getCategoryIcon(category: string) {
  const map: Record<string, typeof Star> = {
    'Lujos': Star,
    'Gastos Fijos': Home,
    'Educacion': GraduationCap,
    'Educación': GraduationCap,
    'Deudas': CreditCard,
    'Compras': ShoppingBag,
    'Salud': Heart,
    'Comida': Utensils,
    'Transporte': Car,
    'Servicios': Wifi,
    'Ingresos': DollarSign,
  }
  return map[category] || ShoppingBag
}

function getCategoryBadgeColor(category: string): string {
  const map: Record<string, string> = {
    'Lujos': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Gastos Fijos': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Educacion': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Educación': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Deudas': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Compras': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    'Salud': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    'Comida': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'Transporte': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    'Servicios': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    'Ingresos': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  return map[category] || 'bg-muted text-muted-foreground'
}

export default function DashboardPage() {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [searchQuery, setSearchQuery] = useState('')

  const previousPeriod = getPreviousPeriod(period)

  const { data: balance, isLoading: isLoadingBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period })
  const { data: prevBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period: previousPeriod })
  const { data: totalDebt, isLoading: loadingDebt } = trpc.dashboard.getTotalDebt.useQuery()
  const { data: upcomingPayments, isLoading: loadingPayments } = trpc.dashboard.getUpcomingPayments.useQuery()

  const isLoading = isLoadingBalance || loadingDebt || loadingPayments

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    )
  }

  if (!balance) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">No se pudo cargar el balance. Verifica tu conexion.</p>
        </div>
      </div>
    )
  }

  const groupedPayments = upcomingPayments?.reduce((acc, p) => {
    const existing = acc.find(g => g.card.id === p.card.id)
    if (existing) {
      existing.amount += p.amount
      if (new Date(p.dueDate) < new Date(existing.dueDate)) {
        existing.dueDate = p.dueDate
        existing.daysUntil = p.daysUntil
      }
    } else {
      acc.push({ ...p })
    }
    return acc
  }, [] as NonNullable<typeof upcomingPayments>)

  const nextPayments = groupedPayments?.slice(0, 3) || []

  return (
    <div className="space-y-8">
      {/* Header with Title, Search, and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Tu motor de cashflow personal</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar movimientos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
          <IncomeForm />
          <TransactionForm />
        </div>
      </div>

      {/* Main Period Selector & Stats */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <MonthSelector value={period} onChange={setPeriod} />
          <div className="hidden sm:block text-right">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deuda Total</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalDebt?.amount || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Suma de todas las tarjetas</p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <StatCard
            title="Egresos del periodo"
            value={balance.totalExpense}
            count={balance.installments.length + (balance.cashTransactions?.length || 0)}
            type="expense"
            previousValue={prevBalance?.totalExpense}
          />
          <StatCard
            title="Ingresos del periodo"
            value={balance.totalIncome}
            count={balance.incomes.length}
            type="income"
            previousValue={prevBalance?.totalIncome}
          />
          <StatCard
            title="Balance neto"
            value={balance.balance}
            type="balance"
            previousValue={prevBalance?.balance}
          />
        </div>
      </div>

      {/* Secondary Metrics & Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Charts Section (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <CategoryPieChart
              data={balance.aggregations.expensesByCategory}
              title="Gastos por categoria"
            />
            <CategoryPieChart
              data={balance.aggregations.expensesByType}
              title="Tipos de gasto"
            />
          </div>

          {/* Recent Movements */}
          <RecentMovements
            installments={balance.installments}
            cashTransactions={balance.cashTransactions || []}
            incomes={balance.incomes}
            searchQuery={searchQuery}
          />
        </div>

        {/* Sidebar Info Section (1/3) */}
        <div className="space-y-6">
          {/* Cards List */}
          <Card>
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Tarjetas
              </CardTitle>
              <Link href="/dashboard/cards">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1">
                {groupedPayments?.map((p) => (
                  <div key={p.card.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-all duration-200">
                    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', getBankColor(p.card.bank || ''))}>
                      {getBankInitials(p.card.bank || p.card.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.card.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(p.card as any).brand ? (p.card as any).brand.charAt(0).toUpperCase() + (p.card as any).brand.slice(1) : 'Tarjeta'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(p.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">Balance</p>
                    </div>
                  </div>
                ))}
                {!groupedPayments?.length && (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">Sin deudas activas</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Payments */}
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Proximos Vencimientos
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {nextPayments.length > 0 ? (
                <div className="space-y-2">
                  {nextPayments.map((p, i) => {
                    const dueDate = new Date(p.dueDate)
                    return (
                      <div key={p.card.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-all duration-200">
                        <div className="flex flex-col items-center justify-center h-11 w-11 rounded-xl bg-muted shrink-0">
                          <span className="text-[9px] font-bold text-red-500 uppercase leading-none">
                            {format(dueDate, 'MMM', { locale: es })}
                          </span>
                          <span className="text-lg font-bold text-foreground leading-none">
                            {format(dueDate, 'd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.card.name}</p>
                          <p className="text-xs text-muted-foreground">
                            En {p.daysUntil} {p.daysUntil === 1 ? 'dia' : 'dias'}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(p.amount)}</p>
                      </div>
                    )
                  })}
                  <Link href="/dashboard/projections" className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-2">
                    Ver Calendario <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm italic">
                  No hay vencimientos proximos
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Projection */}
          <Card className="overflow-hidden bg-gradient-to-br from-emerald-900/80 to-emerald-700/60 dark:from-emerald-950 dark:to-emerald-800/50 border-emerald-700/30">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-emerald-200/80 uppercase tracking-wider">Proyeccion Mensual</p>
              <p className="text-[10px] text-emerald-300/60 mt-0.5">Estimado al cierre del mes</p>
              <p className="text-3xl font-bold text-white mt-3 tracking-tight">
                {formatCurrency(balance.balance)}
              </p>
              <p className="text-xs text-emerald-200/70 mt-2">
                {balance.balance >= 0 ? 'Vas por buen camino' : 'Revisa tus gastos'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

interface UnifiedMovement {
  id: string
  date: Date
  description: string
  category: string
  method: string
  amount: number
  type: 'expense' | 'income'
}

function RecentMovements({
  installments,
  cashTransactions,
  incomes,
  searchQuery,
}: {
  installments: any[]
  cashTransactions: any[]
  incomes: any[]
  searchQuery: string
}) {
  const movements: UnifiedMovement[] = [
    ...installments.map((inst) => ({
      id: `inst-${inst.id}`,
      date: new Date(inst.transaction.purchaseDate),
      description: inst.transaction.installments > 1
        ? `${inst.transaction.description} (${inst.installmentNumber}/${inst.transaction.installments})`
        : inst.transaction.description,
      category: inst.transaction.category?.name || 'Sin categoria',
      method: inst.transaction.card?.name || 'Tarjeta',
      amount: Number(inst.amount),
      type: 'expense' as const,
    })),
    ...cashTransactions.map((tx) => ({
      id: `cash-${tx.id}`,
      date: new Date(tx.purchaseDate),
      description: tx.description,
      category: tx.category?.name || 'Sin categoria',
      method: tx.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia',
      amount: Number(tx.totalAmount),
      type: 'expense' as const,
    })),
    ...incomes.map((inc: any) => ({
      id: `inc-${inc.id}`,
      date: new Date(inc.date),
      description: inc.description,
      category: 'Ingresos',
      method: inc.category === 'active_income' ? 'Sueldo' : 'Otro',
      amount: Number(inc.amount),
      type: 'income' as const,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const filtered = searchQuery
    ? movements.filter(m =>
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.method.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : movements

  const display = filtered.slice(0, 5)

  return (
    <Card>
      <CardHeader className="border-b py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Movimientos recientes</CardTitle>
        <Link
          href="/dashboard/transactions"
          className="text-sm text-primary hover:underline font-medium"
        >
          Ver todo
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {display.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              {searchQuery ? 'Sin resultados para tu busqueda' : 'No hay actividad registrada en este periodo'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Descripcion</th>
                    <th className="text-left px-4 py-3 font-medium">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium">Metodo</th>
                    <th className="text-right px-4 py-3 font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {display.map((m) => {
                    const CatIcon = getCategoryIcon(m.category)
                    return (
                      <tr key={m.id} className="hover:bg-accent/50 transition-all duration-200">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {format(m.date, 'd MMM, yyyy', { locale: es })}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{m.description}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            getCategoryBadgeColor(m.category)
                          )}>
                            <CatIcon className="h-3 w-3" />
                            {m.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.method}</td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-semibold whitespace-nowrap',
                            m.type === 'income'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-foreground'
                          )}
                        >
                          {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact List */}
            <div className="md:hidden divide-y divide-border">
              {display.map((m) => {
                const CatIcon = getCategoryIcon(m.category)
                return (
                  <div key={m.id} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                        m.type === 'income' ? 'bg-green-500/10' : 'bg-muted'
                      )}>
                        <CatIcon className={cn('h-4 w-4', m.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{m.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(m.date, 'd MMM', { locale: es })} &middot; {m.method}
                        </p>
                      </div>
                    </div>
                    <p
                      className={cn(
                        'font-semibold text-sm',
                        m.type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-foreground'
                      )}
                    >
                      {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
