'use client'

import { useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn, pluralize } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths as addMonthsFn, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { loanDisplayLabel } from './helpers'

export function InstallmentCalendar({ onSelectLoan }: { onSelectLoan: (id: string) => void }) {
    const { data: loans, isLoading } = trpc.loans.list.useQuery()
    const [currentMonth, setCurrentMonth] = useState(new Date())

    if (isLoading) {
        return <Skeleton className="h-[500px]" />
    }

    // Collect all unpaid installments from active loans
    const allInstallments = (loans || [])
        .filter((l) => l.status === 'active')
        .flatMap((loan) =>
            loan.loanInstallments
                .filter((i) => !i.isPaid)
                .map((i) => ({
                    ...i,
                    dueDate: new Date(i.dueDate),
                    amount: Number(i.amount),
                    borrowerName: loanDisplayLabel(loan),
                    loanId: loan.id,
                    currency: loan.currency,
                }))
        )

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Offset for first day of month (Monday = 0)
    const startDayOfWeek = (getDay(monthStart) + 6) % 7 // Convert Sunday=0 to Monday=0
    const blanks = Array.from({ length: startDayOfWeek })

    // Group installments by day
    const installmentsByDay = new Map<string, typeof allInstallments>()
    for (const inst of allInstallments) {
        const key = format(inst.dueDate, 'yyyy-MM-dd')
        if (!installmentsByDay.has(key)) installmentsByDay.set(key, [])
        installmentsByDay.get(key)!.push(inst)
    }

    // Monthly totals
    const monthInstallments = allInstallments.filter(
        (i) => isSameMonth(i.dueDate, currentMonth)
    )
    const monthTotal = monthInstallments.reduce((s, i) => s + i.amount, 0)

    const now = new Date()

    // Borrower color mapping
    const borrowerNames = [...new Set((loans || []).map(loanDisplayLabel))]
    const colorPalette = [
        'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
        'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
    ]
    const borrowerColors = new Map(borrowerNames.map((name, i) => [name, colorPalette[i % colorPalette.length]]))

    return (
        <div className="space-y-4">
            {/* Month nav + summary */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-foreground capitalize">
                                {format(currentMonth, 'MMMM yyyy', { locale: es })}
                            </h2>
                            {monthTotal > 0 && (
                                <p className="text-sm text-muted-foreground">
                                    {monthInstallments.length} {pluralize(monthInstallments.length, 'cuota')} - {formatCurrency(monthTotal)} a cobrar
                                </p>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonthsFn(currentMonth, 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((d) => (
                            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {blanks.map((_, i) => (
                            <div key={`blank-${i}`} className="h-20 md:h-24" />
                        ))}
                        {days.map((day) => {
                            const key = format(day, 'yyyy-MM-dd')
                            const dayInsts = installmentsByDay.get(key) || []
                            const isToday = isSameDay(day, now)
                            const hasOverdue = dayInsts.some((i) => i.dueDate < now)

                            return (
                                <div
                                    key={key}
                                    className={cn(
                                        "h-20 md:h-24 rounded-lg border p-1 transition-colors",
                                        isToday ? "border-primary bg-primary/5" : "border-border/50",
                                        dayInsts.length > 0 && "hover:border-primary/50"
                                    )}
                                >
                                    <span className={cn(
                                        "text-xs font-medium",
                                        isToday ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    <div className="mt-0.5 space-y-0.5 overflow-hidden">
                                        {dayInsts.slice(0, 2).map((inst) => (
                                            <button
                                                key={inst.id}
                                                onClick={() => onSelectLoan(inst.loanId)}
                                                className={cn(
                                                    "w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-opacity hover:opacity-80",
                                                    hasOverdue && inst.dueDate < now
                                                        ? "bg-red-500/15 text-red-400"
                                                        : "bg-primary/10 text-primary"
                                                )}
                                                title={`${inst.borrowerName} - ${formatCurrency(inst.amount, inst.currency)}`}
                                            >
                                                <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle", borrowerColors.get(inst.borrowerName))} />
                                                <span className="hidden md:inline">{inst.borrowerName} </span>
                                                {formatCurrency(inst.amount, inst.currency)}
                                            </button>
                                        ))}
                                        {dayInsts.length > 2 && (
                                            <p className="text-[9px] text-muted-foreground text-center">+{dayInsts.length - 2} más</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* List below calendar for current month */}
            {monthInstallments.length > 0 && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm font-semibold">Cuotas del mes</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                        <div className="space-y-1">
                            {monthInstallments
                                .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
                                .map((inst) => {
                                    const isOverdue = inst.dueDate < now
                                    return (
                                        <button
                                            key={inst.id}
                                            onClick={() => onSelectLoan(inst.loanId)}
                                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                                        >
                                            <div className={cn(
                                                "flex flex-col items-center justify-center h-10 w-10 rounded-lg shrink-0",
                                                isOverdue ? "bg-red-900/30" : "bg-muted"
                                            )}>
                                                <span className={cn(
                                                    "text-[9px] font-bold uppercase leading-none",
                                                    isOverdue ? "text-red-500" : "text-muted-foreground"
                                                )}>
                                                    {format(inst.dueDate, 'MMM', { locale: es })}
                                                </span>
                                                <span className="text-base font-bold text-foreground leading-none">
                                                    {format(inst.dueDate, 'd')}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground">{inst.borrowerName}</p>
                                                <p className={cn(
                                                    "text-xs",
                                                    isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                                                )}>
                                                    Cuota {inst.number} {isOverdue && '- VENCIDA'}
                                                </p>
                                            </div>
                                            <p className="text-sm font-bold text-foreground shrink-0">
                                                {formatCurrency(inst.amount, inst.currency)}
                                            </p>
                                        </button>
                                    )
                                })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
