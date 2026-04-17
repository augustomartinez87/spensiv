'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { CalendarDays, LayoutList, Users, CalendarClock } from 'lucide-react'
import { CreateLoanDialog } from './create-loan-dialog'
import { UpcomingInstallmentsDrawer } from './upcoming-installments-gadget'

interface LoanListHeaderProps {
    view: 'table' | 'calendar' | 'collector'
    onViewChange: (v: 'table' | 'calendar' | 'collector') => void
    direction: 'lender' | 'borrower'
    tab: 'lender' | 'borrower'
    onTabChange: (t: 'lender' | 'borrower') => void
}

export function LoanListHeader({ view, onViewChange, direction, tab, onTabChange }: LoanListHeaderProps) {
    const [createOpen, setCreateOpen] = useState(false)
    const showDrawer = view !== 'collector' && tab === 'lender'

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {direction === 'lender' ? 'Préstamos' : 'Mis Deudas'}
                </h1>
                {view !== 'collector' && (
                    <SegmentedControl<'lender' | 'borrower'>
                        value={tab}
                        onValueChange={onTabChange}
                        options={[
                            { value: 'lender', label: 'Prestamista' },
                            { value: 'borrower', label: 'Deudor' },
                        ]}
                        size="sm"
                    />
                )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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
                {showDrawer && (
                    <UpcomingInstallmentsDrawer
                        trigger={
                            <Button variant="outline" size="icon" className="h-8 w-8" title="Próximas cuotas">
                                <CalendarClock className="h-4 w-4" />
                            </Button>
                        }
                    />
                )}
                <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
            </div>
        </div>
    )
}
