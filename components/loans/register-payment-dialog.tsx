'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, formatDateToInput } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Banknote } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { LoanDetail, LoanInstallment } from './types'

export function RegisterPaymentDialog({ loanId, cur, loan }: { loanId: string; cur: string; loan: LoanDetail }) {
    const utils = trpc.useUtils()
    const [open, setOpen] = useState(false)
    const [amount, setAmount] = useState('')
    const [date, setDate] = useState(formatDateToInput(new Date()))
    const [note, setNote] = useState('')

    const registerMutation = trpc.loans.registerPayment.useMutation({
        onSuccess: () => {
            utils.loans.getById.invalidate({ id: loanId })
            utils.loans.getMonthlyAccruals.invalidate({ loanId })
            utils.loans.getLoanPayments.invalidate({ loanId })
            utils.loans.list.invalidate()
            utils.loans.getDashboardMetrics.invalidate()

            setOpen(false)
            setAmount('')
        },
    })

    // Compute pending info from loan data
    const now = new Date()
    const unpaidInsts = loan.loanInstallments.filter((i) => !i.isPaid)
    const overdueInsts = unpaidInsts.filter((i) => new Date(i.dueDate) < now)
    const nextDueInst = unpaidInsts.find((i) => new Date(i.dueDate) >= now)
    const pendingCount = unpaidInsts.length
    const totalPendingAmount = unpaidInsts.reduce((s, i) => {
        const paid = Number(i.paidAmount ?? 0)
        return s + Math.max(Number(i.amount) - paid, 0)
    }, 0)
    
    const principalPending = loan?.principalOutstanding ? Number(loan.principalOutstanding) : 0
    const allowPayment = pendingCount > 0 || (loan?.loanType === 'interest_only' && principalPending > 0)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Banknote className="h-4 w-4 mr-2" />
                    Registrar Cobro
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Cobro Real</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Pending info */}
                    {(overdueInsts.length > 0 || nextDueInst || (loan?.loanType === 'interest_only' && principalPending > 0)) && (
                        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs space-y-1.5">
                            {overdueInsts.length > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-red-400 font-medium">Vencidas ({overdueInsts.length})</span>
                                    <span className="text-red-400 font-medium">
                                        {formatCurrency(overdueInsts.reduce((s, i) => {
                                            const paid = Number(i.paidAmount ?? 0)
                                            return s + Math.max(Number(i.amount) - paid, 0)
                                        }, 0), cur)}
                                    </span>
                                </div>
                            )}
                            {nextDueInst && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span>
                                        Próxima ({format(new Date(nextDueInst.dueDate), "d MMM", { locale: es })})
                                        {Number(nextDueInst.paidAmount ?? 0) > 0 && ' · Parcial'}
                                    </span>
                                    <span>
                                        {formatCurrency(Math.max(Number(nextDueInst.amount) - Number(nextDueInst.paidAmount ?? 0), 0), cur)}
                                    </span>
                                </div>
                            )}
                            {pendingCount > 0 && (
                                <div className="flex justify-between border-t border-border/50 pt-1.5">
                                    <span className="text-muted-foreground">Cuotas pendientes ({pendingCount})</span>
                                    <span className="font-medium">{formatCurrency(totalPendingAmount, cur)}</span>
                                </div>
                            )}
                            {loan?.loanType === 'interest_only' && principalPending > 0 && (
                                <div className="flex justify-between border-t border-border/50 pt-1.5 text-muted-foreground">
                                    <span>Capital vivo prestado</span>
                                    <span className="text-foreground">{formatCurrency(principalPending, cur)}</span>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Monto cobrado ({cur})</Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha del cobro (valor)</Label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Nota</Label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Ej: Transferencia, Efectivo..."
                        />
                    </div>
                    <Button
                        className="w-full"
                        disabled={!amount || parseFloat(amount) <= 0 || !allowPayment || registerMutation.isPending}
                        onClick={() => registerMutation.mutate({
                            loanId,
                            amount: parseFloat(amount),
                            paymentDate: date,
                            note: note || undefined,
                        })}
                    >
                        {registerMutation.isPending ? 'Registrando...' : 'Confirmar Cobro'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
