'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc-client'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { StatCard } from '@/components/dashboard/stat-card'
import { CompactProjection } from '@/components/dashboard/compact-projection'

const MonthlyEvolutionChart = dynamic(
  () => import('@/components/dashboard/monthly-evolution-chart').then((m) => m.MonthlyEvolutionChart),
  { ssr: false }
)
const TransactionForm = dynamic(
  () => import('@/components/transactions/transaction-form').then((m) => m.TransactionForm),
  { ssr: false }
)
const IncomeForm = dynamic(
  () => import('@/components/transactions/income-form').then((m) => m.IncomeForm),
  { ssr: false }
)

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, cn, formatExpenseType } from '@/lib/utils'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Star,
  Home,
  GraduationCap,
  ShoppingBag,
  Heart,
  Utensils,
  Car,
  Wifi,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'

// ── Helpers ──────────────────────────────────────────────────────────

function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
}

function getCategoryIcon(category: string) {
  const map: Record<string, typeof Star> = {
    Lujos: Star,
    'Gastos Fijos': Home,
    Educacion: GraduationCap,
    Educación: GraduationCap,
    Deudas: CreditCard,
    Compras: ShoppingBag,
    Salud: Heart,
    Comida: Utensils,
    Transporte: Car,
    Servicios: Wifi,
    Ingresos: DollarSign,
    'Ingresos Activos': DollarSign,
    'Ingresos Pasivos': DollarSign,
    'Otros Ingresos': DollarSign,
  }
  return map[category] || ShoppingBag
}

/** Compact currency display: $1.4M / $821k / $12.5k */
function formatHero(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return formatCurrency(value)
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  const previousPeriod = getPreviousPeriod(period)

  const { data: balance, isLoading: isLoadingBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period })
  const { data: prevBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period: previousPeriod })
  const { data: budgetProgress } = trpc.budget.getProgress.useQuery({ period })
  const { data: evolutionData } = trpc.dashboard.getEvolutionData.useQuery({ months: 6 })

  if (isLoadingBalance) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
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

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthSelector value={period} onChange={setPeriod} />
          <IncomeForm />
          <TransactionForm />
        </div>
      </div>

      {/* ── ROW 1: 3 hero cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Egresos del mes"
          value={balance.totalExpense}
          count={balance.installments.length + (balance.cashTransactions?.length || 0)}
          type="expense"
          previousValue={prevBalance?.totalExpense}
        />
        <StatCard
          title="Ingresos del mes"
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

      {/* ── ROW 2: Evolution chart (full width, no card border) ── */}
      {evolutionData && evolutionData.length > 1 && (
        <MonthlyEvolutionChart data={evolutionData} />
      )}

      {/* ── ROW 3: Donut + Movements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyHealthDonut
          income={balance.totalIncome}
          expense={balance.totalExpense}
          budgetProgress={budgetProgress ?? undefined}
        />
        <UnifiedRecentMovements
          installments={balance.installments}
          cashTransactions={balance.cashTransactions || []}
          incomes={balance.incomes}
        />
      </div>
    </div>
  )
}

// ── Monthly Health Donut ──────────────────────────────────────────────

interface BudgetItem {
  categoryId: string
  categoryName: string
  spent: number
  monthlyLimit: number
  percentage: number
}

function MonthlyHealthDonut({
  income,
  expense,
  budgetProgress,
}: {
  income: number
  expense: number
  budgetProgress?: BudgetItem[]
}) {
  const savingsRate = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0
  const spendRate = income > 0 ? Math.min(100, (expense / income) * 100) : 100

  const overBudgetCategories = budgetProgress?.filter((b) => b.percentage > 100) ?? []
  const hasOverBudget = overBudgetCategories.length > 0

  const conicGrad =
    income > 0
      ? `conic-gradient(#f97316 0% ${spendRate}%, #22c55e ${spendRate}% 100%)`
      : 'conic-gradient(#f97316 0% 100%)'

  return (
    <Card className="flex flex-col">
      <CardHeader className="py-2.5 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          Distribución del mes
          {hasOverBudget && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-4 flex flex-col flex-1">
        <div className="flex items-center gap-8 flex-1">
          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
            <div
              style={{
                width: 128,
                height: 128,
                borderRadius: '50%',
                background: conicGrad,
                WebkitMask: 'radial-gradient(transparent 50%, black 50%)',
                mask: 'radial-gradient(transparent 50%, black 50%)',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className={cn(
                  'text-2xl font-bold leading-tight',
                  savingsRate >= 20
                    ? 'text-green-400'
                    : savingsRate > 0
                      ? 'text-amber-400'
                      : 'text-red-400'
                )}
              >
                {income > 0 ? `${Math.round(savingsRate)}%` : '—'}
              </span>
              <span className="text-[9px] text-muted-foreground leading-tight">ahorro</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#f97316' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Gastado</p>
                <p className="text-sm font-bold text-foreground">{formatHero(expense)}</p>
              </div>
              <span className="text-xs font-semibold text-orange-400 shrink-0">
                {Math.round(spendRate)}%
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#22c55e' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">Ahorrado</p>
                <p className="text-sm font-bold text-foreground">
                  {formatHero(Math.max(0, income - expense))}
                </p>
              </div>
              <span
                className={cn(
                  'text-xs font-semibold shrink-0',
                  savingsRate >= 20 ? 'text-green-400' : 'text-amber-400'
                )}
              >
                {Math.round(savingsRate)}%
              </span>
            </div>
            {budgetProgress && budgetProgress.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                {hasOverBudget ? (
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-green-500/20 shrink-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {hasOverBudget ? (
                    <span className="text-amber-400">
                      {overBudgetCategories.length} categoría
                      {overBudgetCategories.length !== 1 ? 's' : ''} excedida
                      {overBudgetCategories.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    'Dentro del presupuesto'
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer link */}
        <div className="mt-4 pt-3 border-t border-border/40">
          <Link
            href="/dashboard/budget"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1 transition-colors"
          >
            Ver presupuesto <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Unified Recent Movements ──────────────────────────────────────────

