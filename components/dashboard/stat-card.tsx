'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PrivateAmount } from '@/lib/privacy-context'
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

    const sparkColor = type === 'expense' ? '#e54352' : '#22c55e'
    const sparkPoints = (sparklineData ?? []).map((v, i) => ({ v, i }))

    return (
        <Card className="hover:shadow-md h-full min-h-[160px]">
            <CardContent className="p-5 flex flex-col h-full">
                {/* Fila 1: título + badge */}
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground leading-snug">{title}</p>
                    {hasPreviousData ? (
                        <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5',
                            // For expenses: higher spend = bad (red), lower = good (green)
                            // For income/balance: higher = good (green), lower = bad (red)
                            type === 'expense'
                                ? variation !== null && variation > 0
                                    ? 'bg-[hsl(var(--accent-danger))]/15 text-accent-danger'
                                    : 'bg-[hsl(var(--accent-positive))]/15 text-accent-positive'
                                : variation !== null && variation >= 0
                                    ? 'bg-[hsl(var(--accent-positive))]/15 text-accent-positive'
                                    : 'bg-[hsl(var(--accent-danger))]/15 text-accent-danger'
                        )}>
                            {variation !== null && variation > 0 ? '↑' : variation !== null && variation < 0 ? '↓' : ''}{Math.abs(variation ?? 0).toFixed(1)}%
                        </span>
                    ) : (
                        <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            Sin datos previos
                        </span>
                    )}
                </div>

                {/* Fila 2: valor principal */}
                <PrivateAmount>
                    <div className={cn('text-2xl font-bold tracking-tight break-all mt-2 tabular-nums', valueColor)}>
                        {isBalance && !isPositive && '-'}
                        ${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </PrivateAmount>

                {/* Sparkline */}
                {mounted && sparkPoints.length > 1 && (
                    <div className="h-8 w-full mt-1 -mx-1">
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
                                    fillOpacity={0.08}
                                    strokeWidth={1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Insights */}
                <div className="mt-auto pt-2">
                    {type === 'expense' && (
                        <p className="text-[11px] text-muted-foreground leading-tight tabular-nums">
                            {dailyAverage !== undefined && (
                                <span>Prom: {fmtAvg(dailyAverage)}/día</span>
                            )}
                            {count !== undefined && (
                                <>
                                    <span className="opacity-40"> · </span>
                                    <span>{count} {count === 1 ? 'mov.' : 'movs.'}</span>
                                </>
                            )}
                        </p>
                    )}
                    {type === 'income' && (
                        <p className="text-[11px] text-muted-foreground leading-tight tabular-nums">
                            {count !== undefined && (
                                <span>{count} {count === 1 ? 'movimiento' : 'movimientos'}</span>
                            )}
                            {nextEstimatedDate && (
                                <>
                                    <span className="opacity-40"> · </span>
                                    <span>Próx: ~{nextEstimatedDate}</span>
                                </>
                            )}
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
