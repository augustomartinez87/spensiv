'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Plus } from 'lucide-react'
import { formatDateToInput } from '@/lib/utils'

interface FormData {
  description: string
  personId: string
  personName: string
  cardId: string
  totalAmount: string
  installments: string
  currency: 'ARS' | 'USD'
  purchaseDate: string
  firstDueDate: string
  notes: string
}

const initialFormData: FormData = {
  description: '',
  personId: '',
  personName: '',
  cardId: '',
  totalAmount: '',
  installments: '1',
  currency: 'ARS',
  purchaseDate: formatDateToInput(new Date()),
  firstDueDate: '',
  notes: '',
}

export function ThirdPartyForm() {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [formData, setFormData] = useState<FormData>(initialFormData)

  const { data: cards } = trpc.cards.list.useQuery()
  const { data: persons } = trpc.persons.list.useQuery()

  const createMutation = trpc.thirdPartyPurchases.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Compra de tercero registrada',
        description: 'La compra se registró exitosamente',
      })
      setOpen(false)
      setFormData(initialFormData)
      utils.thirdPartyPurchases.list.invalidate()
      utils.dashboard.getCardBalances.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const totalAmount = parseFloat(formData.totalAmount)
    if (!totalAmount || totalAmount <= 0) return
    if (!formData.cardId) return
    if (!formData.personName.trim()) return

    createMutation.mutate({
      description: formData.description,
      personId: formData.personId || undefined,
      personName: formData.personName,
      cardId: formData.cardId,
      totalAmount,
      installments: parseInt(formData.installments) || 1,
      currency: formData.currency,
      purchaseDate: formData.purchaseDate,
      firstDueDate: formData.firstDueDate || undefined,
      notes: formData.notes || undefined,
    })
  }

  const handlePersonSelect = (personId: string) => {
    if (personId === '_none') {
      setFormData(prev => ({ ...prev, personId: '', personName: '' }))
      return
    }
    const person = persons?.find(p => p.id === personId)
    if (person) {
      setFormData(prev => ({
        ...prev,
        personId: person.id,
        personName: person.name,
      }))
    }
  }

  const installmentAmount = formData.totalAmount && formData.installments
    ? (parseFloat(formData.totalAmount) / parseInt(formData.installments)).toFixed(2)
    : '0'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Compra de Tercero
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva compra de tercero</DialogTitle>
          <DialogDescription>
            Registrá una compra con tu tarjeta para otra persona. Impacta en tu deuda pero NO en tus egresos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ej: Celular para Juan"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Persona</Label>
              <Select value={formData.personId || '_none'} onValueChange={handlePersonSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nombre libre</SelectItem>
                  {persons?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={formData.personName}
                onChange={(e) => setFormData(prev => ({ ...prev, personName: e.target.value }))}
                placeholder="Nombre del tercero"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tarjeta</Label>
            <Select value={formData.cardId} onValueChange={(v) => setFormData(prev => ({ ...prev, cardId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tarjeta" />
              </SelectTrigger>
              <SelectContent>
                {cards?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Monto total</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cuotas</Label>
              <Input
                type="number"
                min="1"
                value={formData.installments}
                onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={formData.currency} onValueChange={(v: 'ARS' | 'USD') => setFormData(prev => ({ ...prev, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {parseInt(formData.installments) > 1 && (
            <p className="text-xs text-muted-foreground">
              Cuota: ${installmentAmount} x {formData.installments} cuotas
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de compra</Label>
              <Input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Primer vencimiento cobro</Label>
              <Input
                type="date"
                value={formData.firstDueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, firstDueDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Registrando...' : 'Registrar compra'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
