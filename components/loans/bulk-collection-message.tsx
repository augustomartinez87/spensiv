'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { loanDisplayLabel } from './helpers'
import type { LoanListItem } from './types'

const WINDOW_OPTIONS = [7, 15, 30] as const
type WindowDays = (typeof WINDOW_OPTIONS)[number]
const DEFAULT_WINDOW: WindowDays = 7
const MAX_WINDOW = WINDOW_OPTIONS[WINDOW_OPTIONS.length - 1]

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
    const [windowDays, setWindowDays] = useState<WindowDays>(DEFAULT_WINDOW)
    const [message, setMessage] = useState('')
    const { toast } = useToast()

    const hasAny = useMemo(() => {
        const now = new Date()
        for (const loan of loans) {
            const next = loan.loanInstallments.find((i) => !i.isPaid)
            if (!next) continue
            const remaining = Math.max(Number(next.amount) - Number(next.paidAmount ?? 0), 0)
            if (remaining <= 0) continue
            const daysUntil = differenceInCalendarDays(new Date(next.dueDate), now)
            if (daysUntil <= MAX_WINDOW) return true
        }
        return false
    }, [loans])

    if (!hasAny) return null

    function computeMessage(days: number): string {
        const now = new Date()
        const overdue: LoanLine[] = []
        const upcoming: LoanLine[] = []

        for (const loan of loans) {
            for (const inst of loan.loanInstallments) {
                if (inst.isPaid) continue
                const remaining = Math.max(Number(inst.amount) - Number(inst.paidAmount ?? 0), 0)
                if (remaining <= 0) continue

                const dueDate = new Date(inst.dueDate)
                const daysUntil = differenceInCalendarDays(dueDate, now)

                if (daysUntil > days) continue

                const line: LoanLine = {
                    borrower: loanDisplayLabel(loan),
                    number: inst.number,
                    totalInstallments: loan.loanInstallments.length,
                    date: format(dueDate, "d/MM", { locale: es }),
                    dateRaw: dueDate,
                    amount: remaining,
                    currency: loan.currency,
                }

                if (daysUntil < 0) overdue.push(line)
                else upcoming.push(line)
            }
        }

        overdue.sort((a, b) => a.dateRaw.getTime() - b.dateRaw.getTime())
        upcoming.sort((a, b) => a.dateRaw.getTime() - b.dateRaw.getTime())
        const allLines = [...overdue, ...upcoming]

        const greeting = `Hola ${collectorName}!`

        if (allLines.length === 0) {
            return `${greeting} No hay cuotas vencidas ni por vencer en los próximos ${days} días.`
        }

        const formatLine = (l: LoanLine) =>
            `- ${l.borrower}: cuota ${l.number}/${l.totalInstallments} del ${l.date}, ${formatCurrency(l.amount, l.currency)}`
        const buildBlock = (lines: LoanLine[]) => lines.map(formatLine).join('\n')

        const byCurrency: Record<string, number> = {}
        for (const l of allLines) byCurrency[l.currency] = (byCurrency[l.currency] || 0) + l.amount
        const totals = Object.entries(byCurrency)
            .map(([cur, total]) => `*Total: ${formatCurrency(total, cur)}*`)
            .join('\n')

        const sections: string[] = []
        if (overdue.length > 0) sections.push(`\u{1F534} *VENCIDAS:*\n${buildBlock(overdue)}`)
        if (upcoming.length > 0) sections.push(`\u{1F7E1} *PRÓXIMAS (${days} días):*\n${buildBlock(upcoming)}`)

        return `${greeting} Te paso el detalle:\n\n${sections.join('\n\n')}\n\n${totals}\n\nAvisame cuando hayas cobrado así lo registramos. \u{1F64C}`
    }

    function handleOpenChange(v: boolean) {
        if (v) setMessage(computeMessage(windowDays))
        setOpen(v)
    }

    function handleWindowChange(days: WindowDays) {
        setWindowDays(days)
        setMessage(computeMessage(days))
    }

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(message)
            toast({ title: '¡Mensaje copiado!' })
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
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Incluir próximas:</span>
                        <div className="inline-flex rounded-md border overflow-hidden">
                            {WINDOW_OPTIONS.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    aria-pressed={windowDays === d}
                                    onClick={() => handleWindowChange(d)}
                                    className={cn(
                                        'px-3 py-1 text-sm transition-colors',
                                        windowDays === d
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-background hover:bg-muted'
                                    )}
                                >
                                    {d} días
                                </button>
                            ))}
                        </div>
                    </div>
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
