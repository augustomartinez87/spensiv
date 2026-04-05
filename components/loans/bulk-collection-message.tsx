'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { LoanListItem } from './types'

const UPCOMING_WINDOW_DAYS = 7

interface BulkCollectionMessageProps {
    collectorName: string
    loans: LoanListItem[]
}

interface LoanLine {
    borrower: string
    number: number
    totalInstallments: number
    date: string
    dateRaw: Date
    amount: number
    currency: string
}

export function BulkCollectionMessage({ collectorName, loans }: BulkCollectionMessageProps) {
    const [open, setOpen] = useState(false)
    const [message, setMessage] = useState('')
    const { toast } = useToast()

    const now = new Date()

    // Collect all loans with a pending installment that is overdue or within the window
    const overdue: LoanLine[] = []
    const upcoming: LoanLine[] = []

    for (const loan of loans) {
        const next = loan.loanInstallments.find((i) => !i.isPaid)
        if (!next) continue
        const remaining = Math.max(Number(next.amount) - Number(next.paidAmount ?? 0), 0)
        if (remaining <= 0) continue

        const dueDate = new Date(next.dueDate)
        const daysUntil = differenceInCalendarDays(dueDate, now)

        // Skip installments too far in the future
        if (daysUntil > UPCOMING_WINDOW_DAYS) continue

        const line: LoanLine = {
            borrower: loan.borrowerName.split(' - ')[0],
            number: next.number,
            totalInstallments: loan.loanInstallments.length,
            date: format(dueDate, "d/MM", { locale: es }),
            dateRaw: dueDate,
            amount: remaining,
            currency: loan.currency,
        }

        if (daysUntil < 0) {
            overdue.push(line)
        } else {
            upcoming.push(line)
        }
    }

    // Sort each group by date ascending
    overdue.sort((a, b) => a.dateRaw.getTime() - b.dateRaw.getTime())
    upcoming.sort((a, b) => a.dateRaw.getTime() - b.dateRaw.getTime())

    const allLines = [...overdue, ...upcoming]
    if (allLines.length === 0) return null

    function formatLine(l: LoanLine): string {
        return `- ${l.borrower}: cuota ${l.number}/${l.totalInstallments} del ${l.date}, ${formatCurrency(l.amount, l.currency)}`
    }

    function buildBlock(lines: LoanLine[]): string {
        return lines.map(formatLine).join('\n')
    }

    function buildTotals(lines: LoanLine[]): string {
        const byCurrency: Record<string, number> = {}
        for (const l of lines) {
            byCurrency[l.currency] = (byCurrency[l.currency] || 0) + l.amount
        }
        return Object.entries(byCurrency)
            .map(([cur, total]) => `*Total: ${formatCurrency(total, cur)}*`)
            .join('\n')
    }

    function buildMessage(): string {
        const greeting = `Hola ${collectorName}! Te paso el detalle:`
        const sections: string[] = []

        if (overdue.length > 0) {
            sections.push(`\u{1F534} *VENCIDAS:*\n${buildBlock(overdue)}`)
        }

        if (upcoming.length > 0) {
            sections.push(`\u{1F7E1} *PR\u00D3XIMAS (${UPCOMING_WINDOW_DAYS} d\u00EDas):*\n${buildBlock(upcoming)}`)
        }

        const totals = buildTotals(allLines)

        return `${greeting}\n\n${sections.join('\n\n')}\n\n${totals}\n\nAvisame cuando hayas cobrado as\u00ED lo registramos. \u{1F64C}`
    }

    function handleOpenChange(v: boolean) {
        if (v) setMessage(buildMessage())
        setOpen(v)
    }

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(message)
            toast({ title: '\u00A1Mensaje copiado!' })
            setOpen(false)
        } catch {
            toast({ title: 'Error al copiar', variant: 'destructive' })
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Mensaje de cobro
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Mensaje de cobro — {collectorName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[200px] font-mono text-sm"
                    />
                    <Button onClick={handleCopy} className="w-full">
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar al portapapeles
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
