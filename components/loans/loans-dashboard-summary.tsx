'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { AlertCircle } from 'lucide-react'

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

    const collectionPct = metrics.collectionPct !== null ? Math.round(metrics.collectionPct) : null
    const overdueLevel = metrics.overdueCount >= 3 ? 'danger' : 'warning'

    return (
        <Card className="overflow-hidden bg-gradient-to-r from-card to-[hsl(217,30%,13%)] border-border/50">
            <div className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
                    {/* Left: Pending amount + progress */}
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                            Pendiente de cobro
                        </p>
                        <PrivateAmount>
                            <p className="text-[26px] font-bold text-foreground leading-tight tabular-nums tracking-tight">
                                {formatCurrency(metrics.totalPending)}
                            </p>
                        </PrivateAmount>
                        {collectionPct !== null && (
                            <div className="flex items-center gap-2 max-w-md">
                                <div className="h-1 flex-1 bg-muted/40 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-accent-positive rounded-full transition-all"
                                        style={{ width: `${Math.min(collectionPct, 100)}%` }}
                                    />
                                </div>
                                <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                    {collectionPct}% cobrado del mes
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right: compact horizontal chips */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs shrink-0">
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

                {metrics.overdueCount > 0 && (
                    <div
                        className={cn(
                            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
                            overdueLevel === 'danger'
                                ? 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'
                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
                        )}
                    >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                            {metrics.overdueCount} cuota{metrics.overdueCount !== 1 ? 's' : ''} vencida{metrics.overdueCount !== 1 ? 's' : ''}
                        </span>
                        {metrics.overdueAmount != null && metrics.overdueAmount > 0 && (
                            <PrivateAmount>
                                <span className="tabular-nums font-bold">· {formatCurrency(metrics.overdueAmount)}</span>
                            </PrivateAmount>
                        )}
                    </div>
                )}
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
