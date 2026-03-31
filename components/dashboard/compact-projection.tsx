'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, cn } from '@/lib/utils'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { getBudgetStatus } from '@/lib/budget-analytics'
import { daysRemainingInMonth } from '@/lib/date-utils'

interface CompactProjectionProps {
  balance: number
  totalIncome: number
  totalExpense: number
}

const statusStyles = {
  deficit: {
    icon: AlertTriangle,
    color: 'text-red-200',
    bgColor: 'from-red-950 to-red-800/50',
    borderColor: 'border-red-700/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-200',
    bgColor: 'from-yellow-950 to-yellow-800/50',
    borderColor: 'border-yellow-700/30',
  },
  healthy: {
    icon: CheckCircle2,
    color: 'text-emerald-200',
    bgColor: 'from-emerald-950 to-emerald-800/50',
    borderColor: 'border-emerald-700/30',
  },
} as const

export function CompactProjection({
  balance,
  totalIncome,
  totalExpense,
}: CompactProjectionProps) {
  const budgetStatus = getBudgetStatus(balance, totalIncome, totalExpense, formatCurrency)
  const style = statusStyles[budgetStatus.level]
  const Icon = style.icon

  const daysRemaining = daysRemainingInMonth()

  return (
    <Card className={cn(
      "overflow-hidden bg-gradient-to-br border h-full min-h-[140px]",
      style.bgColor,
      style.borderColor
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className={cn("text-xs font-medium uppercase tracking-wider", style.color)}>
            Proyección Mensual
          </p>
          <Icon className={cn("h-5 w-5", style.color)} />
        </div>

        <PrivateAmount>
          <p className="text-3xl font-bold text-white mt-3 tracking-tight tabular-nums">
            {formatCurrency(balance)}
          </p>
        </PrivateAmount>
        <p className="text-xs text-white/50 mt-1">
          {daysRemaining} {daysRemaining === 1 ? 'día restante' : 'días restantes'}
        </p>

        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-white/70 mb-1">
            <span>Gastos</span>
            <span>{budgetStatus.expensePercentage.toFixed(0)}% de ingresos</span>
          </div>
          <Progress
            value={Math.min(budgetStatus.expensePercentage, 100)}
            className="h-1.5 bg-white/20"
          />
        </div>

        <p className={cn("text-xs font-medium mt-2", style.color)}>
          {budgetStatus.message}
        </p>
      </CardContent>
    </Card>
  )
}
