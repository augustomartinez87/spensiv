'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc-client'
import { MonthSelector } from '@/components/dashboard/month-selector'

const CategoryPieChart = dynamic(
  () => import('@/components/dashboard/category-pie-chart').then((m) => m.CategoryPieChart),
  { ssr: false }
)
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
const CardDetailModal = dynamic(
  () => import('@/components/cards/card-detail-modal').then((m) => m.CardDetailModal),
  { ssr: false }
)

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
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import Link from 'next/link'

// ── Helpers ──────────────────────────────────────────────────────────

function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
}

function getBankColor(bank: string): string {
  const colors: Record<string, string> = {
    CIUDAD: 'bg-blue-600',
    GALICIA: 'bg-orange-500',
    SANTANDER: 'bg-red-600',
    BBVA: 'bg-blue-700',
    MACRO: 'bg-indigo-600',
    HSBC: 'bg-red-500',
    ICBC: 'bg-red-700',
    BRUBANK: 'bg-purple-600',
    UALA: 'bg-blue-500',
    MERCADOPAGO: 'bg-sky-500',
  }
  const key = bank.toUpperCase()
  for (const [k, v] of Object.entries(colors)) {
    if (key.includes(k)) return v
  }
  return 'bg-gray-500'
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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const previousPeriod = getPreviousPeriod(period)

  const { data: balance, isLoading: isLoadingBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period })
  const { data: prevBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period: previousPeriod })
  const { data: cardBalances, isLoading: loadingCardBalances } = trpc.dashboard.getCardBalances.useQuery({ period })
  const { data: upcomingPayments, isLoading: loadingPayments } = trpc.dashboard.getUpcomingPayments.useQuery()
  const { data: loanMetrics } = trpc.loans.getDashboardMetrics.useQuery()
  const { data: budgetProgress } = trpc.budget.getProgress.useQuery({ period })
  const { data: evolutionData } = trpc.dashboard.getEvolutionData.useQuery({ months: 6 })

  const isLoading = isLoadingBalance || loadingCardBalances || loadingPayments

  if (isLoading) {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Skeleton className="lg:col-span-7 h-64" />
          <Skeleton className="lg:col-span-5 h-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-64" />
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

  // ── Derived values ──
  const expenseChange =
    prevBalance && prevBalance.totalExpense > 0
      ? ((balance.totalExpense - prevBalance.totalExpense) / prevBalance.totalExpense) * 100
      : null
  const incomeChange =
    prevBalance && prevBalance.totalIncome > 0
      ? ((balance.totalIncome - prevBalance.totalIncome) / prevBalance.totalIncome) * 100
      : null
  const savingsRate = balance.totalIncome > 0 ? (balance.balance / balance.totalIncome) * 100 : 0
  const spendRate = balance.totalIncome > 0 ? (balance.totalExpense / balance.totalIncome) * 100 : 0

  const totalBudgetLimit = budgetProgress?.reduce((s, b) => s + b.monthlyLimit, 0) ?? 0
  const totalBudgetSpent = budgetProgress?.reduce((s, b) => s + b.spent, 0) ?? 0
  const budgetDisciplinePct = totalBudgetLimit > 0 ? (totalBudgetSpent / totalBudgetLimit) * 100 : null

  const groupedPayments = upcomingPayments?.reduce(
    (acc, p) => {
      const existing = acc.find((g) => g.card.id === p.card.id)
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
    },
    [] as NonNullable<typeof upcomingPayments>
  )
  const nextPayments = groupedPayments?.slice(0, 4) || []
  const cardList = cardBalances?.cards || []

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

      {/* ── ROW 1: Hero KPIs (5 en fila) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Ingresos */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ingresos</p>
            <p className="text-2xl font-bold text-blue-400 mt-1 tabular-nums leading-tight">
              {formatHero(balance.totalIncome)}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-muted-foreground">
                {balance.incomes.length} ingreso{balance.incomes.length !== 1 ? 's' : ''}
              </p>
              {incomeChange !== null && (
                <span
                  className={cn(
                    'text-[10px] font-medium flex items-center gap-0.5',
                    incomeChange >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {incomeChange >= 0 ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(incomeChange).toFixed(1)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Egresos */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Egresos</p>
            <p className="text-2xl font-bold text-orange-400 mt-1 tabular-nums leading-tight">
              {formatHero(balance.totalExpense)}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-muted-foreground">
                {(balance.installments.length + (balance.cashTransactions?.length || 0))} movimientos
              </p>
              {expenseChange !== null && (
                <span
                  className={cn(
                    'text-[10px] font-medium flex items-center gap-0.5',
                    expenseChange <= 0 ? 'text-green-400' : 'text-orange-400'
                  )}
                >
                  {expenseChange > 0 ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(expenseChange).toFixed(1)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Balance ★ — centro destacado */}
        <Card
          className={cn(
            'ring-1 transition-colors',
            balance.balance >= 0
              ? 'ring-blue-500/40 bg-blue-500/5'
              : 'ring-orange-500/40 bg-orange-500/5'
          )}
        >
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Balance ★
            </p>
            <p
              className={cn(
                'text-2xl font-bold mt-1 tabular-nums leading-tight',
                balance.balance >= 0 ? 'text-blue-400' : 'text-orange-400'
              )}
            >
              {formatHero(balance.balance)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {balance.balance >= 0 ? 'Superávit del mes' : 'Déficit del mes'}
            </p>
          </CardContent>
        </Card>

        {/* Tasa de ahorro */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Tasa de ahorro
            </p>
            <p
              className={cn(
                'text-2xl font-bold mt-1 tabular-nums leading-tight',
                savingsRate >= 20
                  ? 'text-green-400'
                  : savingsRate >= 0
                    ? 'text-amber-400'
                    : 'text-red-400'
              )}
            >
              {balance.totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5">de los ingresos</p>
          </CardContent>
        </Card>

        {/* Egresos vs mes anterior */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              vs mes anterior
            </p>
            {expenseChange !== null ? (
              <>
                <p
                  className={cn(
                    'text-2xl font-bold mt-1 tabular-nums leading-tight',
                    expenseChange <= 0 ? 'text-green-400' : 'text-orange-400'
                  )}
                >
                  {expenseChange > 0 ? '+' : ''}
                  {expenseChange.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5">egresos</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold mt-1 text-muted-foreground">—</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">sin datos previos</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 2: Evolución + Donut / Disciplina ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Evolution chart — 7/12 */}
        <div className="lg:col-span-7">
          {evolutionData && evolutionData.length > 1 ? (
            <MonthlyEvolutionChart data={evolutionData} />
          ) : (
            <Card className="flex items-center justify-center min-h-[240px]">
              <p className="text-sm text-muted-foreground italic">
                Sin datos suficientes para el gráfico
              </p>
            </Card>
          )}
        </div>

        {/* Donut + Indicadores de disciplina — 5/12 */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {balance.aggregations.expensesByCategory.length > 0 && (
            <CategoryPieChart
              data={balance.aggregations.expensesByCategory}
              title="Distribución de gastos"
            />
          )}

          {/* Discipline indicators */}
          {balance.totalIncome > 0 && (
            <Card>
              <CardContent className="p-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Ahorro</p>
                  <p
                    className={cn(
                      'text-base font-bold mt-0.5',
                      savingsRate >= 20 ? 'text-green-400' : 'text-amber-400'
                    )}
                  >
                    {savingsRate.toFixed(1)}%
                  </p>
                  <p className="text-[9px] text-muted-foreground">de ingresos</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gasto</p>
                  <p
                    className={cn(
                      'text-base font-bold mt-0.5',
                      spendRate > 90 ? 'text-orange-400' : 'text-foreground'
                    )}
                  >
                    {spendRate.toFixed(1)}%
                  </p>
                  <p className="text-[9px] text-muted-foreground">de ingresos</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Presupuesto</p>
                  <p
                    className={cn(
                      'text-base font-bold mt-0.5',
                      budgetDisciplinePct === null
                        ? 'text-muted-foreground'
                        : budgetDisciplinePct > 100
                          ? 'text-red-400'
                          : budgetDisciplinePct > 80
                            ? 'text-amber-400'
                            : 'text-green-400'
                    )}
                  >
                    {budgetDisciplinePct !== null ? `${Math.round(budgetDisciplinePct)}%` : '—'}
                  </p>
                  <p className="text-[9px] text-muted-foreground">usado</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── ROW 3: Presupuesto + Vencimientos & Tarjetas ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Budget compact — todas las categorías */}
        {budgetProgress && budgetProgress.length > 0 && (
          <Card>
            <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Presupuesto
              </CardTitle>
              <Link href="/dashboard/budget">
                <Button variant="ghost" size="sm" className="h-6 text-xs">
                  Ver detalle <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2.5">
              {[...budgetProgress]
                .sort((a, b) => b.percentage - a.percentage)
                .map((item) => {
                  const barColor =
                    item.percentage > 100
                      ? 'bg-red-500'
                      : item.percentage >= 80
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                  const textColor =
                    item.percentage > 100
                      ? 'text-red-400'
                      : item.percentage >= 80
                        ? 'text-amber-400'
                        : 'text-green-400'
                  return (
                    <div key={item.categoryId}>
                      <div className="flex justify-between items-baseline text-xs mb-1">
                        <span className="text-foreground font-medium truncate max-w-[140px]">
                          {item.categoryName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10px] text-muted-foreground">
                            {formatHero(item.spent)} / {formatHero(item.monthlyLimit)}
                          </span>
                          <span className={cn('font-bold text-[10px] w-8 text-right', textColor)}>
                            {Math.round(item.percentage)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', barColor)}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        )}

        {/* Right column: Vencimientos + Tarjetas stacked */}
        <div className="space-y-3">
          {/* Upcoming payments */}
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
                      <div
                        key={p.card.id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-all duration-200"
                      >
                        <div
                          className={cn(
                            'flex flex-col items-center justify-center h-9 w-9 rounded-lg shrink-0',
                            isOverdue ? 'bg-red-900/30' : 'bg-muted'
                          )}
                        >
                          <span
                            className={cn(
                              'text-[8px] font-bold uppercase leading-none',
                              isOverdue ? 'text-red-400' : 'text-red-500'
                            )}
                          >
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
                              <span className="text-red-400 font-medium">VENCIDO</span>
                            ) : (
                              <>En {p.daysUntil} {p.daysUntil === 1 ? 'día' : 'días'}</>
                            )}
                          </p>
                        </div>
                        <p
                          className={cn(
                            'text-xs font-bold shrink-0',
                            isOverdue ? 'text-red-400' : 'text-foreground'
                          )}
                        >
                          {formatCurrency(p.amount)}
                        </p>
                      </div>
                    )
                  })}
                  <Link
                    href="/dashboard/projections"
                    className="flex items-center justify-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors pt-1"
                  >
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

          {/* Tarjetas compact */}
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
                {cardList.slice(0, 5).map((card) => {
                  const hasPeriodBalance = card.currentPeriodBalance > 0
                  return (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-all duration-200 cursor-pointer group"
                    >
                      {/* color dot instead of big avatar */}
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          getBankColor(card.bank || '')
                        )}
                      />
                      <p className="text-xs font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                        {card.name}
                      </p>
                      {(() => {
                        const days = getDaysUntilClosing(card.closingDay)
                        if (days <= 7) {
                          return (
                            <span className="text-[9px] bg-orange-500/15 text-orange-400 px-1 py-0.5 rounded-full shrink-0">
                              {days}d
                            </span>
                          )
                        }
                        return null
                      })()}
                      {card.thirdPartyAmount > 0 && (
                        <span className="text-[9px] bg-purple-500/15 text-purple-400 px-1 py-0.5 rounded-full shrink-0">
                          3°
                        </span>
                      )}
                      <p className="text-xs font-bold text-foreground shrink-0">
                        {formatHero(hasPeriodBalance ? card.currentPeriodBalance : card.totalBalance)}
                      </p>
                    </div>
                  )
                })}
                {cardList.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3 italic">
                    Sin tarjetas registradas
                  </p>
                )}
                {cardList.length > 5 && (
                  <Link
                    href="/dashboard/cards"
                    className="flex items-center justify-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors pt-1"
                  >
                    +{cardList.length - 5} más <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── ROW 4: Movimientos unificados + Préstamos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <UnifiedRecentMovements
            installments={balance.installments}
            cashTransactions={balance.cashTransactions || []}
            incomes={balance.incomes}
          />
        </div>
        <div>
          <LoansCompact metrics={loanMetrics} />
        </div>
      </div>

      <CardDetailModal
        cardId={selectedCardId}
        isOpen={!!selectedCardId}
        onClose={() => setSelectedCardId(null)}
      />
    </div>
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
            {/* Toggle pills */}
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
                        isIncome ? 'bg-blue-500/10' : 'bg-muted'
                      )}
                    >
                      <CatIcon
                        className={cn(
                          'h-3.5 w-3.5',
                          isIncome ? 'text-blue-400' : 'text-muted-foreground'
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
                        {m.expenseType && ` · ${m.expenseType}`}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'font-semibold text-sm shrink-0 ml-3 tabular-nums',
                      isIncome ? 'text-blue-400' : 'text-orange-400'
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

// ── Loans Compact ─────────────────────────────────────────────────────

function LoansCompact({ metrics }: { metrics: any }) {
  return (
    <Card className="h-full">
      <CardHeader className="py-2.5 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" /> Préstamos
          </CardTitle>
          <Link
            href="/dashboard/loans"
            className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-0.5"
          >
            Ver <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {metrics && metrics.activeLoansCount > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted rounded-lg p-2.5">
                <p className="text-[9px] text-muted-foreground uppercase">Capital</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {formatHero(metrics.totalCapitalActive)}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-2.5">
                <p className="text-[9px] text-muted-foreground uppercase">Por cobrar</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {formatHero(metrics.totalPending)}
                </p>
              </div>
              {metrics.overdueCount > 0 && (
                <div className="col-span-2 bg-red-500/10 rounded-lg p-2.5">
                  <p className="text-[9px] text-red-400 uppercase font-medium">En mora</p>
                  <p className="text-sm font-bold text-red-400 mt-0.5">
                    {formatHero(metrics.overdueAmount)} · {metrics.overdueCount} cuota
                    {metrics.overdueCount !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
            {metrics.upcomingInstallments.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase">
                  Próximas cuotas
                </p>
                {metrics.upcomingInstallments.slice(0, 4).map((inst: any) => (
                  <div key={inst.id} className="flex items-center justify-between text-xs py-1 px-1.5">
                    <span className="text-foreground font-medium truncate">{inst.borrowerName}</span>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-bold text-[11px]">
                        {formatCurrency(inst.amount, inst.currency)}
                      </span>
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        {format(new Date(inst.dueDate), 'd MMM', { locale: es })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Banknote className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground italic">Sin préstamos activos</p>
            <Link
              href="/dashboard/loans"
              className="text-xs text-primary hover:text-primary/80 mt-1 inline-block"
            >
              Crear préstamo
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
