'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, formatDateToInput } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { RefreshCw } from 'lucide-react'
import { tnaToMonthlyRate, frenchInstallment, generateAmortizationTable } from '@/lib/loan-calculator'
import type { LoanDetail } from './types'

export function RefinanceDialog({ loan, onBack }: { loan: LoanDetail; onBack: () => void }) {
    const utils = trpc.useUtils()
    const [open, setOpen] = useState(false)
    const cur = loan.currency

    // Calculate remaining unpaid capital and interest (accounting for partial payments)
    const unpaidInstallments = loan.loanInstallments.filter((i) => !i.isPaid)
    const unpaidPrincipal = unpaidInstallments.reduce((s, i) => {
        const paid = Number(i.paidAmount ?? 0)
        const paidInterest = Math.min(paid, Number(i.interest))
        const paidPrincipal = Math.max(paid - paidInterest, 0)
        return s + Math.max(Number(i.principal) - paidPrincipal, 0)
    }, 0)
    const unpaidInterest = unpaidInstallments.reduce((s, i) => {
        const paid = Number(i.paidAmount ?? 0)
        const paidInterest = Math.min(paid, Number(i.interest))
        return s + Math.max(Number(i.interest) - paidInterest, 0)
    }, 0)

    const [capitalizeInterest, setCapitalizeInterest] = useState(false)
    const [tna, setTna] = useState((Number(loan.tna) * 100).toFixed(1))
    const [termMonths, setTermMonths] = useState(String(loan.termMonths || 6))
    const [startDate, setStartDate] = useState(formatDateToInput(new Date()))
    const [note, setNote] = useState('')

    const newCapital = capitalizeInterest ? unpaidPrincipal + unpaidInterest : unpaidPrincipal

    // Client-side preview
    const previewTable = (() => {
        try {
            const t = parseInt(termMonths)
            const tnaVal = parseFloat(tna) / 100
            if (!t || t <= 0 || !tnaVal || newCapital <= 0) return []
            const rate = tnaToMonthlyRate(tnaVal)
            const inst = frenchInstallment(newCapital, rate, t)
            return generateAmortizationTable(newCapital, rate, t, inst, startDate)
        } catch {
            return []
        }
    })()

    const refinanceMutation = trpc.loans.refinanceLoan.useMutation({
        onSuccess: (newLoan) => {
            utils.loans.list.invalidate()
            utils.loans.getDashboardMetrics.invalidate()
            utils.loans.getById.invalidate({ id: loan.id })
            setOpen(false)
            onBack()
        },
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refinanciar
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Refinanciar préstamo</DialogTitle>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: Form */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Capital impago</Label>
                            <div className="text-lg font-bold text-foreground">{formatCurrency(unpaidPrincipal, cur)}</div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Capitalizar intereses</Label>
                                <p className="text-xs text-muted-foreground">
                                    Sumar {formatCurrency(unpaidInterest, cur)} de intereses al capital
                                </p>
                            </div>
                            <Switch checked={capitalizeInterest} onCheckedChange={setCapitalizeInterest} />
                        </div>

                        {capitalizeInterest && (
                            <div className="bg-amber-500/10 text-amber-400 rounded-lg px-3 py-2 text-sm">
                                Nuevo capital: <strong>{formatCurrency(newCapital, cur)}</strong>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>TNA (%)</Label>
                                <Input type="number" value={tna} onChange={(e) => setTna(e.target.value)} step="0.5" />
                            </div>
                            <div className="space-y-2">
                                <Label>Plazo (meses)</Label>
                                <Input type="number" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} min="1" max="360" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Fecha de inicio</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Nota (opcional)</Label>
                            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo del refinanciamiento" />
                        </div>

                        <Button
                            className="w-full"
                            disabled={refinanceMutation.isPending || newCapital <= 0}
                            onClick={() => refinanceMutation.mutate({
                                loanId: loan.id,
                                capitalizeInterest,
                                tna: parseFloat(tna) / 100,
                                termMonths: parseInt(termMonths),
                                startDate,
                                note: note || undefined,
                            })}
                        >
                            {refinanceMutation.isPending ? 'Refinanciando...' : 'Confirmar refinanciamiento'}
                        </Button>

                        {refinanceMutation.error && (
                            <p className="text-sm text-red-500">{refinanceMutation.error.message}</p>
                        )}
                    </div>

                    {/* Right: Preview table */}
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Preview nueva tabla</p>
                        {previewTable.length > 0 ? (
                            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="border-b text-muted-foreground">
                                            <th className="py-1.5 px-2 text-left">#</th>
                                            <th className="py-1.5 px-2 text-right">Cuota</th>
                                            <th className="py-1.5 px-2 text-right">Interés</th>
                                            <th className="py-1.5 px-2 text-right">Capital</th>
                                            <th className="py-1.5 px-2 text-right">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewTable.map((row) => (
                                            <tr key={row.month} className="border-b border-border/50">
                                                <td className="py-1 px-2">{row.month}</td>
                                                <td className="py-1 px-2 text-right">{formatCurrency(row.installment, cur)}</td>
                                                <td className="py-1 px-2 text-right text-blue-400">{formatCurrency(row.interest, cur)}</td>
                                                <td className="py-1 px-2 text-right">{formatCurrency(row.principal, cur)}</td>
                                                <td className="py-1 px-2 text-right">{formatCurrency(row.balance, cur)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic text-center py-8">
                                Completá los datos para ver la preview
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
