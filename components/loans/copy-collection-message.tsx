'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { loanDisplayName } from './helpers'
import type { LoanDetail } from './types'

export function CopyCollectionMessage({ loan }: { loan: LoanDetail }) {
    const [open, setOpen] = useState(false)
    const [message, setMessage] = useState('')
    const { toast } = useToast()
    const cur = loan.currency

    const nextInstallment = loan.loanInstallments.find((i) => !i.isPaid)
    if (!nextInstallment) return null

    const nombre = loanDisplayName(loan)
    const fecha = format(new Date(nextInstallment.dueDate), "d 'de' MMMM", { locale: es })
    const monto = formatCurrency(Math.max(Number(nextInstallment.amount) - Number(nextInstallment.paidAmount ?? 0), 0), cur)
    const total = loan.loanInstallments.length
    const saldo = formatCurrency(
        loan.loanInstallments.filter((i) => !i.isPaid).reduce((s, i) =>
            s + Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0), 0),
        cur
    )

    const shareUrl = typeof window !== 'undefined' && loan.person?.id
        ? `${window.location.origin}/share/${loan.person.id}`
        : null
    const defaultMessage = `Hola ${nombre}! Te recuerdo que el ${fecha} vence tu cuota #${nextInstallment.number} por ${monto} (de un total de ${total} cuotas). Saldo pendiente: ${saldo}.${shareUrl ? ` Podés ver tu estado de cuenta acá: ${shareUrl}` : ''} Cualquier consulta avisame. 🙌`

    // Initialize message if empty
    if (message === '' && defaultMessage !== '') {
        setMessage(defaultMessage)
    }

    // Reset message when dialog opens
    function handleOpenChange(v: boolean) {
        if (v) setMessage(defaultMessage)
        setOpen(v)
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
                    <DialogTitle>Mensaje de cobro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[120px]"
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
