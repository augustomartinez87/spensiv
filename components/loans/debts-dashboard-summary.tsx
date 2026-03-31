'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { amountClass } from './helpers'

export function DebtsDashboardSummary() {
    const { data: metrics, isLoading } = trpc.loans.getDashboardMetricsDebtor.useQuery()

    if (isLoading) {
        return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
        )
    }

    if (!metrics || metrics.activeDebtsCount === 0) return null

    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
                <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deuda total</p>
                    <p className={cn(amountClass(metrics.totalDebt), 'text-foreground mt-1')}>{formatCurrency(metrics.totalDebt)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{metrics.activeDebtsCount} deuda{metrics.activeDebtsCount !== 1 ? 's' : ''}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendiente pago</p>
                    <p className={cn(amountClass(metrics.totalPending), 'text-foreground mt-1')}>{formatCurrency(metrics.totalPending)}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Próxima cuota</p>
                    {metrics.nextInstallment ? (
                        <>
                            <p className="text-xl font-bold text-accent-blue mt-1">
                                {formatCurrency(metrics.nextInstallment.amountArs)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(metrics.nextInstallment.dueDate), "d 'de' MMM", { locale: es })}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm font-medium text-muted-foreground mt-2">Sin cuotas pendientes</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidas</p>
                    <p className={cn(
                        'text-xl font-bold mt-1',
                        metrics.overdueCount > 0 ? 'text-accent-danger' : 'text-accent-positive'
                    )}>
                        {metrics.overdueCount > 0 ? formatCurrency(metrics.overdueAmount) : 'Ninguna'}
                    </p>
                    {metrics.overdueCount > 0 && (
                        <p className="text-xs text-accent-danger mt-0.5">{metrics.overdueCount} cuota{metrics.overdueCount !== 1 ? 's' : ''} sin pagar</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
