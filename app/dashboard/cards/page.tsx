'use client'

import { useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
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
import { Plus, CreditCard, Pencil, Trash2, CalendarDays, Settings, AlertCircle } from 'lucide-react'
import { cn, formatCurrency, getDaysUntilClosing } from '@/lib/utils'
import { BillingCycleEditor } from '@/components/cards/billing-cycle-editor'
import { CardScheduleEditor } from '@/components/cards/card-schedule-editor'

type CardBrand = 'visa' | 'mastercard' | 'amex'

interface CardFormData {
  bank: string
  brand: CardBrand
  last4: string
  closingDay: number
  dueDay: number
  creditLimit: number | undefined
  holderType: 'primary' | 'additional'
}

const initialFormData: CardFormData = {
  bank: '',
  brand: 'visa',
  last4: '',
  closingDay: 1,
  dueDay: 1,
  creditLimit: undefined,
  holderType: 'primary',
}

function getBankColor(bank: string): string {
  const colors: Record<string, string> = {
    'CIUDAD': 'bg-blue-600',
    'GALICIA': 'bg-orange-500',
    'SANTANDER': 'bg-red-600',
    'BBVA': 'bg-blue-700',
    'MACRO': 'bg-indigo-600',
    'HSBC': 'bg-red-500',
    'ICBC': 'bg-red-700',
    'BRUBANK': 'bg-purple-600',
    'UALA': 'bg-blue-500',
    'MERCADOPAGO': 'bg-sky-500',
  }
  const key = bank.toUpperCase()
  for (const [k, v] of Object.entries(colors)) {
    if (key.includes(k)) return v
  }
  return 'bg-gray-500'
}

function getBankInitials(bank: string): string {
  return bank.slice(0, 2).toUpperCase()
}

export default function CardsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isCyclesOpen, setIsCyclesOpen] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [formData, setFormData] = useState<CardFormData>(initialFormData)

  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const utils = trpc.useUtils()
  const { data: cards, isLoading } = trpc.cards.list.useQuery()
  const { data: cardBalances } = trpc.dashboard.getCardBalances.useQuery({ period: currentPeriod })

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
      bank: formData.bank,
      brand: formData.brand,
      last4: formData.last4 || undefined,
      closingDay: formData.closingDay,
      dueDay: formData.dueDay,
      creditLimit: formData.creditLimit,
      holderType: formData.holderType,
    })
  }

  const handleEdit = (card: any) => {
    setSelectedCard(card.id)
    setFormData({
      bank: card.bank,
      brand: card.brand,
      last4: card.last4 || '',
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimit: card.creditLimit ? Number(card.creditLimit) : undefined,
      holderType: card.holderType || 'additional',
    })
    setIsEditOpen(true)
  }

  const handleUpdate = () => {
    if (!selectedCard) return
    updateMutation.mutate({
      id: selectedCard,
      bank: formData.bank,
      brand: formData.brand,
      last4: formData.last4 || undefined,
      closingDay: formData.closingDay,
      dueDay: formData.dueDay,
      creditLimit: formData.creditLimit,
      holderType: formData.holderType,
    })
  }

  const handleDelete = () => {
    if (!selectedCard) return
    deleteMutation.mutate(selectedCard)
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
          <h1 className="text-2xl font-bold tracking-tight">Tarjetas</h1>
          <p className="text-muted-foreground mt-1">
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
                Agrega una nueva tarjeta de credito para trackear tus gastos
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
                <Label htmlFor="holderType">Titularidad</Label>
                <Select
                  value={formData.holderType}
                  onValueChange={(value: 'primary' | 'additional') => setFormData({ ...formData, holderType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona titularidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Titular</SelectItem>
                    <SelectItem value="additional">Adicional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last4">Últimos 4 dígitos (opcional)</Label>
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
                  <Label htmlFor="closingDay">Día de cierre</Label>
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
                  <Label htmlFor="dueDay">Día de vencimiento</Label>
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
              <Button onClick={handleCreate} disabled={createMutation.isPending || !formData.bank}>
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
            <Card key={card.id} className="group relative hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', getBankColor(card.bank))}>
                      {getBankInitials(card.bank)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{card.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {getBrandName(card.brand)}
                        </span>
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          card.holderType === 'primary'
                            ? "bg-blue-900/30 text-blue-400"
                            : "bg-purple-900/30 text-purple-400"
                        )}>
                          {card.holderType === 'primary' ? 'Titular' : 'Adicional'}
                        </span>
                        {card.last4 && (
                          <span className="text-xs font-mono text-muted-foreground">**** {card.last4}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedCard(card.id)
                        setIsScheduleOpen(true)
                      }}
                      title="Configurar Calendario"
                    >
                      <Settings className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedCard(card.id)
                        setIsCyclesOpen(true)
                      }}
                      title="Ver Ciclos"
                    >
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(card)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedCard(card.id)
                        setIsDeleteOpen(true)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {(() => {
                    const daysUntil = getDaysUntilClosing(card.closingDay)
                    if (daysUntil <= 3) {
                      return (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 text-xs font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Cierra en {daysUntil} {daysUntil === 1 ? 'día' : 'días'}
                        </div>
                      )
                    }
                    return null
                  })()}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cierre</span>
                    <span>Día {card.closingDay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vencimiento</span>
                    <span>Día {card.dueDay}</span>
                  </div>
                  {card.creditLimit && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Límite</span>
                      <span className="font-semibold">{formatCurrency(Number(card.creditLimit))}</span>
                    </div>
                  )}
                  {card.creditLimit && (() => {
                    const balance = cardBalances?.cards?.find((c: any) => c.id === card.id)
                    if (!balance) return null
                    const used = balance.totalBalance || 0
                    const limit = Number(card.creditLimit)
                    const utilization = limit > 0 ? (used / limit) * 100 : 0
                    return (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Utilización</span>
                          <span className={cn(
                            'font-medium',
                            utilization > 75 ? 'text-orange-400' : 'text-muted-foreground'
                          )}>
                            {utilization.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              utilization > 75 ? 'bg-orange-500' : 'bg-primary'
                            )}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}
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
              <Label htmlFor="edit-holderType">Titularidad</Label>
              <Select
                value={formData.holderType}
                onValueChange={(value: 'primary' | 'additional') => setFormData({ ...formData, holderType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona titularidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Titular</SelectItem>
                  <SelectItem value="additional">Adicional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-last4">Últimos 4 dígitos</Label>
              <Input
                id="edit-last4"
                maxLength={4}
                value={formData.last4}
                onChange={(e) => setFormData({ ...formData, last4: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-closingDay">Día de cierre</Label>
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
                <Label htmlFor="edit-dueDay">Día de vencimiento</Label>
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

      {/* Schedule Editor Dialog */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calendario de Cierres</DialogTitle>
            <DialogDescription>
              Configura los días de cierre y vencimiento para cada mes del año.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedCard && <CardScheduleEditor cardId={selectedCard} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
