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

function ProgressRing({ percentage, color }: { percentage: number; color: string }) {
    const size = 80
    const strokeWidth = 7
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const clampedPct = Math.max(0, Math.min(percentage, 100))
    const offset = circumference - (clampedPct / 100) * circumference

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
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                />
            </svg>
            <span className="absolute text-sm font-bold tabular-nums text-foreground">
                {Math.round(clampedPct)}%
            </span>
        </div>
    )
}

function MorosityBadge({ percentage }: { percentage: number }) {
    const color =
        percentage < 5 ? 'text-accent-positive' :
        percentage < 15 ? 'text-yellow-500' :
        'text-accent-danger'
    const bgColor =
        percentage < 5 ? 'bg-accent-positive/10' :
        percentage < 15 ? 'bg-yellow-500/10' :
        'bg-accent-danger/10'

    return (
        <div className={cn('flex flex-col items-center gap-1 rounded-lg px-4 py-2.5', bgColor)}>
            <span className={cn('text-2xl font-bold tabular-nums', color)}>
                {percentage.toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Mora</span>
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

function formatRentByCurrency(rent: Record<string, number>, zeroLabel = '$0') {
    const entries = Object.entries(rent).filter(([, v]) => v > 0)
    if (entries.length === 0) return zeroLabel
    return entries.map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ')
}

export function LoansDashboardSummary() {
    const { data: metrics, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

    if (isLoading) {
        return <Skeleton className="h-[160px] w-full rounded-xl" />
    }

    if (!metrics || metrics.activeLoansCount === 0) return null

    const nextInstallment = metrics.upcomingInstallments?.find(
        (i) => new Date(i.dueDate) >= new Date()
    )

    const hasInterestOnlyRent = Object.values(metrics.interestOnlyRent).some(v => v > 0)

    return (
        <div className="flex flex-col gap-3">
            {metrics.overdueCount > 0 && (
                <div className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium',
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
            )}
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

                    {/* Center: Cobranza del mes + Mora */}
                    <div className="flex items-center gap-6 shrink-0">
                        <div className="flex flex-col items-center gap-1.5">
                            {metrics.collectionPct !== null ? (
                                <ProgressRing
                                    percentage={metrics.collectionPct}
                                    color="hsl(var(--accent-positive))"
                                />
                            ) : (
                                <div className="flex items-center justify-center w-[80px] h-[80px] rounded-full border-[7px] border-muted">
                                    <span className="text-xs text-muted-foreground">N/A</span>
                                </div>
                            )}
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                {metrics.collectionPct !== null ? 'Cobranza del mes' : 'Sin vencimientos'}
                            </p>
                        </div>
                        <MorosityBadge percentage={metrics.morosityPct} />
                    </div>

                    {/* Right: Mini stats */}
                    <div className="flex flex-col gap-3 min-w-[180px]">
                        <MiniStat
                            label="Esta semana"
                            value={
                                metrics.thisWeekCount > 0
                                    ? formatCurrency(metrics.thisWeekAmount)
                                    : 'Sin cobros'
                            }
                            highlight={metrics.thisWeekCount > 0}
                        />
                        <MiniStat
                            label="Próximo cobro"
                            value={nextInstallment ? daysUntilText(nextInstallment.dueDate) : 'Sin pendientes'}
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

            {/* Renta mensual section for interest-only loans */}
            {hasInterestOnlyRent && (
                <Card className="border-border/50 bg-card/80">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4">
                        <div className="flex flex-col gap-1">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                                Renta mensual esperada
                            </p>
                            <PrivateAmount>
                                <p className="text-lg font-bold text-foreground tabular-nums">
                                    {formatRentByCurrency(metrics.interestOnlyRent)}
                                </p>
                            </PrivateAmount>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                                Renta cobrada este mes
                            </p>
                            <PrivateAmount>
                                <p className="text-lg font-bold text-foreground tabular-nums">
                                    {formatRentByCurrency(metrics.interestOnlyCollected)}
                                </p>
                            </PrivateAmount>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                                Capital en renta
                            </p>
                            <PrivateAmount>
                                <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                                    {formatRentByCurrency(metrics.interestOnlyCapital)}
                                </p>
                            </PrivateAmount>
                        </div>
                    </div>
                </Card>
            )}
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
