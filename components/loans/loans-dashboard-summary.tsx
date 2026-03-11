'use client'

import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PrivateAmount } from '@/lib/privacy-context'

function HealthChip({ overdueCount }: { overdueCount: number }) {
    if (overdueCount === 0) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-positive/15 px-2.5 py-0.5 text-xs font-medium text-accent-positive">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-positive" />
                Tu cartera va bien
            </span>
        )
    }
    if (overdueCount <= 2) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-2.5 py-0.5 text-xs font-medium text-yellow-500">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                Atención: {overdueCount} cuota{overdueCount !== 1 ? 's' : ''} vencida{overdueCount !== 1 ? 's' : ''}
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-danger/15 px-2.5 py-0.5 text-xs font-medium text-accent-danger">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-danger" />
            Alerta: {overdueCount} cuotas vencidas
        </span>
    )
}

function CollectionRing({ percentage }: { percentage: number }) {
    const size = 80
    const strokeWidth = 7
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--accent-positive))"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                />
            </svg>
            <span className="absolute text-sm font-bold tabular-nums text-foreground">
                {Math.round(percentage)}%
            </span>
        </div>
    )
}

function daysUntilText(date: Date) {
    const now = new Date()
    const diff = Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'hoy'
    if (diff === 1) return 'mañana'
    if (diff < 0) return `hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}`
    return `en ${diff} día${diff !== 1 ? 's' : ''}`
}

export function LoansDashboardSummary() {
    const { data: metrics, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

    if (isLoading) {
        return <Skeleton className="h-[160px] w-full rounded-xl" />
    }

    if (!metrics || metrics.activeLoansCount === 0) return null

    const collectedPct =
        metrics.totalCapitalActive > 0
            ? Math.min(((metrics.totalCapitalActive - metrics.totalPending) / metrics.totalCapitalActive) * 100, 100)
            : 0

    const nextInstallment = metrics.upcomingInstallments?.find(
        (i) => new Date(i.dueDate) >= new Date()
    )

    return (
        <Card className="overflow-hidden bg-gradient-to-r from-card to-[hsl(217,30%,13%)] border-border/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 md:min-h-[160px]">
                {/* Left: Pending amount + health */}
                <div className="flex flex-col justify-center gap-2 min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        Pendiente de cobro
                    </p>
                    <PrivateAmount>
                        <p className="text-[28px] font-bold text-foreground leading-tight tabular-nums tracking-tight">
                            {formatCurrency(metrics.totalPending)}
                        </p>
                    </PrivateAmount>
                    <HealthChip overdueCount={metrics.overdueCount} />
                </div>

                {/* Center: Collection donut */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <CollectionRing percentage={collectedPct} />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Cobrado
                    </p>
                </div>

                {/* Right: Mini stats */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    <MiniStat
                        label="Esta semana"
                        value={
                            metrics.thisWeekCount > 0
                                ? formatCurrency(metrics.thisWeekAmount)
                                : '-'
                        }
                        highlight={metrics.thisWeekCount > 0}
                    />
                    <MiniStat
                        label="Próximo cobro"
                        value={nextInstallment ? daysUntilText(nextInstallment.dueDate) : '-'}
                        highlight={false}
                        isText
                    />
                    <MiniStat
                        label="Capital activo"
                        value={formatCurrency(metrics.totalCapitalActive)}
                    />
                </div>
            </div>
        </Card>
    )
}

function MiniStat({
    label,
    value,
    highlight,
    isText,
}: {
    label: string
    value: string
    highlight?: boolean
    isText?: boolean
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
            {isText ? (
                <span className={cn(
                    'text-sm font-semibold whitespace-nowrap',
                    highlight ? 'text-accent-blue' : 'text-foreground'
                )}>
                    {value}
                </span>
            ) : (
                <PrivateAmount>
                    <span className={cn(
                        'text-sm font-semibold tabular-nums whitespace-nowrap',
                        highlight ? 'text-accent-blue' : 'text-foreground'
                    )}>
                        {value}
                    </span>
                </PrivateAmount>
            )}
        </div>
    )
}
