'use client'

import { Card, CardContent } from '@/components/ui/card'
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
        <Card className="hover:shadow-md h-full min-h-[140px]">
            <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-xs font-medium text-muted-foreground leading-snug">{title}</p>
                    {hasPreviousData ? (
                        <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
                            variation !== null && variation >= 0
                                ? 'bg-[hsl(var(--accent-positive))]/15 text-accent-positive'
                                : 'bg-[hsl(var(--accent-danger))]/15 text-accent-danger'
                        )}>
                            {variation !== null && variation >= 0 ? '+' : ''}{variation?.toFixed(1) ?? 0}%
                        </span>
                    ) : (
                        <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            Sin datos previos
                        </span>
                    )}
                </div>
                <div className={cn('text-3xl font-bold tracking-tight break-all', valueColor)}>
                    {isBalance && !isPositive && '-'}
                    ${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="mt-2">
                    {count !== undefined && (
                        <p className="text-xs text-muted-foreground">
                            {count} {count === 1 ? 'movimiento' : 'movimientos'}
                        </p>
                    )}
                    {isBalance && (
                        <p className={cn('text-xs font-medium', isPositive ? 'text-accent-positive' : 'text-accent-danger')}>
                            {isPositive ? 'Superavit' : 'Deficit'}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
