'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownCircle, ArrowUpCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: number
    count?: number
    type: 'income' | 'expense' | 'balance'
    currency?: string
}

export function StatCard({ title, value, count, type, currency = 'ARS' }: StatCardProps) {
    const isPositive = value >= 0
    const isBalance = type === 'balance'

    const Icon = type === 'income'
        ? ArrowUpCircle
        : type === 'expense'
            ? ArrowDownCircle
            : isPositive
                ? TrendingUp
                : TrendingDown

    const colorClass = isBalance
        ? isPositive
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        : type === 'income'
            ? 'text-green-600 dark:text-green-400'
            : 'text-blue-600 dark:text-blue-400'

    const bgClass = isBalance
        ? isPositive
            ? 'bg-green-500/10'
            : 'bg-red-500/10'
        : type === 'income'
            ? 'bg-green-500/10'
            : 'bg-blue-500/10'

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className={cn('p-2 rounded-full', bgClass)}>
                    <Icon className={cn('h-4 w-4', colorClass)} />
                </div>
            </CardHeader>
            <CardContent>
                <div className={cn('text-2xl font-bold', colorClass)}>
                    {isBalance && !isPositive && '-'}
                    ${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {count !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {count} {count === 1 ? 'movimiento' : 'movimientos'}
                    </p>
                )}
                {isBalance && (
                    <p className={cn('text-xs font-medium mt-1', colorClass)}>
                        {isPositive ? '✓ Superávit' : '⚠️ Déficit'}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
