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
    selectedCategory?: string | null
    onCategoryClick?: (category: string | null) => void
}

// Paleta semántica por categoría:
// Azul (#1f6c9c) = estable/necesario, Amarillo (#feb92e) = cuidado, Rojo (#e54352) = indulgente/riesgo
const CATEGORY_COLORS: Record<string, string> = {
    'Gastos Fijos': '#1f6c9c',      // azul — estructural
    'Servicios': '#2a89bf',          // azul claro — necesario
    'Transporte': '#348bb5',         // azul medio — necesario
    'Educacion': '#7c3aed',          // violeta — inversión / conocimiento
    'Educación': '#7c3aed',          // violeta — inversión / conocimiento
    'Salud': '#feb92e',              // amarillo — importante pero variable
    'Comida': '#e8a820',             // amarillo oscuro — necesario pero controlable
    'Compras': '#f0953a',            // naranja — cuidado
    'Deudas': '#feb92e',             // amarillo — precaución
    'Lujos': '#e54352',              // rojo — indulgente
    'Ingresos': '#22c55e',           // verde — positivo
}

const FALLBACK_COLORS = [
    '#1f6c9c', '#feb92e', '#e54352', '#2a89bf', '#e8a820',
    '#f0953a', '#348bb5', '#d63944',
]

export function CategoryPieChart({ data, title, selectedCategory, onCategoryClick }: CategoryPieChartProps) {
    const chartData: CategoryData[] = Object.entries(data).map(([name, value], index) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
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
                                    style={{ cursor: onCategoryClick ? 'pointer' : undefined }}
                                    onClick={(_, index) => {
                                        if (!onCategoryClick) return
                                        const clicked = chartData[index]?.name
                                        onCategoryClick(selectedCategory === clicked ? null : clicked)
                                    }}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            opacity={selectedCategory && selectedCategory !== entry.name ? 0.4 : 1}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
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
                                const isSelected = !selectedCategory || selectedCategory === item.name
                                return (
                                    <button
                                        key={index}
                                        className="flex items-center gap-1.5 text-xs transition-opacity"
                                        style={{ opacity: isSelected ? 1 : 0.4 }}
                                        onClick={() => onCategoryClick?.(selectedCategory === item.name ? null : item.name)}
                                    >
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
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
