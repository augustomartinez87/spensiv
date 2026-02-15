'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import { Calendar, TrendingUp, CreditCard, Banknote } from 'lucide-react'

export default function ProjectionsPage() {
    const { data: projection, isLoading } = trpc.dashboard.getBalanceProjection.useQuery({
        months: 6
    })

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-[400px] w-full" />
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        )
    }

    const chartData = projection?.map(p => ({
        name: p.period,
        Total: p.totalExpense,
        Cuotas: p.installments.length,
        Incomes: p.totalIncome,
        Neto: p.totalIncome - p.totalExpense
    })) || []

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Proyección de Cashflow</h1>
                <p className="text-muted-foreground mt-1">Escalera de cuotas y balance neto para los próximos 6 meses</p>
            </div>

            {/* Main Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Consolidado Mensual
                    </CardTitle>
                    <CardDescription>Comparativa de ingresos recurrentes vs. vencimientos de cuotas</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(228 10% 20%)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(228 5% 55%)', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(228 5% 55%)', fontSize: 12 }}
                                    tickFormatter={(val) => `$${(val / 1000)}k`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'hsl(228 14% 14%)' }}
                                    contentStyle={{
                                        backgroundColor: 'hsl(228 14% 12%)',
                                        border: '1px solid hsl(228 10% 20%)',
                                        borderRadius: '8px',
                                        color: 'hsl(0 0% 95%)',
                                    }}
                                    itemStyle={{ color: 'hsl(0 0% 95%)' }}
                                    labelStyle={{ color: 'hsl(0 0% 95%)' }}
                                    formatter={(val: number) => [formatCurrency(val), '']}
                                />
                                <Legend iconType="circle" />
                                <Bar dataKey="Total" name="Gasto Cuotas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Incomes" name="Ingresos Estimados" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Projections Table */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {projection?.map((p, idx) => {
                    const isDeficit = (p.totalIncome - p.totalExpense) < 0
                    return (
                        <Card key={idx} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2 border-b bg-muted">
                                <div className="flex items-center justify-between">
                                    <p className="font-bold text-foreground">{p.period}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-secondary rounded text-muted-foreground">
                                        {p.installments.length} CUOTAS
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Banknote className="h-4 w-4" /> Ingresos
                                    </div>
                                    <span className="font-semibold text-green-400">{formatCurrency(p.totalIncome)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CreditCard className="h-4 w-4" /> Tarjetas
                                    </div>
                                    <span className="font-semibold text-blue-400">{formatCurrency(p.totalExpense)}</span>
                                </div>
                                <div className="pt-3 border-t flex justify-between items-center">
                                    <span className="text-sm font-bold text-foreground">Saldo Final</span>
                                    <span className={cn("text-lg font-black", isDeficit ? "text-red-400" : "text-foreground")}>
                                        {formatCurrency(p.totalIncome - p.totalExpense)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
