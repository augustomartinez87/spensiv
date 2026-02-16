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
        ? isPositive ? 'bg-cyan-500/10' : 'bg-red-500/10'
        : type === 'income'
            ? 'bg-green-500/10'
            : 'bg-orange-500/10'

    const iconColor = isBalance
        ? isPositive ? 'text-cyan-600 dark:text-cyan-400' : 'text-red-600 dark:text-red-400'
        : type === 'income'
            ? 'text-green-600 dark:text-green-400'
            : 'text-orange-600 dark:text-orange-400'

    const valueColor = isBalance
        ? isPositive
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        : type === 'income'
            ? 'text-green-600 dark:text-green-400'
            : 'text-foreground'

    const variation = previousValue !== undefined && previousValue !== 0
        ? ((value - previousValue) / Math.abs(previousValue)) * 100
        : null

    return (
        <Card className="hover:shadow-md">
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className={cn('p-2.5 rounded-xl', iconBg)}>
                        <Icon className={cn('h-5 w-5', iconColor)} />
                    </div>
                    {variation !== null ? (
                        <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            variation >= 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                            {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                        </span>
                    ) : (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            N/A
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
                    <p className={cn('text-xs font-medium mt-2', isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                        {isPositive ? 'Superavit' : 'Deficit'}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
