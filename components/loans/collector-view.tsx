'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { BulkCollectionMessage } from './bulk-collection-message'
import { loanDisplayLabel } from './helpers'
import type { LoanListItem } from './types'

interface CollectorGroup {
    id: string | null
    name: string
    loans: LoanListItem[]
    totalCapital: number
    totalNextDue: number
    pendingCount: number
}

export function CollectorView({ onSelect }: { onSelect: (id: string) => void }) {
    const { data: loans, isLoading } = trpc.loans.list.useQuery({ direction: 'lender', status: 'active' })

    const groups = useMemo(() => {
        if (!loans) return []

        const map = new Map<string, CollectorGroup>()

        for (const loan of loans) {
            if (loan.status === 'pre_approved') continue

            const key = loan.collector?.id || '__none__'
            if (!map.has(key)) {
                map.set(key, {
                    id: loan.collector?.id || null,
                    name: loan.collector?.name || 'Sin cobrador',
                    loans: [],
                    totalCapital: 0,
                    totalNextDue: 0,
                    pendingCount: 0,
                })
            }
            const group = map.get(key)!
            group.loans.push(loan)
            group.totalCapital += Number(loan.capital)
            if (loan.nextAmount > 0) {
                group.totalNextDue += loan.nextAmount
                group.pendingCount++
            }
        }

        // Sort: collectors first (alphabetically), "Sin cobrador" last
        return Array.from(map.values()).sort((a, b) => {
            if (!a.id && b.id) return 1
            if (a.id && !b.id) return -1
            return a.name.localeCompare(b.name)
        })
    }, [loans])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
        )
    }

    if (groups.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Sin prestamos activos</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {groups.map((group) => (
                <CollectorGroupCard
                    key={group.id || '__none__'}
                    group={group}
                    onSelectLoan={onSelect}
                />
            ))}
        </div>
    )
}

function CollectorGroupCard({
    group,
    onSelectLoan,
}: {
    group: CollectorGroup
    onSelectLoan: (id: string) => void
}) {
    const [expanded, setExpanded] = useState(true)

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                        <div>
                            <CardTitle className="text-base">
                                {group.name}
                            </CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs">
                            {group.loans.length} {group.loans.length === 1 ? 'prestamo' : 'prestamos'}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                            <div className="text-muted-foreground text-xs">Capital</div>
                            <div className="font-semibold">{formatCurrency(group.totalCapital)}</div>
                        </div>
                        {group.pendingCount > 0 && (
                            <div className="text-right text-sm">
                                <div className="text-muted-foreground text-xs">Prox. cobro</div>
                                <div className="font-semibold text-primary">{formatCurrency(group.totalNextDue)}</div>
                            </div>
                        )}
                        {group.id && (
                            <BulkCollectionMessage
                                collectorName={group.name}
                                loans={group.loans}
                            />
                        )}
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="pt-0">
                    <div className="divide-y">
                        {group.loans.map((loan) => {
                            const next = loan.loanInstallments.find((i) => !i.isPaid)
                            const nextDue = next ? new Date(next.dueDate) : null
                            const now = new Date()
                            const isOverdue = nextDue && nextDue < now && Number(loan.monthlyRate) !== 0
                            const daysUntil = nextDue ? differenceInDays(nextDue, now) : null
                            const cur = loan.currency

                            return (
                                <div
                                    key={loan.id}
                                    className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-muted/50 -mx-6 px-6 transition-colors"
                                    onClick={() => onSelectLoan(loan.id)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm truncate">
                                            {loanDisplayLabel(loan)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatCurrency(Number(loan.capital), cur)}
                                            {loan.totalCount > 0 && (
                                                <span> · {loan.paidCount}/{loan.totalCount} cuotas</span>
                                            )}
                                        </div>
                                    </div>
                                    {next && (
                                        <div className="text-right shrink-0 ml-4">
                                            <div className={cn(
                                                "text-sm font-medium",
                                                isOverdue && "text-red-400"
                                            )}>
                                                {formatCurrency(loan.nextAmount, cur)}
                                            </div>
                                            <div className={cn(
                                                "text-xs",
                                                isOverdue ? "text-red-400" : "text-muted-foreground"
                                            )}>
                                                {nextDue && format(nextDue, "d MMM", { locale: es })}
                                                {daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && (
                                                    <span className="ml-1">
                                                        ({daysUntil === 0 ? 'hoy' : daysUntil === 1 ? 'mañana' : `en ${daysUntil}d`})
                                                    </span>
                                                )}
                                                {isOverdue && <span className="ml-1">(vencido)</span>}
                                            </div>
                                        </div>
                                    )}
                                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    )
}
