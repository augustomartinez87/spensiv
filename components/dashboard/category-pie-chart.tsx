'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { MoreHorizontal } from 'lucide-react'

interface CategoryData {
    name: string
    value: number
    color: string
}

interface CategoryPieChartProps {
    data: Record<string, number>
    title: string
}

const COLORS = [
    '#3B82F6', // blue
    '#EF4444', // red
    '#F59E0B', // amber
    '#10B981', // green
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#6366F1', // indigo
    '#14B8A6', // teal
]

export function CategoryPieChart({ data, title }: CategoryPieChartProps) {
    const chartData: CategoryData[] = Object.entries(data).map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length],
    }))

    const total = chartData.reduce((sum, item) => sum + item.value, 0)

    return (
        <Card className="hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No hay datos para mostrar
                    </div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    innerRadius={55}
                                    outerRadius={75}
                                    fill="#8884d8"
                                    dataKey="value"
                                    strokeWidth={2}
                                    stroke="hsl(var(--card))"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px',
                                        color: 'hsl(var(--foreground))',
                                        fontSize: '13px',
                                    }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <text
                                    x="50%"
                                    y="48%"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="fill-foreground text-lg font-bold"
                                >
                                    {formatCurrency(total)}
                                </text>
                                <text
                                    x="50%"
                                    y="58%"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="fill-muted-foreground text-xs"
                                >
                                    Total
                                </text>
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                            {chartData.map((item, index) => {
                                const percentage = ((item.value / total) * 100).toFixed(1)
                                return (
                                    <div key={index} className="flex items-center gap-1.5 text-xs">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-muted-foreground">
                                            {item.name}
                                        </span>
                                        <span className="font-medium text-foreground">
                                            {percentage}%
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
