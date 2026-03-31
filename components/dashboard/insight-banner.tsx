'use client'

import { useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { AlertTriangle, TrendingUp, CheckCircle2, X } from 'lucide-react'
import Link from 'next/link'

interface InsightBannerProps {
  expenseVariation: number | null
  balance: number
  daysRemaining: number
}

export function InsightBanner({ expenseVariation, balance, daysRemaining }: InsightBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const { data: loansData } = trpc.loans.getDashboardMetrics.useQuery()

  if (dismissed) return null

  // Determine highest-priority insight
  let config: {
    icon: typeof AlertTriangle
    message: React.ReactNode
    borderColor: string
    bgColor: string
    iconColor: string
  } | null = null

  // Priority 1 (red): overdue loan installments
  if (loansData && loansData.overdueCount > 0) {
    config = {
      icon: AlertTriangle,
      message: (
        <>
          Tenés{' '}
          <strong>
            {loansData.overdueCount} cuota{loansData.overdueCount !== 1 ? 's' : ''} vencida{loansData.overdueCount !== 1 ? 's' : ''}
          </strong>{' '}
          por <strong>{formatCurrency(loansData.overdueAmount)}</strong>.{' '}
          <Link href="/dashboard/loans" className="underline hover:no-underline font-medium">
            Revisá tu cartera →
          </Link>
        </>
      ),
      borderColor: 'border-l-red-500',
      bgColor: 'bg-red-500/5',
      iconColor: 'text-red-400',
    }
  }
  // Priority 2 (orange): spending 10%+ above previous month
  else if (expenseVariation !== null && expenseVariation > 10) {
    config = {
      icon: TrendingUp,
      message: (
        <>
          Vas gastando <strong>{expenseVariation.toFixed(0)}% más</strong> que el mes pasado. Revisá tus gastos.
        </>
      ),
      borderColor: 'border-l-orange-500',
      bgColor: 'bg-orange-500/5',
      iconColor: 'text-orange-400',
    }
  }
  // Priority 3 (green): finishing the month with positive balance
  else if (balance > 0 && daysRemaining >= 0 && daysRemaining <= 7) {
    config = {
      icon: CheckCircle2,
      message: (
        <>
          Buen mes. Vas a cerrar con <strong>{formatCurrency(balance)}</strong> de ahorro.
        </>
      ),
      borderColor: 'border-l-green-500',
      bgColor: 'bg-green-500/5',
      iconColor: 'text-green-400',
    }
  }

  if (!config) return null

  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border/40 border-l-4',
        config.borderColor,
        config.bgColor
      )}
    >
      <div className="flex items-center gap-3 text-sm text-foreground min-w-0">
        <Icon className={cn('h-4 w-4 shrink-0', config.iconColor)} />
        <span className="leading-snug">{config.message}</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
