'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { daysUntilText } from '@/lib/date-utils'
import { MOROSITY_WARNING_PCT, MOROSITY_DANGER_PCT } from '@/lib/constants/thresholds'

function formatRentCompact(rent: Record<string, number>) {
    const entries = Object.entries(rent).filter(([, v]) => v > 0)
    if (entries.length === 0) return '$0'
    return entries.map(([currency, amount]) => {
        if (amount >= 1_000_000) return `${(amount / 1_000).toFixed(0)}K${currency !== 'ARS' ? ` ${currency}` : ''}`
        return formatCurrency(amount, currency)
    }).join(' + ')
}

export function LoansCompactStats() {
    const { data: metrics, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

    if (isLoading) return <Skeleton className="h-12 w-full rounded-lg" />
    if (!metrics || metrics.activeLoansCount === 0) return null

    const nextInstallment = metrics.upcomingInstallments?.find(
        (i) => new Date(i.dueDate) >= new Date()
    )

    const morosityColor =
        metrics.morosityPct < MOROSITY_WARNING_PCT ? 'text-green-400' :
        metrics.morosityPct < MOROSITY_DANGER_PCT ? 'text-yellow-500' :
        'text-red-400'
    const morosityDotColor =
        metrics.morosityPct < MOROSITY_WARNING_PCT ? 'bg-green-400' :
        metrics.morosityPct < MOROSITY_DANGER_PCT ? 'bg-yellow-500' :
        'bg-red-400'

    const hasInterestOnlyRent = Object.values(metrics.interestOnlyRent).some(v => v > 0)

    const items: { label: string; value: string; isPrivate?: boolean; className?: string }[] = [
        {
            label: 'Pendiente',
            value: formatCurrency(metrics.totalPending),
            isPrivate: true,
        },
        {
            label: 'Mora',
            value: `${metrics.morosityPct.toFixed(1)}%`,
            className: morosityColor,
        },
        {
            label: 'Prox. cobro',
            value: nextInstallment ? daysUntilText(nextInstallment.dueDate) : 'Sin pend.',
        },
        {
            label: 'Capital activo',
            value: formatCurrency(metrics.totalCapitalActive),
            isPrivate: true,
        },
    ]

    if (hasInterestOnlyRent) {
        items.push({
            label: 'Renta esp.',
            value: formatRentCompact(metrics.interestOnlyRent),
            isPrivate: true,
        })
        items.push({
            label: 'Cobrada',
            value: formatRentCompact(metrics.interestOnlyCollected),
            isPrivate: true,
        })
    }

    return (
        <div className="flex flex-col gap-3">
            {metrics.overdueCount > 0 && (
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
                        <PrivateAmount><span className="font-bold">{formatCurrency(metrics.overdueAmount)}</span></PrivateAmount>
                    </span>
                </div>
            )}
            <div className="flex items-center gap-0 rounded-lg border border-border/50 bg-card/80 px-2 h-12 overflow-x-auto">
                {items.map((item, idx) => (
                    <div key={item.label} className={cn(
                        "flex flex-col justify-center px-3 py-1 min-w-0 shrink-0",
                        idx < items.length - 1 && "border-r border-border/30"
                    )}>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none whitespace-nowrap">{item.label}</span>
                        {item.isPrivate ? (
                            <PrivateAmount>
                                <span className={cn("text-sm font-semibold tabular-nums leading-tight whitespace-nowrap", item.className)}>
                                    {item.value}
                                </span>
                            </PrivateAmount>
                        ) : (
                            <span className={cn("text-sm font-semibold tabular-nums leading-tight whitespace-nowrap", item.className)}>
                                {item.label === 'Mora' && <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", morosityDotColor)} />}
                                {item.value}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
