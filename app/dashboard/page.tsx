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
import { getPaymentMethodLabelWithCard } from '@/lib/transaction-utils'
import type { BalanceViewMode } from '@/lib/balance'
import {
  AlertCircle,
  ArrowRight,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  CreditCard as CreditCardIcon,
  ArrowLeftRight,
  Banknote,
} from 'lucide-react'
import { getCategoryIconInfo } from '@/lib/categories/category-icons'
import { getCategoryBadgeClass, CATEGORY_DONUT_COLORS, CATEGORY_FALLBACK_COLORS } from '@/lib/ui/category-colors'
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
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [period, setPeriod] = useState(currentPeriod)
  const [viewMode, setViewMode] = useState<BalanceViewMode>('financial')

  const previousPeriod = getPreviousPeriod(period)
  const { mode, setMode, mepRate, setMepRate, convert, symbol } = useCurrency()

  const { data: balance, isLoading: isLoadingBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period, viewMode })
  const { data: evolutionData } = trpc.dashboard.getEvolutionData.useQuery({ months: 6, viewMode })
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
    period === currentPeriod
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

  const isCurrentPeriod = period === currentPeriod
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
              { value: 'financial', label: 'Financiero' },
              { value: 'economic', label: 'Económico' },
            ]}
            value={viewMode}
            onValueChange={(v) => setViewMode(v as BalanceViewMode)}
            size="sm"
          />
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

      {/* ── ROW 1: 4 KPI cards (2×2 on mobile, 4 in a row on lg) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Egresos del mes"
          value={convert(balance.totalExpense)}
          count={balance.installments.length + (balance.cashTransactions?.length || 0)}
          type="expense"
          previousValue={prevBalance ? convert(prevBalance.expense) : undefined}
          dailyAverage={convert(dailyExpenseAverage)}
          sparklineData={expenseSparkline}
          accentBorder="border-l-red-500"
        />
        <StatCard
          title="Ingresos del mes"
          value={convert(balance.totalIncome)}
          count={balance.incomes.length}
          type="income"
          previousValue={prevBalance ? convert(prevBalance.income) : undefined}
          nextEstimatedDate={nextIncomeEstimate}
          sparklineData={incomeSparkline}
          accentBorder="border-l-emerald-500"
        />
        <CompactProjection
          balance={convert(balance.balance)}
          totalIncome={convert(balance.totalIncome)}
          totalExpense={convert(balance.totalExpense)}
          accentBorder="border-l-amber-500"
        />
        {/* Tasa de ahorro */}
        {(() => {
          const totalInc = convert(balance.totalIncome)
          const totalExp = convert(balance.totalExpense)
          const savingsRate = totalInc > 0 ? (1 - totalExp / totalInc) * 100 : 0
          const savingsColor = savingsRate > 20 ? 'text-green-400' : savingsRate >= 5 ? 'text-amber-400' : 'text-red-400'
          return (
            <Card className="hover:shadow-md h-full min-h-[140px] relative overflow-hidden border-l-[3px] border-l-sky-500">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground leading-snug">Tasa de ahorro</p>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <PrivateAmount>
                  <p className={cn('text-3xl sm:text-4xl font-bold tracking-tighter mt-3 tabular-nums', savingsColor)}>
                    {Math.round(savingsRate)}%
                  </p>
                </PrivateAmount>
                <div className="mt-auto pt-3 border-t border-border/50">
                  <span className="text-[11px] text-muted-foreground">del ingreso mensual</span>
                </div>
              </CardContent>
            </Card>
          )
        })()}
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
          {Object.keys(balance.aggregations.incomesByCategory).length > 1 ? (
            <CategoryDonut
              title="De dónde viene la plata"
              data={balance.aggregations.incomesByCategory}
              total={balance.totalIncome}
              emptyMessage="Sin ingresos registrados"
              convert={convert}
            />
          ) : (
            <PaymentMethodSummary
              installments={balance.installments}
              cashTransactions={balance.cashTransactions || []}
              convert={convert}
            />
          )}
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

const DONUT_COLORS = CATEGORY_DONUT_COLORS
const FALLBACK_COLORS = CATEGORY_FALLBACK_COLORS

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
    <Card className="flex flex-col h-full min-h-[220px]">
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

// ── Payment Method Summary ───────────────────────────────────────────

function getMethodIcon(method: string) {
  const lower = method.toLowerCase()
  if (lower.includes('efectivo') || lower.includes('cash')) return Banknote
  if (lower.includes('transferencia') || lower.includes('transfer')) return ArrowLeftRight
  return CreditCardIcon
}

