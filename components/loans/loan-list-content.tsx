'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Banknote, Clock, Infinity, ChevronRight } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculatePersonScore } from '@/lib/loan-scoring'
import { loanRateInfo } from './helpers'
import { CreateLoanDialog } from './create-loan-dialog'
import { PreApprovedLoanCard } from './pre-approved-loan-card'

/* ── Progress Ring ── */
function ProgressRing({
    paid,
    total,
    color,
}: {
    paid: number
    total: number
    color: string
}) {
    const size = 48
    const strokeWidth = 3.5
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const progress = total > 0 ? paid / total : 0
    const offset = circumference * (1 - progress)

    return (
        <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        className="stroke-muted"
                        strokeWidth={strokeWidth}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                    />
                </svg>
                <span
                    className="absolute inset-0 flex items-center justify-center font-semibold text-foreground select-none"
                    style={{ fontSize: 10 }}
                >
                    {paid}/{total}
                </span>
            </div>
            <span className="text-[9px] text-muted-foreground">cobradas</span>
        </div>
    )
}

/* ── Interest-only status dot ── */
function StatusDot({ color }: { color: string }) {
    return (
        <span
            className="shrink-0 inline-block rounded-full"
            style={{ width: 12, height: 12, backgroundColor: color }}
        />
    )
}

/* ── Ring color logic ── */
function getRingColor(loan: {
    status: string
    paidCount: number
    totalCount: number
    nextDueDate: Date | string | null
    loanType: string
    monthlyRate: { toString(): string }
}) {
    const now = new Date()
    const nextDue = loan.nextDueDate ? new Date(loan.nextDueDate) : null
    const isZeroRateOpen = loan.loanType === 'interest_only' && Number(loan.monthlyRate) === 0
    const isOverdue = !isZeroRateOpen && nextDue && nextDue < now

    if (isOverdue) return '#ef4444' // red

    if (nextDue) {
        const daysUntil = differenceInDays(nextDue, now)
        if (daysUntil < 3) return '#f59e0b' // amber
    }

    if (loan.status === 'completed' || (loan.totalCount > 0 && loan.paidCount === loan.totalCount)) {
        return '#22c55e' // green
    }

    return 'hsl(var(--primary))' // blue / default primary
}

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
                    const isInterestOnly = loan.loanType === 'interest_only'
                    const isZeroRate = Number(loan.monthlyRate) === 0
                    const isZeroRateOpen = isInterestOnly && isZeroRate
                    const isOverdue = !isZeroRateOpen && nextDue && nextDue < now
                    const cur = loan.currency

                    const ringColor = getRingColor(loan)

                    // Parse title/subtitle from borrowerName
                    let cardTitle: string
                    let cardSubtitle: string | null = null
                    if (loan.person) {
                        cardTitle = loan.person.name || loan.person.alias || loan.borrowerName
                        // Remove person name from borrowerName to get subtitle
                        const personName = loan.person.name || loan.person.alias || ''
                        const remaining = loan.borrowerName
                            .split(' - ')
                            .filter(p => p.trim() !== personName.trim())
                            .join(' - ')
                            .trim()
                        cardSubtitle = remaining || null
                        // If borrowerName is entirely different from person name, show it as subtitle
                        if (!cardSubtitle && loan.borrowerName.trim() !== personName.trim()) {
                            cardSubtitle = loan.borrowerName
                        }
                    } else {
                        // Split on " - " or " / " for consistency
                        const parts = loan.borrowerName.split(/\s[-\/]\s/)
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
                            className={cn(
                                "cursor-pointer hover:border-primary/50 transition-all duration-200 flex flex-col",
                                isOverdue && "border-l-4 border-l-red-500"
                            )}
                            onClick={() => onSelect(loan.id)}
                        >
                            <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
                                {/* NIVEL 1 — Header with Progress Ring */}
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
                                    {/* Progress ring or status dot */}
                                    {isInterestOnly ? (
                                        <StatusDot color={ringColor} />
                                    ) : (
                                        <ProgressRing
                                            paid={loan.paidCount}
                                            total={loan.totalCount}
                                            color={ringColor}
                                        />
                                    )}
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

                                {/* NIVEL 3 — Due date info */}
                                {/* Next due for amortized */}
                                {nextDue && loan.status === 'active' && !isInterestOnly && (
                                    <div className={cn(
                                        "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
                                        isOverdue
                                            ? "bg-red-500/10 text-red-400"
                                            : "bg-muted text-muted-foreground"
                                    )}>
                                        <Clock className="h-4 w-4 shrink-0" />
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
                                                ? `Capital pdte: ${formatCurrency(Number(loan.principalOutstanding), cur)}`
                                                : `Interés mensual: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                                            }
                                        </span>
                                    </div>
                                )}

                                {/* Rate info grid */}
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

                                {/* NIVEL 4 — Inline CTA buttons */}
                                <div className="flex items-center justify-between pt-1">
                                    {loan.status === 'active' ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onSelect(loan.id)
                                            }}
                                        >
                                            Registrar cobro
                                        </Button>
                                    ) : (
                                        <span />
                                    )}
                                    <button
                                        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onSelect(loan.id)
                                        }}
                                    >
                                        Ver detalle
                                        <ChevronRight className="h-3 w-3" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
