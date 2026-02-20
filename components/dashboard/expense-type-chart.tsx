'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { MoreHorizontal, TrendingDown, TrendingUp } from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts'

interface ExpenseTypeData {
    name: string
    value: number
    color: string
}

interface ExpenseTypeChartProps {
    data: Record<string, number>
    title: string
    previousData?: Record<string, number>
}

const TYPE_COLORS: Record<string, string> = {
    'Estructural': '#1f6c9c',
    'Estructural - Recurrente': '#1f6c9c',
    'Estructural - Impulsivo': '#1f6c9c',
    'Emocional - Recurrente': '#feb92e',
    'Emocional Recurrente': '#feb92e',
    'Recurrente': '#feb92e',
    'Emocional - Impulsivo': '#e54352',
    'Emocional Impulsivo': '#e54352',
    'Impulsivo': '#e54352',
    'Sin clasificar': '#6B7280',
}

const TYPE_LABELS: Record<string, string> = {
    'structural': 'Estructural',
    'emotional_recurrent': 'Recurrente',
    'emotional_impulsive': 'Impulsivo',
    'Estructural': 'Estructural',
    'Estructural - Recurrente': 'Estructural',
    'Estructural - Impulsivo': 'Estructural',
    'Emocional - Recurrente': 'Recurrente',
    'Emocional Recurrente': 'Recurrente',
    'Recurrente': 'Recurrente',
    'Emocional - Impulsivo': 'Impulsivo',
    'Emocional Impulsivo': 'Impulsivo',
    'Impulsivo': 'Impulsivo',
    'Sin clasificar': 'Sin clasificar',
}

export function ExpenseTypeChart({ data, title, previousData }: ExpenseTypeChartProps) {
    // Normalizar los datos
    const normalizedData: ExpenseTypeData[] = Object.entries(data).map(([name, value]) => ({
        name: TYPE_LABELS[name] || name,
        value,
        color: TYPE_COLORS[name] || TYPE_COLORS[TYPE_LABELS[name] || ''] || '#6B7280',
    }))

    // Agrupar por tipo normalizado
    const groupedData = normalizedData.reduce((acc, item) => {
        const existing = acc.find(d => d.name === item.name)
        if (existing) {
            existing.value += item.value
        } else {
            acc.push({ ...item })
        }
        return acc
    }, [] as ExpenseTypeData[])

    // Ordenar: Estructural, Recurrente, Impulsivo
    const order = ['Estructural', 'Recurrente', 'Impulsivo']
    const sortedData = groupedData.sort((a, b) => {
        const indexA = order.indexOf(a.name)
        const indexB = order.indexOf(b.name)
        return indexA - indexB
    })

    const total = sortedData.reduce((sum, item) => sum + item.value, 0)

    // Calcular gasto variable (Recurrente + Impulsivo)
    const variableExpense = sortedData
        .filter(d => d.name === 'Recurrente' || d.name === 'Impulsivo')
        .reduce((sum, d) => sum + d.value, 0)

    // Calcular variación vs mes anterior
    let variation: number | null = null
    if (previousData) {
        const prevNormalized = Object.entries(previousData).map(([name, value]) => ({
            name: TYPE_LABELS[name] || name,
            value,
        }))
        const prevVariable = prevNormalized
            .filter(d => d.name === 'Recurrente' || d.name === 'Impulsivo')
            .reduce((sum, d) => sum + d.value, 0)

        if (prevVariable > 0) {
            variation = ((variableExpense - prevVariable) / prevVariable) * 100
        }
    }

    return (
        <Card className="hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent>
                {sortedData.length === 0 || total === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No hay datos para mostrar
                    </div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={sortedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    formatter={(value: number) => [formatCurrency(value), '']}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                                        color: 'hsl(var(--foreground))',
                                    }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {sortedData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        {/* Resumen de gasto variable */}
                        <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Gasto Variable</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">{formatCurrency(variableExpense)}</span>
                                    {variation !== null && (
                                        <span className={cn(
                                            "text-xs font-medium flex items-center gap-0.5",
                                            variation > 0 ? "text-accent-danger" : "text-accent-positive"
                                        )}>
                                            {variation > 0 ? (
                                                <TrendingUp className="h-3 w-3" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3" />
                                            )}
                                            {variation >= 0 ? '+' : ''}{variation.toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                vs período anterior
                            </p>
                        </div>

                        {/* Leyenda */}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                            {sortedData.map((item) => {
                                const percentage = ((item.value / total) * 100).toFixed(0)
                                return (
                                    <div key={item.name} className="flex items-center gap-1.5 text-xs">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-muted-foreground">{item.name}</span>
                                        <span className="font-medium text-foreground">{percentage}%</span>
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
