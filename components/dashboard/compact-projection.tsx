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
        color: 'text-red-200',
        bgColor: 'from-red-900/80 to-red-700/60 dark:from-red-950 dark:to-red-800/50',
        borderColor: 'border-red-700/30',
      }
    }
    if (expensePercentage > 80) {
      return {
        message: 'Cuidado con los gastos',
        icon: AlertTriangle,
        color: 'text-yellow-200',
        bgColor: 'from-yellow-900/80 to-yellow-700/60 dark:from-yellow-950 dark:to-yellow-800/50',
        borderColor: 'border-yellow-700/30',
      }
    }
    return {
      message: savingsPotential > 0
        ? `Podrías ahorrar ${formatCurrency(savingsPotential)}`
        : 'Vas por buen camino',
      icon: CheckCircle2,
      color: 'text-emerald-200',
      bgColor: 'from-emerald-900/80 to-emerald-700/60 dark:from-emerald-950 dark:to-emerald-800/50',
      borderColor: 'border-emerald-700/30',
    }
  }

  const status = getStatus()
  const Icon = status.icon

  return (
    <Card className={cn(
      "overflow-hidden bg-gradient-to-br border",
      status.bgColor,
      status.borderColor
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className={cn("text-xs font-medium uppercase tracking-wider", status.color)}>
            Proyección Mensual
          </p>
          <Icon className={cn("h-5 w-5", status.color)} />
        </div>

        <p className="text-3xl font-bold text-white mt-3 tracking-tight">
          {formatCurrency(balance)}
        </p>

        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-white/70 mb-1">
            <span>Gastos</span>
            <span>{expensePercentage.toFixed(0)}% de ingresos</span>
          </div>
          <Progress
            value={Math.min(expensePercentage, 100)}
            className="h-1.5 bg-white/20"
          />
        </div>

        <p className={cn("text-xs font-medium mt-2", status.color)}>
          {status.message}
        </p>
      </CardContent>
    </Card>
  )
}
