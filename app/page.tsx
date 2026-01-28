'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { StatCard } from '@/components/dashboard/stat-card'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { CategoryPieChart } from '@/components/dashboard/category-pie-chart'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { IncomeForm } from '@/components/transactions/income-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardPage() {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  const { data: balance, isLoading } = trpc.dashboard.getMonthlyBalance.useQuery({ period })

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (!balance) {
    return (
      <div className="container mx-auto p-6">
        <p>No se pudo cargar el balance</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Month Selector */}
      <div className="flex items-center justify-between">
        <MonthSelector value={period} onChange={setPeriod} />
        <div className="flex gap-2">
          <IncomeForm />
          <TransactionForm />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="📤 EGRESOS"
          value={balance.totalExpense}
          count={balance.installments.length}
          type="expense"
        />
        <StatCard
          title="📥 INGRESOS"
          value={balance.totalIncome}
          count={balance.incomes.length}
          type="income"
        />
        <StatCard
          title="💰 BALANCE"
          value={balance.balance}
          type="balance"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <CategoryPieChart
          data={balance.aggregations.expensesByCategory}
          title="📊 Gastos por categoría"
        />
        <CategoryPieChart
          data={balance.aggregations.expensesByType}
          title="🎯 Tipos de gasto"
        />
      </div>

      {/* Recent Transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Últimos egresos</CardTitle>
          </CardHeader>
          <CardContent>
            {balance.installments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay egresos este mes</p>
            ) : (
              <div className="space-y-3">
                {balance.installments.slice(0, 5).map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {inst.transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inst.transaction.purchaseDate), 'd/MM', { locale: es })}
                        {inst.transaction.installments > 1 &&
                          ` • Cuota ${inst.installmentNumber}/${inst.transaction.installments}`
                        }
                      </p>
                    </div>
                    <p className="font-medium text-sm">
                      ${Number(inst.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Incomes */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Últimos ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            {balance.incomes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay ingresos este mes</p>
            ) : (
              <div className="space-y-3">
                {balance.incomes.slice(0, 5).map((income: any) => (
                  <div key={income.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{income.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(income.date), 'd/MM', { locale: es })}
                      </p>
                    </div>
                    <p className="font-medium text-sm text-green-600">
                      ${Number(income.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