interface UnifiedMovement {
  id: string
  date: Date
  description: string
  category: string
  expenseType?: string | null
  method: string
  amount: number
  type: 'expense' | 'income'
}

function UnifiedRecentMovements({
  installments,
  cashTransactions,
  incomes,
}: {
  installments: any[]
  cashTransactions: any[]
  incomes: any[]
}) {
  const [filter, setFilter] = useState<'both' | 'expense' | 'income'>('both')

  const allMovements: UnifiedMovement[] = [
    ...installments.map((inst) => ({
      id: `inst-${inst.id}`,
      date: new Date(inst.transaction.purchaseDate),
      description:
        inst.transaction.installments > 1
          ? `${inst.transaction.description} (${inst.installmentNumber}/${inst.transaction.installments})`
          : inst.transaction.description,
      category: inst.transaction.category?.name || 'Sin categoría',
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
      expenseType: tx.expenseType,
      method: tx.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia',
      amount: Number(tx.totalAmount),
      type: 'expense' as const,
    })),
    ...incomes.map((inc: any) => ({
      id: `inc-${inc.id}`,
      date: new Date(inc.date),
      description: inc.description,
      category: inc.category || 'Ingresos',
      expenseType: inc.subcategory || null,
      method: inc.subcategory || inc.category || 'Ingreso',
      amount: Number(inc.amount),
      type: 'income' as const,
    })),
  ]
    .filter((m) => filter === 'both' || m.type === filter)
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const display = allMovements.slice(0, 10)

  return (
    <Card>
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Movimientos recientes</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-md p-0.5">
              {(['both', 'expense', 'income'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
                    filter === f
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f === 'both' ? 'Ambos' : f === 'expense' ? 'Egresos' : 'Ingresos'}
                </button>
              ))}
            </div>
            <Link
              href="/dashboard/transactions"
              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
            >
              Ver todo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {display.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No hay{' '}
              {filter === 'expense' ? 'egresos' : filter === 'income' ? 'ingresos' : 'movimientos'}{' '}
              en este periodo
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {display.map((m) => {
              const CatIcon = getCategoryIcon(m.category)
              const isIncome = m.type === 'income'
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                        isIncome ? 'bg-green-500/10' : 'bg-muted'
                      )}
                    >
                      <CatIcon
                        className={cn(
                          'h-3.5 w-3.5',
                          isIncome ? 'text-green-400' : 'text-muted-foreground'
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate leading-tight">
                        {m.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(m.date, 'd MMM', { locale: es })}
                        {' · '}
                        {m.category}
                        {m.expenseType && ` · ${formatExpenseType(m.expenseType)}`}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'font-semibold text-sm shrink-0 ml-3 tabular-nums',
                      isIncome ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {isIncome ? '+' : '-'}
                    {formatCurrency(m.amount)}
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
