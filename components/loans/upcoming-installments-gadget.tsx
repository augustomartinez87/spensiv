'use client'

import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function UpcomingInstallmentsGadget() {
    const { data: metrics } = trpc.loans.getDashboardMetrics.useQuery()

    if (!metrics || metrics.upcomingInstallments.length === 0) return null

    const now = new Date()

    // Filter out $0 installments (no-interest, no-term loans)
    const installments = metrics.upcomingInstallments.filter((inst) => inst.amount > 0)

    if (installments.length === 0) return null

    return (
        <Card className="h-fit sticky top-20">
            <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Próximas cuotas</p>
                <div className="space-y-3">
                    {installments.map((inst) => {
                        const dueDate = new Date(inst.dueDate)
                        const isOverdue = dueDate < now
                        return (
                            <div key={inst.id} className="flex items-center gap-2.5">
                                <div className={cn(
                                    'flex flex-col items-center justify-center h-9 w-9 rounded-lg shrink-0',
                                    isOverdue ? 'bg-red-500/10' : 'bg-muted'
                                )}>
                                    <span className={cn(
                                        'text-[8px] font-bold uppercase leading-none',
                                        isOverdue ? 'text-red-500' : 'text-muted-foreground'
                                    )}>
                                        {format(dueDate, 'MMM', { locale: es })}
                                    </span>
                                    <span className="text-sm font-bold text-foreground leading-none">
                                        {format(dueDate, 'd')}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{inst.borrowerName}</p>
                                    <p className={cn(
                                        'text-[10px]',
                                        isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
                                    )}>
                                        #{inst.number}{isOverdue ? ' · VENCIDA' : ''}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-bold text-foreground">
                                        {formatCurrency(inst.amount, inst.currency)}
                                    </p>
                                    {inst.currency !== 'ARS' && (
                                        <p className="text-[10px] text-muted-foreground">{inst.currency}</p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
