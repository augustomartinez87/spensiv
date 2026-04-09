'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PrivateAmount } from '@/lib/contexts/privacy-context'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'

interface StatCardProps {
    title: string
    value: number
    count?: number
    type: 'income' | 'expense' | 'balance'
    previousValue?: number
    currency?: string
    dailyAverage?: number
    nextEstimatedDate?: string
    sparklineData?: number[]
}

function fmtAvg(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
    return `$${Math.round(n)}`
}

export function StatCard({
    title,
    value,
    count,
    type,
    previousValue,
    dailyAverage,
    nextEstimatedDate,
    sparklineData,
}: StatCardProps) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const isPositive = value >= 0
    const isBalance = type === 'balance'

    const valueColor = isBalance
        ? isPositive
            ? 'text-accent-positive'
            : 'text-accent-danger'
        : 'text-foreground'

    const variation = previousValue !== undefined && previousValue !== 0
        ? ((value - previousValue) / Math.abs(previousValue)) * 100
        : null

    const hasPreviousData = previousValue !== undefined && previousValue !== 0

    const sparkColor = type === 'expense'
        ? 'hsl(var(--accent-danger))'
        : 'hsl(var(--accent-positive))'
    const sparkPoints = (sparklineData ?? []).map((v, i) => ({ v, i }))

    // Badge color logic: expenses up = bad, income up = good
    const isVariationGood = type === 'expense'
        ? variation !== null && variation <= 0
        : variation !== null && variation >= 0

    return (
        <Card className="hover:shadow-md h-full min-h-[176px] relative overflow-hidden">
            <CardContent className="p-5 flex flex-col h-full relative z-10">
                {/* Row 1: title + badge */}
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground leading-snug">{title}</p>
                    {hasPreviousData ? (
                        <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-0.5 border',
                            isVariationGood
                                ? 'bg-accent-positive/10 text-accent-positive border-accent-positive/20'
                                : 'bg-accent-danger/10 text-accent-danger border-accent-danger/20'
                        )}>
                            {variation !== null && variation > 0 ? '↑' : variation !== null && variation < 0 ? '↓' : ''}{Math.abs(variation ?? 0).toFixed(1)}%
                        </span>
                    ) : (
                        <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 border border-border">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            Sin datos previos
                        </span>
                    )}
                </div>

                {/* Row 2: main value */}
                <PrivateAmount>
                    <div className={cn('text-3xl sm:text-4xl font-bold tracking-tighter break-all mt-3 tabular-nums', valueColor)}>
                        {isBalance && !isPositive && '-'}
                        ${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                </PrivateAmount>

                {/* Row 3: footer insights */}
                <div className="mt-auto pt-3 border-t border-border/50 flex justify-between items-end">
                    {type === 'expense' && (
                        <>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                {dailyAverage !== undefined && <>Prom: <span className="text-foreground font-medium">{fmtAvg(dailyAverage)}/día</span></>}
                            </span>
                            {count !== undefined && (
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {count} {count === 1 ? 'mov.' : 'movs.'}
                                </span>
                            )}
                        </>
                    )}
                    {type === 'income' && (
                        <>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                {count !== undefined && <>{count} {count === 1 ? 'movimiento' : 'movimientos'}</>}
                            </span>
                            {nextEstimatedDate && (
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    Próx: <span className="text-foreground font-medium">~{nextEstimatedDate}</span>
                                </span>
                            )}
                        </>
                    )}
                    {isBalance && (
                        <p className={cn('text-xs font-medium', isPositive ? 'text-accent-positive' : 'text-accent-danger')}>
                            {isPositive ? 'Superávit' : 'Déficit'}
                        </p>
                    )}
                </div>
            </CardContent>

            {/* Background sparkline — positioned absolute behind content */}
            {mounted && sparkPoints.length > 1 && (
                <div className="absolute bottom-12 left-0 right-0 h-16 opacity-40 pointer-events-none">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={sparkPoints}
                            margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                        >
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={sparkColor}
                                fill={sparkColor}
                                fillOpacity={0.15}
                                strokeWidth={1.5}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Card>
    )
}
