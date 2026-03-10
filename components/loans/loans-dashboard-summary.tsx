'use client'

import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { amountClass } from './helpers'

export function LoansDashboardSummary() {
    const { data: metrics, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

    if (isLoading) {
        return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
        )
    }

    if (!metrics || metrics.activeLoansCount === 0) return null

    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
                <CardContent className="p-5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Capital activo</p>
                    <p className={cn(amountClass(metrics.totalCapitalActive), 'text-foreground mt-1')}>{formatCurrency(metrics.totalCapitalActive)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{metrics.activeLoansCount} préstamo{metrics.activeLoansCount !== 1 ? 's' : ''}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendiente cobro</p>
                    <p className={cn(amountClass(metrics.totalPending), 'text-foreground mt-1')}>{formatCurrency(metrics.totalPending)}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Esta semana</p>
                    <p className={cn(
                        'text-xl font-bold mt-1',
                        metrics.thisWeekCount > 0 ? 'text-accent-blue' : 'text-muted-foreground'
                    )}>
                        {metrics.thisWeekCount > 0 ? formatCurrency(metrics.thisWeekAmount) : '-'}
                    </p>
                    {metrics.thisWeekCount > 0 && (
                        <p className="text-xs text-accent-blue mt-0.5">{metrics.thisWeekCount} cuota{metrics.thisWeekCount !== 1 ? 's' : ''}</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidas</p>
                    <p className={cn(
                        'text-xl font-bold mt-1',
                        metrics.overdueCount > 0 ? 'text-accent-danger' : 'text-accent-positive'
                    )}>
                        {metrics.overdueCount > 0 ? formatCurrency(metrics.overdueAmount) : 'Ninguna'}
                    </p>
                    {metrics.overdueCount > 0 && (
                        <p className="text-xs text-accent-danger mt-0.5">{metrics.overdueCount} cuota{metrics.overdueCount !== 1 ? 's' : ''} sin cobrar</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
