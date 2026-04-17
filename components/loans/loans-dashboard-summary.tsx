'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PrivateAmount } from '@/lib/contexts/privacy-context'

function HealthChip({ overdueCount, overdueAmount }: { overdueCount: number; overdueAmount?: number }) {
    if (overdueCount === 0) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-positive/15 px-2.5 py-0.5 text-xs font-medium text-accent-positive">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-positive" />
                Al día
            </span>
        )
    }
    const level = overdueCount >= 3 ? 'danger' : 'warning'
    const colorClass = level === 'danger' ? 'bg-accent-danger/15 text-accent-danger' : 'bg-yellow-500/15 text-yellow-500'
    const dotClass = level === 'danger' ? 'bg-accent-danger' : 'bg-yellow-500'

    return (
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", colorClass)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
            {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
            {overdueAmount != null && overdueAmount > 0 && (
                <PrivateAmount>
                    <span className="font-bold"> · {formatCurrency(overdueAmount)}</span>
                </PrivateAmount>
            )}
        </span>
    )
}

function daysUntilText(date: Date) {
    const now = new Date()
    const diff = Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'hoy'
    if (diff === 1) return 'mañana'
    if (diff < 0) return `hace ${Math.abs(diff)}d`
    return `en ${diff}d`
}

export function LoansDashboardSummary() {
    const { data: metrics, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

    if (isLoading) {
        return <Skeleton className="h-[120px] w-full rounded-xl" />
    }

    if (!metrics || metrics.activeLoansCount === 0) return null

    const nextInstallment = metrics.upcomingInstallments?.find(
        (i) => new Date(i.dueDate) >= new Date()
    )

    const morosityColor =
        metrics.morosityPct < 5 ? 'text-accent-positive' :
        metrics.morosityPct < 15 ? 'text-yellow-500' :
        'text-accent-danger'

    return (
        <Card className="overflow-hidden bg-gradient-to-r from-card to-[hsl(217,30%,13%)] border-border/50">
            <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
                {/* Left: Pending amount + chips under it */}
                <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                            Pendiente de cobro
                        </p>
                        <HealthChip overdueCount={metrics.overdueCount} overdueAmount={metrics.overdueAmount} />
                    </div>
                    <PrivateAmount>
                        <p className="text-[26px] font-bold text-foreground leading-tight tabular-nums tracking-tight">
                            {formatCurrency(metrics.totalPending)}
                        </p>
                    </PrivateAmount>
                </div>

                {/* Right: compact horizontal chips */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs shrink-0">
                    {metrics.collectionPct !== null && (
                        <Chip
                            label="Cobrado"
                            value={`${Math.round(metrics.collectionPct)}%`}
                            valueClass="text-accent-positive"
                        />
                    )}
                    <Chip
                        label="Mora"
                        value={`${metrics.morosityPct.toFixed(1)}%`}
                        valueClass={morosityColor}
                    />
                    {metrics.thisWeekCount > 0 && (
                        <Chip
                            label="Esta semana"
                            value={formatCurrency(metrics.thisWeekAmount)}
                            privateAmount
                        />
                    )}
                    {nextInstallment && (
                        <Chip label="Próximo" value={daysUntilText(nextInstallment.dueDate)} />
                    )}
                    <Chip
                        label="Capital activo"
                        value={formatCurrency(metrics.totalCapitalActive)}
                        privateAmount
                    />
                </div>
            </div>
        </Card>
    )
}

function Chip({
    label,
    value,
    valueClass,
    privateAmount,
}: {
    label: string
    value: string
    valueClass?: string
    privateAmount?: boolean
}) {
    const valueNode = (
        <span className={cn('font-semibold tabular-nums', valueClass ?? 'text-foreground')}>
            {value}
        </span>
    )
    return (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{label}</span>
            {privateAmount ? <PrivateAmount>{valueNode}</PrivateAmount> : valueNode}
        </div>
    )
}

/** Standalone overdue banner for use outside the full dashboard summary (e.g. table view) */
export function OverdueBanner() {
    const { data: metrics } = trpc.loans.getDashboardMetrics.useQuery()
    if (!metrics || metrics.overdueCount === 0) return null

    return (
        <div className={cn(
            'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium',
            metrics.overdueCount >= 3
                ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                : 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/20'
        )}>
            <span className="h-2 w-2 rounded-full bg-current shrink-0 animate-pulse" />
            <span>
                {metrics.overdueCount >= 3 ? 'Alerta' : 'Atención'}:{' '}
                {metrics.overdueCount} cuota{metrics.overdueCount !== 1 ? 's' : ''} vencida{metrics.overdueCount !== 1 ? 's' : ''} —{' '}
                <PrivateAmount><span className="font-bold">{formatCurrency(metrics.overdueAmount)}</span></PrivateAmount> pendiente{metrics.overdueCount !== 1 ? 's' : ''} de cobro
            </span>
        </div>
    )
}