function PaymentMethodSummary({
  installments,
  cashTransactions,
  convert,
}: {
  installments: any[]
  cashTransactions: any[]
  convert: (v: number) => number
}) {
  const methodTotals: Record<string, number> = {}

  for (const inst of installments) {
    const method = inst.transaction.card?.name || 'Tarjeta'
    methodTotals[method] = (methodTotals[method] || 0) + Number(inst.amount)
  }
  for (const tx of cashTransactions) {
    const method = getPaymentMethodLabelWithCard(tx.paymentMethod, tx.card)
    methodTotals[method] = (methodTotals[method] || 0) + Number(tx.totalAmount)
  }

  const sorted = Object.entries(methodTotals)
    .map(([name, amount]) => ({ name, amount: convert(amount) }))
    .sort((a, b) => b.amount - a.amount)

  const maxAmount = sorted.length > 0 ? sorted[0].amount : 1

  return (
    <Card className="flex flex-col h-full min-h-[220px]">
      <CardHeader className="py-2.5 px-4">
        <CardTitle className="text-sm font-semibold">Gasto por medio de pago</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-4 flex flex-col flex-1">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            Sin gastos registrados
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => {
              const Icon = getMethodIcon(item.name)
              const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">{item.name}</span>
                    </div>
                    <PrivateAmount>
                      <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                        {formatCurrency(item.amount)}
                      </span>
                    </PrivateAmount>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Unified Recent Movements ──────────────────────────────────────────

type SortField = 'date' | 'description' | 'method' | 'amount'
type SortDirection = 'asc' | 'desc'

function SortHeader({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  className,
}: {
  label: string
  field: SortField
  currentField: SortField
  currentDirection: SortDirection
  onSort: (field: SortField) => void
  className?: string
}) {
  const isActive = currentField === field
  return (
    <th
      className={cn(
        'text-xs font-medium uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-gray-200 transition-colors py-3 px-4',
        className
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (currentDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  )
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
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const { convert } = useCurrency()

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'date' ? 'desc' : 'asc')
    }
  }

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
      method: getPaymentMethodLabelWithCard(tx.paymentMethod, tx.card),
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
    .sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1
      switch (sortField) {
        case 'date':
          return (a.date.getTime() - b.date.getTime()) * dir
        case 'description':
          return a.description.localeCompare(b.description) * dir
        case 'method':
          return a.method.localeCompare(b.method) * dir
        case 'amount':
          return (a.amount - b.amount) * dir
        default:
          return 0
      }
    })

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
          <>
            {/* Desktop: sortable table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <SortHeader label="Descripción" field="description" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="text-left" />
                    <SortHeader label="Fecha" field="date" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="text-left" />
                    <SortHeader label="Medio de pago" field="method" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="text-left" />
                    <SortHeader label="Monto" field="amount" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {display.map((m) => {
                    const catInfo = getCategoryIconInfo(m.category)
                    const CatIcon = catInfo.icon
                    const isIncome = m.type === 'income'
                    const badgeClass = getCategoryBadgeClass(m.category)
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border"
                              style={{
                                backgroundColor: `${catInfo.color}10`,
                                borderColor: `${catInfo.color}25`,
                              }}
                            >
                              <CatIcon className="h-3.5 w-3.5" style={{ color: catInfo.color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{m.description}</p>
                              <span className={cn('text-[10px] rounded-full px-2 py-0.5 inline-block mt-0.5', badgeClass)}>
                                {m.category}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground whitespace-nowrap">
                          {format(m.date, 'd MMM yyyy', { locale: es })}
                        </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground">
                          {m.method}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <PrivateAmount>
                            <p className={cn('font-semibold text-sm tabular-nums tracking-tight', isIncome ? 'text-green-400' : 'text-red-400')}>
                              {isIncome ? '+' : '-'}{formatCurrency(convert(m.amount))}
                            </p>
                          </PrivateAmount>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: list layout */}
            <div className="md:hidden">
              {display.map((m, idx) => {
                const catInfo = getCategoryIconInfo(m.category)
                const CatIcon = catInfo.icon
                const isIncome = m.type === 'income'
                const isLast = idx === display.length - 1
                const badgeClass = getCategoryBadgeClass(m.category)
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'group flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-default',
                      !isLast && 'border-b border-white/5'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: `${catInfo.color}10`,
                          borderColor: `${catInfo.color}25`,
                        }}
                      >
                        <CatIcon className="h-4 w-4" style={{ color: catInfo.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground truncate leading-tight group-hover:text-foreground/90">
                            {m.description}
                          </p>
                          <span className={cn('text-[10px] rounded-full px-2 py-0.5 shrink-0', badgeClass)}>
                            {m.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(m.date, 'd MMM', { locale: es })} · {m.method}
                        </p>
                      </div>
                    </div>
                    <PrivateAmount>
                      <p
                        className={cn(
                          'font-semibold text-sm shrink-0 ml-3 tabular-nums tracking-tight',
                          isIncome ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(convert(m.amount))}
                      </p>
                    </PrivateAmount>
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
