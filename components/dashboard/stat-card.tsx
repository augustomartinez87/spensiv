'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: number
    count?: number
    type: 'income' | 'expense' | 'balance'
    previousValue?: number
    currency?: string
}

export function StatCard({ title, value, count, type, previousValue }: StatCardProps) {
    const isPositive = value >= 0
    const isBalance = type === 'balance'

    const Icon = type === 'income'
        ? ArrowDownLeft
        : type === 'expense'
            ? ArrowUpRight
            : isPositive
                ? TrendingUp
                : TrendingDown

    const iconBg = isBalance
        ? isPositive ? 'bg-accent-positive/10' : 'bg-accent-danger/10'
        : type === 'income'
            ? 'bg-accent-positive/10'
            : 'bg-accent-warning/10'

    const iconColor = isBalance
        ? isPositive ? 'text-accent-positive' : 'text-accent-danger'
        : type === 'income'
            ? 'text-accent-positive'
            : 'text-accent-warning'

    const valueColor = isBalance
        ? isPositive
            ? 'text-accent-positive'
            : 'text-accent-danger'
        : type === 'income'
            ? 'text-accent-positive'
            : 'text-foreground'

    const variation = previousValue !== undefined && previousValue !== 0
        ? ((value - previousValue) / Math.abs(previousValue)) * 100
        : null

    const hasPreviousData = previousValue !== undefined && previousValue !== 0

    return (
        <Card className="hover:shadow-md">
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className={cn('p-2.5 rounded-xl', iconBg)}>
                        <Icon className={cn('h-5 w-5', iconColor)} />
                    </div>
                    {hasPreviousData ? (
                        <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            variation !== null && variation >= 0
                                ? 'bg-[hsl(var(--accent-positive))]/15 text-accent-positive'
                                : 'bg-[hsl(var(--accent-danger))]/15 text-accent-danger'
                        )}>
                            {variation !== null && variation >= 0 ? '+' : ''}{variation?.toFixed(1) || 0}%
                        </span>
                    ) : (
                        <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            Sin datos previos
                        </span>
                    )}
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
                <div className={cn('text-3xl font-bold tracking-tight', valueColor)}>
                    {isBalance && !isPositive && '-'}
                    ${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {count !== undefined && (
                    <p className="text-xs text-muted-foreground mt-2">
                        {count} {count === 1 ? 'movimiento' : 'movimientos'}
                    </p>
                )}
                {isBalance && (
                    <p className={cn('text-xs font-medium mt-2', isPositive ? 'text-accent-positive' : 'text-accent-danger')}>
                        {isPositive ? 'Superavit' : 'Deficit'}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
