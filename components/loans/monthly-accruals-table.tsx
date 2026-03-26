'use client'

import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function MonthlyAccrualsTable({ loanId, cur }: { loanId: string; cur: string }) {
    const { data: accruals, isLoading } = trpc.loans.getMonthlyAccruals.useQuery({ loanId })

    if (isLoading) return <Skeleton className="h-40" />

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b text-muted-foreground uppercase tracking-wider">
                                <th className="text-left py-2 px-3 font-medium">Periodo</th>
                                <th className="text-right py-2 px-3 font-medium">Principal Inicial</th>
                                <th className="text-right py-2 px-3 font-medium">Int. Esperado</th>
                                <th className="text-right py-2 px-3 font-medium">Int. Cobrado</th>
                                <th className="text-right py-2 px-3 font-medium">Desvío</th>
                                <th className="text-right py-2 px-3 font-medium">Principal Cobrado</th>
                                <th className="text-right py-2 px-3 font-medium">Mora Cierre</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accruals?.map((a) => (
                                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                    <td className="py-2.5 px-3 font-medium capitalize">
                                        {format(new Date(a.year, a.month - 1), 'MMM yyyy', { locale: es })}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">{formatCurrency(Number(a.openingPrincipal), cur)}</td>
                                    <td className="py-2.5 px-3 text-right text-accent-blue">{formatCurrency(Number(a.interestExpected), cur)}</td>
                                    <td className="py-2.5 px-3 text-right text-accent-positive">{formatCurrency(Number(a.interestCollectedCurrent), cur)}</td>
                                    <td className={cn("py-2.5 px-3 text-right", (() => {
                                        const isFuture = new Date(a.year, a.month - 1) > new Date()
                                        if (isFuture) return 'text-muted-foreground/50'
                                        return Number(a.deviationAmount) < 0 ? 'text-red-400' : 'text-foreground'
                                    })())}>
                                        {(() => {
                                            const isFuture = new Date(a.year, a.month - 1) > new Date()
                                            if (isFuture) return <span className="text-muted-foreground/40 italic">N/A</span>
                                            return formatCurrency(Number(a.deviationAmount), cur)
                                        })()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">{formatCurrency(Number(a.principalCollected), cur)}</td>
                                    <td className={cn("py-2.5 px-3 text-right font-medium", Number(a.overdueInterestClosing) > 0 ? "text-red-400" : "text-foreground")}>
                                        {formatCurrency(Number(a.overdueInterestClosing), cur)}
                                    </td>
                                </tr>
                            ))}
                            {!accruals?.length && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-muted-foreground italic">
                                        Sin datos de contabilidad registrados. Realizá un cobro o recalculá.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
