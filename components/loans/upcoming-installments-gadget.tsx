'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ReactNode } from 'react'

export function UpcomingInstallmentsDrawer({ trigger }: { trigger: ReactNode }) {
    const { data: metrics } = trpc.loans.getDashboardMetrics.useQuery()

    const now = new Date()
    const installments = (metrics?.upcomingInstallments ?? []).filter((inst) => inst.amount > 0)
    const overdueCount = installments.filter((i) => new Date(i.dueDate) < now).length

    return (
        <Sheet>
            <SheetTrigger asChild>
                <div className="relative inline-flex">
                    {trigger}
                    {overdueCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                </div>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        Próximas cuotas
                        {installments.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                                {installments.length}
                            </Badge>
                        )}
                    </SheetTitle>
                </SheetHeader>

                {installments.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-6">Sin cuotas próximas.</p>
                ) : (
                    <div className="space-y-3 mt-6">
                        {installments.map((inst) => {
                            const dueDate = new Date(inst.dueDate)
                            const isOverdue = dueDate < now
                            return (
                                <div key={inst.id} className="flex items-center gap-2.5">
                                    <div className={cn(
                                        'flex flex-col items-center justify-center h-10 w-10 rounded-lg shrink-0',
                                        isOverdue ? 'bg-red-500/10' : 'bg-muted'
                                    )}>
                                        <span className={cn(
                                            'text-[9px] font-bold uppercase leading-none',
                                            isOverdue ? 'text-red-500' : 'text-muted-foreground'
                                        )}>
                                            {format(dueDate, 'MMM', { locale: es })}
                                        </span>
                                        <span className="text-sm font-bold text-foreground leading-none mt-0.5">
                                            {format(dueDate, 'd')}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{inst.borrowerName}</p>
                                        <p className={cn(
                                            'text-xs',
                                            isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
                                        )}>
                                            Cuota #{inst.number}{isOverdue ? ' · VENCIDA' : ''}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-foreground tabular-nums">
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
                )}
            </SheetContent>
        </Sheet>
    )
}
