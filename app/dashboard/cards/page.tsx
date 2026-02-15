'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, CreditCard, Pencil, Trash2, CalendarDays } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { BillingCycleEditor } from '@/components/cards/billing-cycle-editor'

type CardBrand = 'visa' | 'mastercard' | 'amex'

interface CardFormData {
  name: string
  bank: string
  brand: CardBrand
  last4: string
  closingDay: number
  dueDay: number
  creditLimit: number | undefined
}

const initialFormData: CardFormData = {
  name: '',
  bank: '',
  brand: 'visa',
  last4: '',
  closingDay: 1,
  dueDay: 1,
  creditLimit: undefined,
}

export default function CardsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isCyclesOpen, setIsCyclesOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [formData, setFormData] = useState<CardFormData>(initialFormData)

  const utils = trpc.useUtils()
  const { data: cards, isLoading } = trpc.cards.list.useQuery()

  const createMutation = trpc.cards.create.useMutation({
    onSuccess: () => {
      utils.cards.list.invalidate()
      setIsCreateOpen(false)
      setFormData(initialFormData)
    },
  })

  const updateMutation = trpc.cards.update.useMutation({
    onSuccess: () => {
      utils.cards.list.invalidate()
      setIsEditOpen(false)
      setSelectedCard(null)
      setFormData(initialFormData)
    },
  })

  const deleteMutation = trpc.cards.delete.useMutation({
    onSuccess: () => {
      utils.cards.list.invalidate()
      setIsDeleteOpen(false)
      setSelectedCard(null)
    },
  })

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      bank: formData.bank,
      brand: formData.brand,
      last4: formData.last4 || undefined,
      closingDay: formData.closingDay,
      dueDay: formData.dueDay,
      creditLimit: formData.creditLimit,
    })
  }

  const handleEdit = (card: any) => {
    setSelectedCard(card.id)
    setFormData({
      name: card.name,
      bank: card.bank,
      brand: card.brand,
      last4: card.last4 || '',
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimit: card.creditLimit ? Number(card.creditLimit) : undefined,
    })
    setIsEditOpen(true)
  }

  const handleUpdate = () => {
    if (!selectedCard) return
    updateMutation.mutate({
      id: selectedCard,
      name: formData.name,
      bank: formData.bank,
      brand: formData.brand,
      last4: formData.last4 || undefined,
      closingDay: formData.closingDay,
      dueDay: formData.dueDay,
      creditLimit: formData.creditLimit,
    })
  }

  const handleDelete = () => {
    if (!selectedCard) return
    deleteMutation.mutate(selectedCard)
  }

  const getBrandColor = (brand: string) => {
    switch (brand) {
      case 'visa':
        return 'bg-blue-500'
      case 'mastercard':
        return 'bg-orange-500'
      case 'amex':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getBrandName = (brand: string) => {
    switch (brand) {
      case 'visa':
        return 'Visa'
      case 'mastercard':
        return 'Mastercard'
      case 'amex':
        return 'American Express'
      default:
        return brand
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando tarjetas...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tarjetas</h1>
          <p className="text-muted-foreground">
            Administra tus tarjetas de crédito
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(initialFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar tarjeta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva tarjeta</DialogTitle>
              <DialogDescription>
                Agrega una nueva tarjeta de crédito para trackear tus gastos
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  placeholder="ej: CIUDAD Visa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank">Banco</Label>
                <Input
                  id="bank"
                  placeholder="ej: CIUDAD"
                  value={formData.bank}
                  onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brand">Marca</Label>
                <Select
                  value={formData.brand}
                  onValueChange={(value: CardBrand) => setFormData({ ...formData, brand: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="mastercard">Mastercard</SelectItem>
                    <SelectItem value="amex">American Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last4">Ultimos 4 digitos (opcional)</Label>
                <Input
                  id="last4"
                  placeholder="1234"
                  maxLength={4}
                  value={formData.last4}
                  onChange={(e) => setFormData({ ...formData, last4: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="closingDay">Dia de cierre</Label>
                  <Input
                    id="closingDay"
                    type="number"
                    min={1}
                    max={31}
                    value={formData.closingDay}
                    onChange={(e) => setFormData({ ...formData, closingDay: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDay">Dia de vencimiento</Label>
                  <Input
                    id="dueDay"
                    type="number"
                    min={1}
                    max={31}
                    value={formData.dueDay}
                    onChange={(e) => setFormData({ ...formData, dueDay: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="creditLimit">Límite de crédito (opcional)</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  placeholder="500000"
                  value={formData.creditLimit || ''}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value ? parseFloat(e.target.value) : undefined })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !formData.name || !formData.bank}>
                {createMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {cards?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tenes tarjetas</h3>
            <p className="text-muted-foreground text-center mb-4">
              Agrega tu primera tarjeta para comenzar a trackear tus gastos
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar tarjeta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards?.map((card) => (
            <Card key={card.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-2 ${getBrandColor(card.brand)}`} />
              <CardHeader className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {card.name}
                    </CardTitle>
                    <CardDescription>{card.bank} - {getBrandName(card.brand)}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCard(card.id)
                        setIsCyclesOpen(true)
                      }}
                      title="Ver Calendario"
                    >
                      <CalendarDays className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(card)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCard(card.id)
                        setIsDeleteOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {card.last4 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Terminacion</span>
                      <span className="font-mono">****{card.last4}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cierre</span>
                    <span>Dia {card.closingDay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vencimiento</span>
                    <span>Dia {card.dueDay}</span>
                  </div>
                  {card.creditLimit && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limite</span>
                      <span>{formatCurrency(Number(card.creditLimit))}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tarjeta</DialogTitle>
            <DialogDescription>
              Modifica los datos de tu tarjeta
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-bank">Banco</Label>
              <Input
                id="edit-bank"
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-brand">Marca</Label>
              <Select
                value={formData.brand}
                onValueChange={(value: CardBrand) => setFormData({ ...formData, brand: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                  <SelectItem value="amex">American Express</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-last4">Ultimos 4 digitos</Label>
              <Input
                id="edit-last4"
                maxLength={4}
                value={formData.last4}
                onChange={(e) => setFormData({ ...formData, last4: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-closingDay">Dia de cierre</Label>
                <Input
                  id="edit-closingDay"
                  type="number"
                  min={1}
                  max={31}
                  value={formData.closingDay}
                  onChange={(e) => setFormData({ ...formData, closingDay: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-dueDay">Dia de vencimiento</Label>
                <Input
                  id="edit-dueDay"
                  type="number"
                  min={1}
                  max={31}
                  value={formData.dueDay}
                  onChange={(e) => setFormData({ ...formData, dueDay: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-creditLimit">Límite de crédito</Label>
              <Input
                id="edit-creditLimit"
                type="number"
                value={formData.creditLimit || ''}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar tarjeta</DialogTitle>
            <DialogDescription>
              Estas seguro que queres eliminar esta tarjeta? Esta accion no se puede deshacer y se eliminaran todos los gastos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing Cycles Dialog */}
      <Dialog open={isCyclesOpen} onOpenChange={setIsCyclesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ciclos de Facturación</DialogTitle>
            <DialogDescription>
              Ajusta las fechas reales de cierre y vencimiento para cada mes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedCard && <BillingCycleEditor cardId={selectedCard} />}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCyclesOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
