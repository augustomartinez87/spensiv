'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { Card } from '@/components/ui/card'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { formatCurrency } from '@/lib/utils'
import { Banknote, Calculator, Briefcase } from 'lucide-react'
import Link from 'next/link'

export function LoansWidget() {
  const { data, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

  if (isLoading || !data || data.activeLoansCount === 0) return null

  return (
    <Card className="relative overflow-hidden border-accent-cyan/20">
      {/* Subtle cyan accent line at top */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent-cyan/60 via-accent-cyan/40 to-transparent" />

      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* Left side */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-accent-cyan/10 flex items-center justify-center shrink-0">
              <Banknote className="h-3.5 w-3.5 text-accent-cyan" />
            </div>
            <span className="text-sm font-semibold text-foreground">Cartera de préstamos</span>
          </div>

          <div className="ml-9">
            <p className="text-sm font-bold text-foreground leading-tight">
              Pendiente de cobro:{' '}
              <PrivateAmount>
                <span className="tabular-nums">{formatCurrency(data.totalPending)}</span>
              </PrivateAmount>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.thisWeekCount} cuota{data.thisWeekCount !== 1 ? 's' : ''} esta semana
              {data.overdueCount > 0 && (
                <>
                  {' · '}
                  <span className="text-accent-danger font-medium">
                    {data.overdueCount} vencida{data.overdueCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right side: compact buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/simulator"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Calculator className="h-3.5 w-3.5" />
            Simular
          </Link>
          <Link
            href="/dashboard/portfolio"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-cyan px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-cyan/90 transition-colors"
          >
            <Briefcase className="h-3.5 w-3.5" />
            Ver cartera
          </Link>
        </div>
      </div>
    </Card>
  )
}
