'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Banknote, Clock, AlertCircle, Infinity } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculatePersonScore } from '@/lib/loan-scoring'
import { loanRateInfo } from './helpers'
import { CreateLoanDialog } from './create-loan-dialog'
import { PreApprovedLoanCard } from './pre-approved-loan-card'

export function LoanListContent({ onSelect, direction }: { onSelect: (id: string) => void; direction: 'lender' | 'borrower' }) {
    const utils = trpc.useUtils()
    const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'refinanced'>('active')
    const { data: loans, isLoading } = trpc.loans.list.useQuery({ direction, status: statusFilter })
    const [createOpen, setCreateOpen] = useState(false)

    const confirmMutation = trpc.loans.confirmPreApproved.useMutation({
        onSuccess: () => {
            utils.loans.list.invalidate()
            utils.loans.getDashboardMetrics.invalidate()
        },
    })

    const deleteMutation = trpc.loans.delete.useMutation({
        onSuccess: () => {
            utils.loans.list.invalidate()
            utils.loans.getDashboardMetrics.invalidate()
        },
    })

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </div>
        )
    }

    if (!loans || loans.length === 0) {
        const emptyLabel =
            statusFilter === 'completed' ? 'Sin préstamos finalizados' :
                statusFilter === 'refinanced' ? 'Sin préstamos refinanciados' :
                    direction === 'lender' ? 'Sin préstamos' : 'Sin deudas'
        const emptySubLabel =
            statusFilter !== 'active' ? null :
                direction === 'lender' ? 'Creá tu primer préstamo o usa el simulador' : 'Registrá una deuda que tengas con alguien'

        return (
            <div className="space-y-4">
                {/* Status filter toggle — shown even when empty */}
                <div className="flex bg-muted rounded-lg p-0.5 w-fit">
                    {(['active', 'completed', 'refinanced'] as const).map((s) => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'active' ? 'Activos' : s === 'completed' ? 'Finalizados' : 'Refinanciados'}
                        </Button>
                    ))}
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium text-foreground">{emptyLabel}</p>
                        {emptySubLabel && (
                            <p className="text-sm text-muted-foreground mt-1 mb-4">{emptySubLabel}</p>
                        )}
                        {statusFilter === 'active' && (
                            <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    const preApproved = loans.filter((l) => l.status === 'pre_approved')
    const otherLoans = loans.filter((l) => l.status !== 'pre_approved')

    return (
        <div className="space-y-6">
            {/* Status filter toggle + create button */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex bg-muted rounded-lg p-0.5 w-fit">
                    {(['active', 'completed', 'refinanced'] as const).map((s) => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'active' ? 'Activos' : s === 'completed' ? 'Finalizados' : 'Refinanciados'}
                        </Button>
                    ))}
                </div>
                <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
            </div>

            {/* Pre-approved section */}
            {preApproved.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <h2 className="text-sm font-semibold text-accent-warning uppercase tracking-wider">
                            Preaprobados
                        </h2>
                        <Badge variant="outline" className="text-accent-warning border-amber-600 text-[10px]">
                            {preApproved.length}
                        </Badge>
                    </div>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                        {preApproved.map((loan) => (
                            <PreApprovedLoanCard
                                key={loan.id}
                                loan={loan}
                                onConfirm={(loanId, startDate) => confirmMutation.mutate({ loanId, startDate })}
                                onDelete={(id) => deleteMutation.mutate({ id })}
                                isConfirming={confirmMutation.isPending}
                                isDeleting={deleteMutation.isPending}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {otherLoans.map((loan) => {
                    const now = new Date()
                    const nextDue = loan.nextDueDate ? new Date(loan.nextDueDate) : null
                    const isOverdue = nextDue && nextDue < now
                    const isInterestOnly = loan.loanType === 'interest_only'
                    const isZeroRate = Number(loan.monthlyRate) === 0
                    const progress = !isInterestOnly && loan.totalCount > 0 ? (loan.paidCount / loan.totalCount) * 100 : 0
                    const cur = loan.currency

                    // Parse title/subtitle from borrowerName
                    let cardTitle: string
                    let cardSubtitle: string | null = null
                    if (loan.person) {
                        cardTitle = loan.person.name || loan.person.alias || loan.borrowerName
                        // Remove person name from borrowerName to get subtitle
                        const parts = loan.borrowerName.split(' - ')
                        if (parts.length > 1) {
                            const personName = loan.person.name || loan.person.alias || ''
                            cardSubtitle = parts.filter(p => p.trim() !== personName.trim()).join(' - ') || null
                        }
                    } else {
                        const parts = loan.borrowerName.split(' - ')
                        cardTitle = parts[0]
                        cardSubtitle = parts.length > 1 ? parts.slice(1).join(' - ') : null
                    }

                    // Collect chips
                    const chips: { label: string; variant?: 'destructive' | 'outline' }[] = []
                    if (isInterestOnly) {
                        chips.push({ label: isZeroRate ? 'Sin intereses' : 'Solo interés', variant: 'outline' })
                    }
                    if (cur !== 'ARS') {
                        chips.push({ label: cur, variant: 'outline' })
                    }
                    if (Number(loan.tna) > 1.5) {
                        chips.push({ label: 'TNA >150%', variant: 'destructive' })
                    }
                    if (loan.person) {
                        const scoreResult = calculatePersonScore(loan.person)
                        if (scoreResult.score < 4) {
                            chips.push({ label: 'Alto riesgo', variant: 'destructive' })
                        }
                    }

                    return (
                        <Card
                            key={loan.id}
                            className="cursor-pointer hover:border-primary/50 transition-all duration-200 flex flex-col"
                            onClick={() => onSelect(loan.id)}
                        >
                            <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
                                {/* NIVEL 1 — Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <TooltipProvider>
                                            <UITooltip>
                                                <TooltipTrigger asChild>
                                                    <h3 className="font-bold text-lg text-foreground truncate">{cardTitle}</h3>
                                                </TooltipTrigger>
                                                {cardTitle.length > 18 && (
                                                    <TooltipContent><p>{cardTitle}</p></TooltipContent>
                                                )}
                                            </UITooltip>
                                        </TooltipProvider>
                                        {cardSubtitle && (
                                            <p className="text-sm text-muted-foreground truncate">{cardSubtitle}</p>
                                        )}
                                    </div>
                                    <Badge
                                        variant={
                                            loan.status === 'active' ? 'default' :
                                                loan.status === 'completed' ? 'secondary' :
                                                    loan.status === 'refinanced' ? 'secondary' : 'destructive'
                                        }
                                        className="shrink-0"
                                    >
                                        {loan.status === 'active' ? 'Activo' :
                                            loan.status === 'completed' ? 'Completado' :
                                                loan.status === 'refinanced' ? 'Refinanciado' : 'Moroso'}
                                    </Badge>
                                </div>

                                {/* NIVEL 2 — Info + Chips */}
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        {formatCurrency(Number(loan.capital), cur)}
                                        {' · '}
                                        {isInterestOnly
                                            ? isZeroRate ? 'Sin plazo fijo' : 'Solo interés'
                                            : `${loan.termMonths} meses`
                                        }
                                    </p>
                                    {chips.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {chips.map((chip) => (
                                                <Badge key={chip.label} variant={chip.variant || 'outline'} className="text-[10px] px-1.5 py-0">
                                                    {chip.label}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* NIVEL 3 — Footer */}
                                {/* Progress bar - only for amortized */}
                                {!isInterestOnly && (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Cuotas pagadas</span>
                                            <span className="font-medium text-foreground">{loan.paidCount}/{loan.totalCount}</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-500"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Next due for amortized */}
                                {nextDue && loan.status === 'active' && !isInterestOnly && (
                                    <div className={cn(
                                        "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
                                        isOverdue
                                            ? "bg-red-500/10 text-red-400"
                                            : "bg-muted text-muted-foreground"
                                    )}>
                                        {isOverdue ? (
                                            <AlertCircle className="h-4 w-4 shrink-0" />
                                        ) : (
                                            <Clock className="h-4 w-4 shrink-0" />
                                        )}
                                        <span className="text-xs">
                                            {isOverdue ? 'Vencida: ' : 'Próxima: '}
                                            {format(nextDue, "d 'de' MMM", { locale: es })} · {formatCurrency(loan.nextAmount, cur)}
                                        </span>
                                    </div>
                                )}

                                {/* Interest-only info */}
                                {isInterestOnly && loan.status === 'active' && (
                                    <div className={cn(
                                        "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
                                        isZeroRate
                                            ? "bg-green-500/10 text-green-400"
                                            : "bg-blue-500/10 text-blue-400"
                                    )}>
                                        <Infinity className="h-4 w-4 shrink-0" />
                                        <span className="text-xs">
                                            {isZeroRate
                                                ? `Capital: ${formatCurrency(Number(loan.capital), cur)}`
                                                : `Interés mensual: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                                            }
                                        </span>
                                    </div>
                                )}

                                {(() => {
                                    const ri = loanRateInfo(loan)
                                    return (
                                        <div className="grid grid-cols-2 text-xs text-muted-foreground border-t border-border/50 pt-2 mt-auto">
                                            <span>
                                                {isInterestOnly
                                                    ? isZeroRate ? 'Sin intereses' : `${(ri.tem * 100).toFixed(2)}% TEM`
                                                    : `Cuota: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                                                }
                                            </span>
                                            <span className="text-right">
                                                {isZeroRate
                                                    ? 'TNA: 0%'
                                                    : `TNA ${(ri.tna * 100).toFixed(1)}%`
                                                }
                                            </span>
                                        </div>
                                    )
                                })()}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
