'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, cn } from '@/lib/utils'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { getBudgetStatus } from '@/lib/budget-analytics'
import { daysRemainingInMonth } from '@/lib/date-utils'

interface CompactProjectionProps {
  balance: number
  totalIncome: number
  totalExpense: number
  accentBorder?: string
}

export function CompactProjection({
  balance,
  totalIncome,
  totalExpense,
  accentBorder,
}: CompactProjectionProps) {
  const budgetStatus = getBudgetStatus(balance, totalIncome, totalExpense, formatCurrency)
  const daysRemaining = daysRemainingInMonth()

  const balanceColor = balance >= 0 ? 'text-accent-positive' : 'text-accent-danger'

  return (
    <Card className={cn("overflow-hidden h-full min-h-[140px] hover:shadow-md", accentBorder && `border-l-[3px] ${accentBorder}`)}>
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground leading-snug">
            Proyección mensual
          </p>
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border">
            {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
          </span>
        </div>

        <PrivateAmount>
          <p className={cn('text-3xl sm:text-4xl font-bold tracking-tighter mt-3 tabular-nums', balanceColor)}>
            {balance < 0 && '-'}${Math.abs(balance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </PrivateAmount>

        <div className="mt-auto pt-3 border-t border-border/50">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Gastos</span>
            <span>{budgetStatus.expensePercentage.toFixed(0)}% de ingresos</span>
          </div>
          <Progress
            value={Math.min(budgetStatus.expensePercentage, 100)}
            className="h-1.5"
          />
          <p className={cn('text-[11px] font-medium mt-1.5', balanceColor)}>
            {budgetStatus.message}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
