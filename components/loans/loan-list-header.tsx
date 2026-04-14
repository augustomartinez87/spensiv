'use client'

import { useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CalendarDays, LayoutList, Users } from 'lucide-react'
import { CreateLoanDialog } from './create-loan-dialog'

function formatCompact(amount: number) {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`
    return formatCurrency(amount)
}

function daysUntilShort(date: Date) {
    const diff = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'hoy'
    if (diff === 1) return 'mañana'
    if (diff < 0) return null
    return `en ${diff} días`
}

function DynamicSubtitle({ direction }: { direction: 'lender' | 'borrower' }) {
    const { data: metrics } = trpc.loans.getDashboardMetrics.useQuery(undefined, {
        enabled: direction === 'lender',
    })

    if (direction === 'borrower' || !metrics || metrics.activeLoansCount === 0) {
        return (
            <p className="text-sm text-muted-foreground mt-0.5">
                {direction === 'lender' ? 'Gestioná tus préstamos personales' : 'Controlá lo que debés'}
            </p>
        )
    }

    const nextInstallment = metrics.upcomingInstallments?.find(
        (i) => new Date(i.dueDate) >= new Date()
    )
    const nextText = nextInstallment ? daysUntilShort(nextInstallment.dueDate) : null

    const morosityColor =
        metrics.morosityPct < 5 ? 'text-green-400' :
        metrics.morosityPct < 10 ? 'text-yellow-400' :
        'text-red-400'

    return (
        <p className="text-sm text-muted-foreground mt-0.5">
            {formatCompact(metrics.totalPending)} pendiente
            <span className="text-muted-foreground/50"> · </span>
            <span className={morosityColor}>{metrics.morosityPct.toFixed(1)}%</span> mora
            {nextText && (
                <>
                    <span className="text-muted-foreground/50"> · </span>
                    próx. cobro {nextText === 'hoy' ? <span className="text-blue-400">{nextText}</span> : nextText}
                </>
            )}
            {!nextText && (
                <>
                    <span className="text-muted-foreground/50"> · </span>
                    sin cobros próximos
                </>
            )}
        </p>
    )
}

interface LoanListHeaderProps {
    view: 'table' | 'calendar' | 'collector'
    onViewChange: (v: 'table' | 'calendar' | 'collector') => void
    direction: 'lender' | 'borrower'
    tab: 'lender' | 'borrower'
    onTabChange: (t: 'lender' | 'borrower') => void
}

export function LoanListHeader({ view, onViewChange, direction, tab, onTabChange }: LoanListHeaderProps) {
    const [createOpen, setCreateOpen] = useState(false)

    return (
        <div className="space-y-3">
            {/* Row 1: Title + view toggle + create button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        {direction === 'lender' ? 'Préstamos' : 'Mis Deudas'}
                    </h1>
                    {view === 'collector' ? (
                        <DynamicSubtitle direction={direction} />
                    ) : (
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {direction === 'lender' ? 'Gestioná tus préstamos personales' : 'Controlá lo que debés'}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-muted rounded-lg p-0.5">
                        <Button
                            variant={view === 'table' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8"
                            onClick={() => onViewChange('table')}
                        >
                            <LayoutList className="h-4 w-4 mr-1.5" />
                            Tabla
                        </Button>
                        <Button
                            variant={view === 'calendar' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8"
                            onClick={() => onViewChange('calendar')}
                        >
                            <CalendarDays className="h-4 w-4 mr-1.5" />
                            Calendario
                        </Button>
                        <Button
                            variant={view === 'collector' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8"
                            onClick={() => onViewChange('collector')}
                        >
                            <Users className="h-4 w-4 mr-1.5" />
                            Cobradores
                        </Button>
                    </div>
                    <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
                </div>
            </div>

            {/* Row 2: Lender/borrower toggle inline (no aplica a cobradores) */}
            {view !== 'collector' && (
                <div className="flex bg-muted/60 rounded-lg p-0.5 w-fit">
                    <Button
                        variant={tab === 'lender' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                            "h-7 text-xs",
                            tab === 'lender' && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        )}
                        onClick={() => onTabChange('lender')}
                    >
                        Soy prestamista
                    </Button>
                    <Button
                        variant={tab === 'borrower' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                            "h-7 text-xs",
                            tab === 'borrower' && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        )}
                        onClick={() => onTabChange('borrower')}
                    >
                        Soy deudor
                    </Button>
                </div>
            )}
        </div>
    )
}
