'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/contexts/trpc-client'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { StatCard } from '@/components/dashboard/stat-card'
import { CompactProjection } from '@/components/dashboard/compact-projection'
import { InsightBanner } from '@/components/dashboard/insight-banner'

const MonthlyEvolutionChart = dynamic(
  () => import('@/components/dashboard/monthly-evolution-chart').then((m) => m.MonthlyEvolutionChart),
  { ssr: false }
)
const CategoryDonutChart = dynamic(
  () => import('@/components/dashboard/category-donut-chart').then((m) => m.CategoryDonutChart),
  { ssr: false }
)
const LoansWidget = dynamic(
  () => import('@/components/dashboard/loans-widget').then((m) => m.LoansWidget),
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
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, cn } from '@/lib/utils'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { useCurrency } from '@/lib/contexts/currency-context'
import {
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { getCategoryIconInfo } from '@/lib/categories/category-icons'
import Link from 'next/link'

// ── Helpers ──────────────────────────────────────────────────────────

function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
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
  const { mode, setMode, mepRate, setMepRate, convert, symbol } = useCurrency()

  const { data: balance, isLoading: isLoadingBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period })
  const { data: evolutionData } = trpc.dashboard.getEvolutionData.useQuery({ months: 6 })
  const { data: mepData } = trpc.dashboard.getMepRate.useQuery()

  // Derive previous period data from evolution instead of a separate query
  const prevBalance = evolutionData?.find((d) => d.period === previousPeriod)

  useEffect(() => {
    if (mepData?.rate) setMepRate(mepData.rate)
  }, [mepData?.rate, setMepRate])

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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

  // ── Métricas derivadas para hero cards ──────────────────────────────
  const [periodYear, periodMonth] = period.split('-').map(Number)
  const daysElapsed =
    period === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      ? now.getDate()
      : new Date(periodYear, periodMonth, 0).getDate()
  const dailyExpenseAverage = daysElapsed > 0 ? balance.totalExpense / daysElapsed : 0


  const lastIncome = balance.incomes.length > 0 ? balance.incomes[0] : null
  const nextIncomeEstimate = lastIncome
    ? (() => {
        const lastDate = new Date(lastIncome.date)
        const nextDate = new Date(lastDate)
        nextDate.setMonth(nextDate.getMonth() + 1)
        return format(nextDate, 'd MMM', { locale: es })
      })()
    : undefined

  const expenseSparkline = evolutionData?.map((d) => d.expense) ?? []
  const incomeSparkline = evolutionData?.map((d) => d.income) ?? []

  const isCurrentPeriod =
    period === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const daysInMonth = new Date(periodYear, periodMonth, 0).getDate()
  const daysRemaining = daysInMonth - now.getDate()
  const expenseVariation =
    prevBalance && prevBalance.expense > 0
      ? ((balance.totalExpense - prevBalance.expense) / prevBalance.expense) * 100
      : null

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthSelector value={period} onChange={setPeriod} />
          <SegmentedControl
            options={[
              { value: 'ARS', label: '$ ARS' },
              { value: 'USD', label: 'US$ USD' },
            ]}
            value={mode}
            onValueChange={setMode}
            variant="primary"
            size="sm"
          />
          {mepRate && (
            <span className="text-xs text-muted-foreground tabular-nums">
              MEP {formatCurrency(mepRate)}
            </span>
          )}
          <IncomeForm variant="outline" />
          <TransactionForm />
        </div>
      </div>

      {/* ── HERO CARD: Balance Neto del Mes ── */}
      {(() => {
        const netBalance = convert(balance.balance)
        const totalInc = convert(balance.totalIncome)
        const totalExp = convert(balance.totalExpense)
        const expPct = totalInc > 0 ? Math.min((totalExp / totalInc) * 100, 100) : 0
        const isNet = netBalance >= 0
        return (
          <div className={cn(
            'rounded-xl border p-5',
            isNet
              ? 'bg-gradient-to-r from-green-950/40 to-transparent border-green-800/30'
              : 'bg-gradient-to-r from-red-950/40 to-transparent border-red-800/30'
          )}>
            <p className="text-sm text-muted-foreground">Balance Neto del Mes</p>
            <PrivateAmount>
              <p className={cn(
                'text-4xl font-bold tracking-tight tabular-nums mt-1',
                isNet ? 'text-green-400' : 'text-red-400'
              )}>
                {isNet ? '' : '-'}${Math.abs(netBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </PrivateAmount>
            <p className="text-xs text-muted-foreground mt-1">
              {isCurrentPeriod ? `${daysRemaining} días restantes` : 'Período cerrado'}
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Gastos</span>
                <span>{expPct.toFixed(0)}% de ingresos</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    expPct > 90 ? 'bg-red-500' : expPct > 70 ? 'bg-amber-500' : 'bg-green-500'
                  )}
                  style={{ width: `${expPct}%` }}
                />
              </div>
            </div>
            {isNet && totalInc > 0 && (
              <PrivateAmount>
                <p className="text-green-400 text-sm mt-2">
                  Podrías ahorrar {formatCurrency(netBalance)} este mes
                </p>
              </PrivateAmount>
            )}
          </div>
        )
      })()}

      {/* ── ROW 1: KPI cards (2×2 on mobile, 3 in a row on lg) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Egresos del mes"
          value={convert(balance.totalExpense)}
          count={balance.installments.length + (balance.cashTransactions?.length || 0)}
          type="expense"
          previousValue={prevBalance ? convert(prevBalance.expense) : undefined}
          dailyAverage={convert(dailyExpenseAverage)}
          sparklineData={expenseSparkline}
        />
        <StatCard
          title="Ingresos del mes"
          value={convert(balance.totalIncome)}
          count={balance.incomes.length}
          type="income"
          previousValue={prevBalance ? convert(prevBalance.income) : undefined}
          nextEstimatedDate={nextIncomeEstimate}
          sparklineData={incomeSparkline}
        />
        <div className="col-span-2 lg:col-span-1">
          <CompactProjection
            balance={convert(balance.balance)}
            totalIncome={convert(balance.totalIncome)}
            totalExpense={convert(balance.totalExpense)}
          />
        </div>
      </div>

      {/* ── InsightBanner (solo mes actual) ── */}
      {isCurrentPeriod && (
        <InsightBanner
          expenseVariation={expenseVariation}
          balance={convert(balance.balance)}
          daysRemaining={daysRemaining}
        />
      )}

      {/* ── ROW 2: Evolución + Donuts side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="overflow-hidden lg:col-span-3 flex flex-col">
          {evolutionData && evolutionData.length > 1 ? (
            <MonthlyEvolutionChart data={evolutionData} />
          ) : (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground italic">
              Sin suficientes datos para el gráfico
            </div>
          )}
        </Card>
        <div className="lg:col-span-2 grid grid-cols-1 gap-4">
          <CategoryDonut
            title="A dónde va la plata"
            data={balance.aggregations.expensesByCategory}
            total={balance.totalExpense}
            emptyMessage="Sin egresos registrados"
            convert={convert}
          />
          <CategoryDonut
            title="De dónde viene la plata"
            data={balance.aggregations.incomesByCategory}
            total={balance.totalIncome}
            emptyMessage="Sin ingresos registrados"
            convert={convert}
          />
        </div>
      </div>

      {/* ── ROW 3: Préstamos + Movimientos recientes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <LoansWidget />
        </div>
        <div className="lg:col-span-3">
          <UnifiedRecentMovements
            installments={balance.installments}
            cashTransactions={balance.cashTransactions || []}
            incomes={balance.incomes}
          />
        </div>
      </div>
    </div>
  )
}

// ── Category Donut Wrapper ───────────────────────────────────────────

const DONUT_COLORS: Record<string, string> = {
  'Gastos Fijos': '#22c55e',
  Servicios: '#2a89bf',
  Transporte: '#348bb5',
  Educacion: '#a855f7',
  'Educación': '#a855f7',
  Salud: '#feb92e',
  Comida: '#e8a820',
  Compras: '#f0953a',
  Deudas: '#f97316',
  Lujos: '#f43f5e',
  Inversiones: '#06b6d4',
  'Ingresos Activos': '#22c55e',
  'Ingresos Pasivos': '#10b981',
  'Otros Ingresos': '#3b82f6',
  Ingresos: '#22c55e',
}
const FALLBACK_COLORS = ['#1f6c9c', '#feb92e', '#e54352', '#2a89bf', '#e8a820', '#f0953a', '#348bb5']

function CategoryDonut({
  title,
  data,
  total,
  emptyMessage,
  convert,
}: {
  title: string
  data: Record<string, number>
  total: number
  emptyMessage: string
  convert: (v: number) => number
}) {
  const MAX_SHOW = 6

  const sorted = Object.entries(data)
    .map(([name, amount], i) => ({
      name,
      value: convert(amount),
      color: DONUT_COLORS[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)

  const top = sorted.slice(0, MAX_SHOW)
  const rest = sorted.slice(MAX_SHOW)
  if (rest.length > 0) {
    const othersAmount = rest.reduce((s, c) => s + c.value, 0)
    top.push({ name: 'Otros', value: othersAmount, color: '#6b7280' })
  }

  return (
    <Card className="flex flex-col h-full min-h-[200px]">
      <CardHeader className="py-2.5 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-4 flex flex-col flex-1">
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            {emptyMessage}
          </p>
        ) : (
          <CategoryDonutChart data={top} total={convert(total)} formatHero={formatHero} />
        )}
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
  const { convert } = useCurrency()

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
            <SegmentedControl
              options={[
                { value: 'both', label: 'Ambos' },
                { value: 'expense', label: 'Egresos' },
                { value: 'income', label: 'Ingresos' },
              ]}
              value={filter}
              onValueChange={setFilter}
              size="sm"
            />
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
          <div className="divide-y divide-border/50">
            {display.map((m) => {
              const catInfo = getCategoryIconInfo(m.category)
              const CatIcon = catInfo.icon
              const isIncome = m.type === 'income'
              return (
                <div
                  key={m.id}
                  className="group flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-default"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `${catInfo.color}10`,
                        borderColor: `${catInfo.color}25`,
                      }}
                    >
                      <CatIcon
                        className="h-4 w-4"
                        style={{ color: catInfo.color }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground truncate leading-tight group-hover:text-foreground/90">
                          {m.description}
                        </p>
                        <span
                          className="text-xs rounded-full px-2 py-0.5 shrink-0"
                          style={{
                            backgroundColor: `${catInfo.color}20`,
                            color: catInfo.color,
                          }}
                        >
                          {m.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(m.date, 'd MMM', { locale: es })}
                        {' · '}
                        {m.method}
                      </p>
                    </div>
                  </div>
                  <PrivateAmount>
                    <p
                      className={cn(
                        'font-semibold text-sm shrink-0 ml-3 tabular-nums tracking-tight',
                        isIncome ? 'text-accent-positive' : 'text-accent-danger'
                      )}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(convert(m.amount))}
                    </p>
                  </PrivateAmount>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
