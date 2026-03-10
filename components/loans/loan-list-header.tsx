'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Banknote, CalendarDays } from 'lucide-react'
import { CreateLoanDialog } from './create-loan-dialog'

export function LoanListHeader({ view, onViewChange, direction }: { view: 'list' | 'calendar'; onViewChange: (v: 'list' | 'calendar') => void; direction: 'lender' | 'borrower' }) {
    const [createOpen, setCreateOpen] = useState(false)

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    {direction === 'lender' ? 'Préstamos' : 'Mis Deudas'}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {direction === 'lender' ? 'Gestioná tus préstamos personales' : 'Controlá lo que debés'}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex bg-muted rounded-lg p-0.5">
                    <Button
                        variant={view === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8"
                        onClick={() => onViewChange('list')}
                    >
                        <Banknote className="h-4 w-4 mr-1.5" />
                        Lista
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
                </div>
                <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
            </div>
        </div>
    )
}
