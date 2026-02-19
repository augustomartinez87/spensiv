'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface CompactProjectionProps {
  balance: number
  totalIncome: number
  totalExpense: number
}

export function CompactProjection({
  balance,
  totalIncome,
  totalExpense,
}: CompactProjectionProps) {
  const expensePercentage = totalIncome > 0
    ? (totalExpense / totalIncome) * 100
    : 0

  const savingsPotential = totalIncome - totalExpense * 1.1

  const getStatus = () => {
    if (balance < 0) {
      return {
        message: 'Estás en déficit',
        icon: AlertTriangle,
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-600 dark:text-red-400',
        valueColor: 'text-red-600 dark:text-red-400',
        progressColor: '[&>div]:bg-red-500',
      }
    }
    if (expensePercentage > 80) {
      return {
        message: 'Cuidado con los gastos',
        icon: AlertTriangle,
        iconBg: 'bg-yellow-500/10',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        valueColor: 'text-yellow-600 dark:text-yellow-400',
        progressColor: '[&>div]:bg-yellow-500',
      }
    }
    return {
      message: savingsPotential > 0
        ? `Podrías ahorrar ${formatCurrency(savingsPotential)}`
        : 'Vas por buen camino',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
      progressColor: '[&>div]:bg-emerald-500',
    }
  }

  const status = getStatus()
  const Icon = status.icon

  return (
    <Card className="hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-xl', status.iconBg)}>
            <Icon className={cn('h-5 w-5', status.iconColor)} />
          </div>
        </div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Proyección mensual</p>
        <div className={cn('text-3xl font-bold tracking-tight', balance >= 0 ? 'text-foreground' : status.valueColor)}>
          {balance < 0 && '-'}${Math.abs(balance).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Gastos vs Ingresos</span>
            <span>{expensePercentage.toFixed(0)}%</span>
          </div>
          <Progress
            value={Math.min(expensePercentage, 100)}
            className={cn('h-1.5', status.progressColor)}
          />
        </div>
        <p className={cn('text-xs font-medium mt-2', status.iconColor)}>
          {status.message}
        </p>
      </CardContent>
    </Card>
  )
}
