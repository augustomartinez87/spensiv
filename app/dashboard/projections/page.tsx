'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { Calendar, TrendingUp, CreditCard, Banknote, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ProjectionChart = dynamic(
    () => import('@/components/dashboard/projection-chart').then(m => m.ProjectionChart),
    { ssr: false, loading: () => <div className="h-[400px] w-full animate-pulse bg-muted rounded-lg" /> }
)

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

    const chartData = projection?.map(p => {
        const [year, month] = p.period.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return {
            name: format(date, 'MMM yyyy', { locale: es }),
            period: p.period,
            Total: p.totalExpense,
            Cuotas: p.installments.length,
            Incomes: p.totalIncomeWithProjection,
            Neto: p.balanceWithProjection
        }
    }) || []

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
                        <ProjectionChart data={chartData} />
                    </div>
                </CardContent>
            </Card>

            {/* Projections Table */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {projection?.map((p, idx) => {
                    const isDeficit = p.balanceWithProjection < 0
                    const [year, month] = p.period.split('-')
                    const date = new Date(parseInt(year), parseInt(month) - 1)
                    return (
                        <Card key={idx} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2 border-b bg-muted">
                                <div className="flex items-center justify-between">
                                    <p className="font-bold text-foreground">{format(date, 'MMMM yyyy', { locale: es })}</p>
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
                                    <div className="flex items-center gap-2">
                                        {p.hasProjectedIncome && (
                                            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Sparkles className="h-3 w-3" />
                                                Proyectado
                                            </span>
                                        )}
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                            {formatCurrency(p.totalIncomeWithProjection)}
                                        </span>
                                    </div>
                                </div>
                                {p.hasProjectedIncome && p.actualIncome > 0 && (
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>Registrado:</span>
                                        <span>{formatCurrency(p.actualIncome)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CreditCard className="h-4 w-4" /> Tarjetas
                                    </div>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(p.totalExpense)}</span>
                                </div>
                                <div className="pt-3 border-t flex justify-between items-center">
                                    <span className="text-sm font-bold text-foreground">Saldo Final</span>
                                    <span className={cn("text-lg font-black", isDeficit ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                                        {formatCurrency(p.balanceWithProjection)}
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
