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
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, cn } from '@/lib/utils'
import { Calendar, CreditCard, TrendingUp, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  const { data: balance, isLoading: isLoadingBalance } = trpc.dashboard.getMonthlyBalance.useQuery({ period })
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
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
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
          <p className="text-muted-foreground">No se pudo cargar el balance. Verifica tu conexión.</p>
        </div>
      </div>
    )
  }

  // Group upcoming payments by card to avoid duplicates
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

  const nextPayment = groupedPayments?.[0]

  return (
    <div className="space-y-8">
      {/* Header with Title and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Tu motor de cashflow personal</p>
        </div>
        <div className="flex items-center gap-2">
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
            title="📤 EGRESOS DEL PERIODO"
            value={balance.totalExpense}
            count={balance.installments.length + (balance.cashTransactions?.length || 0)}
            type="expense"
          />
          <StatCard
            title="📥 INGRESOS DEL PERIODO"
            value={balance.totalIncome}
            count={balance.incomes.length}
            type="income"
          />
          <StatCard
            title="💰 BALANCE NETO"
            value={balance.balance}
            type="balance"
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
              title="📊 Gastos por categoría"
            />
            <CategoryPieChart
              data={balance.aggregations.expensesByType}
              title="🎯 Tipos de gasto"
            />
          </div>

          {/* Recent List */}
          <Card>
            <CardHeader className="border-b bg-muted py-4">
              <CardTitle className="text-base font-semibold">📋 Movimientos recientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {balance.installments.slice(0, 5).map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between p-4 hover:bg-accent transition-colors">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {inst.transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(inst.transaction.purchaseDate), 'd MMM', { locale: es })}
                        {inst.transaction.installments > 1 &&
                          ` • Cuota ${inst.installmentNumber}/${inst.transaction.installments}`
                        }
                        {inst.transaction.card && ` • ${inst.transaction.card.name}`}
                      </p>
                    </div>
                    <p className="font-semibold text-sm text-foreground">
                      {formatCurrency(Number(inst.amount))}
                    </p>
                  </div>
                ))}
                {balance.cashTransactions?.slice(0, 5).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-accent transition-colors">
                    <div>
                      <p className="font-medium text-sm text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(tx.purchaseDate), 'd MMM', { locale: es })}
                        {` • ${tx.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}`}
                      </p>
                    </div>
                    <p className="font-semibold text-sm text-foreground">
                      {formatCurrency(Number(tx.totalAmount))}
                    </p>
                  </div>
                ))}
                {balance.incomes.slice(0, 5).map((income: any) => (
                  <div key={income.id} className="flex items-center justify-between p-4 hover:bg-accent transition-colors">
                    <div>
                      <p className="font-medium text-sm text-foreground">{income.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(income.date), 'd MMM', { locale: es })}
                        {income.category === 'active_income' ? ' • Sueldo' : ' • Otro'}
                      </p>
                    </div>
                    <p className="font-semibold text-sm text-green-600 dark:text-green-400">
                      {formatCurrency(Number(income.amount))}
                    </p>
                  </div>
                ))}
                {balance.installments.length === 0 && (!balance.cashTransactions || balance.cashTransactions.length === 0) && balance.incomes.length === 0 && (
                  <div className="p-8 text-center bg-muted">
                    <p className="text-muted-foreground text-sm">No hay actividad registrada en este periodo</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info Section (1/3) */}
        <div className="space-y-6">
          {/* Next Payment */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground py-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <CardTitle className="text-sm font-semibold">Próximo Vencimiento</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {nextPayment ? (
                <div className="space-y-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-foreground tracking-tight">
                      {formatCurrency(nextPayment.amount)}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">{nextPayment.card.name}</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-muted rounded-full text-xs font-semibold text-foreground">
                    <AlertCircle className={cn("h-3 w-3", nextPayment.daysUntil <= 3 ? "text-red-500" : "text-primary")} />
                    En {nextPayment.daysUntil} días ({format(new Date(nextPayment.dueDate), 'd MMM', { locale: es })})
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm italic">
                  No hay vencimientos próximos
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cards Debt List */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CardsIcon className="h-4 w-4" /> Tarjetas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <div className="space-y-1">
                {groupedPayments?.map((p) => (
                  <div key={p.card.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors">
                    <span className="text-sm text-muted-foreground">{p.card.name}</span>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
                {!groupedPayments?.length && (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">Sin deudas activas</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const CardsIcon = CreditCard
