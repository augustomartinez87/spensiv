'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc-client'
import { StatCard } from '@/components/dashboard/stat-card'
import { CompactProjection } from '@/components/dashboard/compact-projection'
import { MonthSelector } from '@/components/dashboard/month-selector'

const CategoryPieChart = dynamic(() => import('@/components/dashboard/category-pie-chart').then(m => m.CategoryPieChart), { ssr: false })
const ExpenseTypeChart = dynamic(() => import('@/components/dashboard/expense-type-chart').then(m => m.ExpenseTypeChart), { ssr: false })
const TransactionForm = dynamic(() => import('@/components/transactions/transaction-form').then(m => m.TransactionForm), { ssr: false })
const IncomeForm = dynamic(() => import('@/components/transactions/income-form').then(m => m.IncomeForm), { ssr: false })
const CardDetailModal = dynamic(() => import('@/components/cards/card-detail-modal').then(m => m.CardDetailModal), { ssr: false })
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, cn, getDaysUntilClosing } from '@/lib/utils'
import {
  Calendar,
  CreditCard,
  AlertCircle,
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
  Banknote,
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


export default function DashboardPage() {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const previousPeriod = getPreviousPeriod(period)

  const { data: balance, isLoading: isLoadingBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period })
  const { data: prevBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period: previousPeriod })
  const { data: cardBalances, isLoading: loadingCardBalances } = trpc.dashboard.getCardBalances.useQuery({ period })
  const { data: upcomingPayments, isLoading: loadingPayments } = trpc.dashboard.getUpcomingPayments.useQuery()
  const { data: loanMetrics } = trpc.loans.getDashboardMetrics.useQuery()

  const isLoading = isLoadingBalance || loadingCardBalances || loadingPayments

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
        <div className="grid gap-4 grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    )
  }

  if (!balance) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">No se pudo cargar el balance. Verificá tu conexión.</p>
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

  const nextPayments = groupedPayments?.slice(0, 4) || []
  const cardList = cardBalances?.cards || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Tu motor de cashflow personal</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector value={period} onChange={setPeriod} />
          <IncomeForm />
          <TransactionForm />
        </div>
      </div>

      {/* === ROW 1: Egresos | Ingresos | Proyección === */}
      <div className="grid gap-4 grid-cols-3">
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
        <CompactProjection
          balance={balance.balance}
          totalIncome={balance.totalIncome}
          totalExpense={balance.totalExpense}
        />
      </div>

      {/* === ROW 2: Tarjetas + Próximos Vencimientos === */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* Cards */}
        <Card>
          <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Tarjetas
            </CardTitle>
            <Link href="/dashboard/cards">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 pt-0">
            <div className="space-y-0.5">
              {cardList.map((card) => {
                const hasPeriodBalance = card.currentPeriodBalance > 0
                return (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-all duration-200 cursor-pointer group"
                  >
                    <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', getBankColor(card.bank || ''))}>
                      {getBankInitials(card.bank || card.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{card.name}</p>
                        {(() => {
                          const days = getDaysUntilClosing(card.closingDay)
                          if (days <= 7) {
                            return (
                              <span className={cn(
                                "text-[9px] font-medium px-1 py-0.5 rounded-full shrink-0",
                                days <= 3
                                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {days}d
                              </span>
                            )
                          }
                          return null
                        })()}
                        {card.thirdPartyAmount > 0 && (
                          <span className="text-[9px] font-medium px-1 py-0.5 rounded-full shrink-0 bg-purple-500/15 text-purple-600 dark:text-purple-400">
                            {formatCurrency(card.thirdPartyAmount)} terceros
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground">
                        {formatCurrency(hasPeriodBalance ? card.currentPeriodBalance : card.totalBalance)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {hasPeriodBalance
                          ? `${formatCurrency(card.totalBalance)} total`
                          : 'Deuda total'}
                      </p>
                    </div>
                  </div>
                )
              })}
              {cardList.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3 italic">Sin tarjetas registradas</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card>
          <CardHeader className="py-2.5 px-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Próximos Vencimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 pt-0">
            {nextPayments.length > 0 ? (
              <div className="space-y-0.5">
                {nextPayments.map((p) => {
                  const dueDate = new Date(p.dueDate)
                  const isOverdue = p.daysUntil < 0
                  return (
                    <div key={p.card.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-all duration-200">
                      <div className={cn(
                        "flex flex-col items-center justify-center h-9 w-9 rounded-lg shrink-0",
                        isOverdue ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"
                      )}>
                        <span className={cn(
                          "text-[8px] font-bold uppercase leading-none",
                          isOverdue ? "text-red-600 dark:text-red-400" : "text-red-500"
                        )}>
                          {format(dueDate, 'MMM', { locale: es })}
                        </span>
                        <span className="text-sm font-bold text-foreground leading-none">
                          {format(dueDate, 'd')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{p.card.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {isOverdue ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">VENCIDO</span>
                          ) : (
                            <>En {p.daysUntil} {p.daysUntil === 1 ? 'día' : 'días'}</>
                          )}
                        </p>
                      </div>
                      <p className={cn(
                        "text-xs font-bold shrink-0",
                        isOverdue ? "text-red-600 dark:text-red-400" : "text-foreground"
                      )}>{formatCurrency(p.amount)}</p>
                    </div>
                  )
                })}
                <Link href="/dashboard/projections" className="flex items-center justify-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors pt-1">
                  Ver Calendario <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-xs italic">
                No hay vencimientos próximos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === ROW 3: Category Pie + Expense Types === */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <CategoryPieChart
          data={balance.aggregations.expensesByCategory}
          title="Gastos por categoría"
        />
        <ExpenseTypeChart
          data={balance.aggregations.expensesByType}
          title="Tipos de gasto"
          previousData={prevBalance?.aggregations?.expensesByType}
        />
      </div>

      {/* === ROW 4: Recent Movements (Expenses + Income) === */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <RecentMovements
          installments={balance.installments}
          cashTransactions={balance.cashTransactions || []}
          incomes={balance.incomes}
          filter="expense"
        />
        <RecentMovements
          installments={balance.installments}
          cashTransactions={balance.cashTransactions || []}
          incomes={balance.incomes}
          filter="income"
        />
      </div>

      {/* === ROW 5: Préstamos Activos (full width) === */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Préstamos Activos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {loanMetrics && loanMetrics.activeLoansCount > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-muted rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Capital</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(loanMetrics.totalCapitalActive)}</p>
                </div>
                <div className="bg-muted rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Por Cobrar</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(loanMetrics.totalPending)}</p>
                </div>
                {loanMetrics.overdueCount > 0 && (
                  <div className="bg-red-500/10 rounded-lg p-2.5">
                    <p className="text-[10px] text-red-600 dark:text-red-400 uppercase font-medium">En mora</p>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(loanMetrics.overdueAmount)}</p>
                  </div>
                )}
              </div>
              {loanMetrics.upcomingInstallments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Próximas cuotas</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {loanMetrics.upcomingInstallments.slice(0, 4).map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between text-xs py-1 px-2">
                        <span className="text-foreground font-medium truncate">{inst.borrowerName}</span>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-bold">{formatCurrency(inst.amount, inst.currency)}</span>
                          <span className="text-muted-foreground ml-1.5">
                            {format(new Date(inst.dueDate), 'd MMM', { locale: es })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Link href="/dashboard/loans" className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-1">
                Ver Préstamos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground italic">Sin préstamos activos</p>
              <Link href="/dashboard/loans" className="text-xs text-primary hover:text-primary/80 mt-2 inline-block">
                Crear préstamo
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card Detail Modal */}
      <CardDetailModal
        cardId={selectedCardId}
        isOpen={!!selectedCardId}
        onClose={() => setSelectedCardId(null)}
      />
    </div>
  )
}

interface UnifiedMovement {
  id: string
  date: Date
  description: string
  category: string
  subcategory?: string
  expenseType?: string | null
  method: string
  amount: number
  type: 'expense' | 'income'
}

function RecentMovements({
  installments,
  cashTransactions,
  incomes,
  filter,
}: {
  installments: any[]
  cashTransactions: any[]
  incomes: any[]
  filter: 'expense' | 'income'
}) {
  const movements: UnifiedMovement[] = [
    ...installments.map((inst) => ({
      id: `inst-${inst.id}`,
      date: new Date(inst.transaction.purchaseDate),
      description: inst.transaction.installments > 1
        ? `${inst.transaction.description} (${inst.installmentNumber}/${inst.transaction.installments})`
        : inst.transaction.description,
      category: inst.transaction.category?.name || 'Sin categoría',
      subcategory: inst.transaction.category?.subcategories?.[0]?.name,
      expenseType: inst.transaction.expenseType,
      method: inst.transaction.card?.name || 'Tarjeta',
      amount: Number(inst.amount),
      type: 'expense' as const,
    })),
    ...cashTransactions.map((tx) => ({
      id: `cash-${tx.id}`,
      date: new Date(tx.purchaseDate),
      description: tx.description,
      category: tx.category?.name || 'Sin categoría',
      subcategory: tx.category?.subcategories?.[0]?.name,
      expenseType: tx.expenseType,
      method: tx.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia',
      amount: Number(tx.totalAmount),
      type: 'expense' as const,
    })),
    ...incomes.map((inc: any) => ({
      id: `inc-${inc.id}`,
      date: new Date(inc.date),
      description: inc.description,
      category: 'Ingresos',
      subcategory: inc.subcategory,
      method: inc.category === 'active_income' ? 'Sueldo' : 'Otro',
      amount: Number(inc.amount),
      type: 'income' as const,
    })),
  ]
    .filter((m) => m.type === filter)
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const display = movements.slice(0, 8)
  const subtitle = filter === 'expense' ? 'Egresos' : 'Ingresos'

  return (
    <Card>
      <CardHeader className="border-b py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Movimientos recientes</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <Link
            href="/dashboard/transactions"
            className="text-sm text-primary hover:underline font-medium"
          >
            Ver todo
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {display.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No hay {filter === 'expense' ? 'egresos' : 'ingresos'} en este periodo
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {display.map((m) => {
              const CatIcon = getCategoryIcon(m.category)
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-all duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                      filter === 'income' ? 'bg-green-500/10' : 'bg-muted'
                    )}>
                      <CatIcon className={cn('h-4 w-4', filter === 'income' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{m.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(m.date, 'd MMM', { locale: es })} &middot; {m.method}
                        {m.subcategory && ` · ${m.subcategory}`}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'font-semibold text-sm shrink-0 ml-2',
                      filter === 'income'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-foreground'
                    )}
                  >
                    {filter === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
