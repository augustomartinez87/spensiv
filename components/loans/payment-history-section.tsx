'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Banknote, ChevronDown, Check, X, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function PaymentHistorySection({ loanId, cur }: { loanId: string; cur: string }) {
    const utils = trpc.useUtils()
    const { data: payments, isLoading } = trpc.loans.getLoanPayments.useQuery({ loanId })
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editNote, setEditNote] = useState('')

    const updateNoteMutation = trpc.loans.updatePaymentNote.useMutation({
        onSuccess: () => {
            utils.loans.getLoanPayments.invalidate({ loanId })
            setEditingId(null)
        },
    })

    const deletePaymentMutation = trpc.loans.deletePayment.useMutation({
        onSuccess: () => {
            utils.loans.getById.invalidate({ id: loanId })
            utils.loans.getLoanPayments.invalidate({ loanId })
            utils.loans.getMonthlyAccruals.invalidate({ loanId })
        },
    })

    if (isLoading) return <Skeleton className="h-24" />
    if (!payments || payments.length === 0) return null

    const componentLabel: Record<string, string> = {
        interest_current: 'Interés corriente',
        interest_overdue: 'Interés mora',
        principal: 'Capital',
        disbursement: 'Desembolso',
        waiver_interest: 'Quita interés',
        waiver_principal: 'Quita capital',
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Historial de Cobros</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="divide-y divide-border">
                    {payments.map((payment) => {
                        const isExpanded = expandedId === payment.id
                        const isEditing = editingId === payment.id
                        const breakdowns = payment.realCashflows.filter((f) => f.component !== 'disbursement')

                        return (
                            <div key={payment.id} className="py-3">
                                <button
                                    className="w-full flex items-center justify-between gap-3 hover:opacity-80 transition-opacity"
                                    onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Banknote className="h-4 w-4 text-accent-positive shrink-0" />
                                        <div className="text-left min-w-0">
                                            <p className="text-sm font-medium">
                                                {format(new Date(payment.paymentDate), "d 'de' MMMM yyyy", { locale: es })}
                                            </p>
                                            {payment.note && (
                                                <p className="text-xs text-muted-foreground truncate">{payment.note}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-sm font-bold text-accent-positive">
                                            {formatCurrency(Number(payment.amount), cur)}
                                        </span>
                                        <ChevronDown className={cn(
                                            "h-4 w-4 text-muted-foreground transition-transform",
                                            isExpanded && "rotate-180"
                                        )} />
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="mt-2 ml-7 space-y-2">
                                        {breakdowns.length > 0 && (
                                            <div className="space-y-1">
                                                {breakdowns.map((flow, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                                            {componentLabel[flow.component] ?? flow.component}
                                                            <span className="text-muted-foreground/60">
                                                                ({format(new Date(flow.flowDate), "d MMM", { locale: es })})
                                                            </span>
                                                        </span>
                                                        <span>{formatCurrency(Math.abs(Number(flow.amountSigned)), cur)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={editNote}
                                                    onChange={(e) => setEditNote(e.target.value)}
                                                    placeholder="Nota..."
                                                    className="h-7 text-xs"
                                                    autoFocus
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-green-500"
                                                    disabled={updateNoteMutation.isPending}
                                                    onClick={() => updateNoteMutation.mutate({ paymentId: payment.id, note: editNote })}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    title="Editar nota"
                                                    onClick={() => {
                                                        setEditingId(payment.id)
                                                        setEditNote(payment.note ?? '')
                                                    }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                                                    title="Eliminar pago"
                                                    disabled={deletePaymentMutation.isPending}
                                                    onClick={() => {
                                                        if (window.confirm('¿Eliminar este pago? Los estados de cuotas se recalcularán.')) {
                                                            deletePaymentMutation.mutate({ paymentId: payment.id })
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
