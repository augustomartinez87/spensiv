'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

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
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No hay datos para mostrar
                    </div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="mt-4 space-y-2">
                            {chartData.map((item, index) => {
                                const percentage = ((item.value / total) * 100).toFixed(1)
                                return (
                                    <div key={index} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span>{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                ${item.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-muted-foreground">({percentage}%)</span>
                                        </div>
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
