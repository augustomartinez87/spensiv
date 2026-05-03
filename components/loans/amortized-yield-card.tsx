'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { TrendingUp, Wallet, Clock, XCircle } from 'lucide-react'

export function AmortizedYieldCard() {
    const { data: metrics, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

    if (isLoading) {
        return <Skeleton className="h-[120px] w-full rounded-xl" />
    }

    const yld = metrics?.amortizedYield
    if (!yld) return null

    const totalLoans = yld.activeCount + yld.completedCount + yld.defaultedCount
    if (totalLoans === 0) return null

    const collectedPct = yld.interestContractual > 0
        ? (yld.interestCollected / yld.interestContractual) * 100
        : 0
    const hasDefaulted = yld.defaultedCount > 0
    const totalLoss = yld.interestLost + yld.principalLost

    return (
        <Card className="overflow-hidden bg-gradient-to-r from-card to-[hsl(217,30%,13%)] border-border/50">
            <div className="flex flex-col gap-3 px-5 py-4">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        Ganancia nominal · Amortizados
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                        {totalLoans} préstamo{totalLoans !== 1 ? 's' : ''}
                        {yld.activeCount > 0 && ` · ${yld.activeCount} activo${yld.activeCount !== 1 ? 's' : ''}`}
                        {yld.completedCount > 0 && ` · ${yld.completedCount} completado${yld.completedCount !== 1 ? 's' : ''}`}
                        {hasDefaulted && ` · ${yld.defaultedCount} incobrable${yld.defaultedCount !== 1 ? 's' : ''}`}
                    </p>
                </div>

                <div className={cn(
                    "grid gap-3",
                    hasDefaulted ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3",
                )}>
                    <YieldStat
                        icon={<Wallet className="h-3.5 w-3.5" />}
                        label="Cobrada"
                        amount={yld.interestCollected}
                        color="text-accent-positive"
                    />
                    <YieldStat
                        icon={<Clock className="h-3.5 w-3.5" />}
                        label="Por cobrar"
                        amount={yld.interestRemaining}
                        color="text-foreground"
                    />
                    <YieldStat
                        icon={<TrendingUp className="h-3.5 w-3.5" />}
                        label="Total contractual"
                        amount={yld.interestContractual}
                        color="text-muted-foreground"
                    />
                    {hasDefaulted && (
                        <YieldStat
                            icon={<XCircle className="h-3.5 w-3.5" />}
                            label="Pérdida"
                            amount={totalLoss}
                            color="text-accent-danger"
                            isLoss
                        />
                    )}
                </div>

                {hasDefaulted && (
                    <p className="text-[10px] text-muted-foreground">
                        Capital perdido{' '}
                        <PrivateAmount>
                            <span className="text-accent-danger font-medium tabular-nums">{formatCurrency(yld.principalLost)}</span>
                        </PrivateAmount>
                        {' · '}interés no cobrable{' '}
                        <PrivateAmount>
                            <span className="text-accent-danger font-medium tabular-nums">{formatCurrency(yld.interestLost)}</span>
                        </PrivateAmount>
                    </p>
                )}

                {yld.interestContractual > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 bg-muted/40 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent-positive rounded-full transition-all"
                                style={{ width: `${Math.min(collectedPct, 100)}%` }}
                            />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                            {collectedPct.toFixed(0)}% cobrado
                        </span>
                    </div>
                )}
            </div>
        </Card>
    )
}

function YieldStat({
    icon,
    label,
    amount,
    color,
    isLoss,
}: {
    icon: React.ReactNode
    label: string
    amount: number
    color: string
    isLoss?: boolean
}) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <span className={color}>{icon}</span>
                <span>{label}</span>
            </div>
            <PrivateAmount>
                <p className={cn('text-lg font-bold tabular-nums leading-tight', color)}>
                    {isLoss && amount > 0 ? '−' : ''}{formatCurrency(amount)}
                </p>
            </PrivateAmount>
        </div>
    )
}
