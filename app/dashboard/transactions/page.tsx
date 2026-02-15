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
import { Plus, ShoppingCart, Ban, RotateCcw, ChevronDown, ChevronUp, CreditCard, Banknote, ArrowRightLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type PaymentMethod = 'credit_card' | 'cash' | 'transfer'
type ExpenseType = 'structural' | 'emotional_recurrent' | 'emotional_impulsive'

interface TransactionFormData {
  paymentMethod: PaymentMethod
  cardId: string
  description: string
  totalAmount: number
  purchaseDate: string
  installments: number
  expenseType: ExpenseType | undefined
  notes: string
}

const initialFormData: TransactionFormData = {
  paymentMethod: 'credit_card',
  cardId: '',
  description: '',
  totalAmount: 0,
  purchaseDate: new Date().toISOString().split('T')[0],
  installments: 1,
  expenseType: undefined,
  notes: '',
}

export default function TransactionsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData)
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const { data: transactions, isLoading } = trpc.transactions.list.useQuery()
  const { data: cards } = trpc.cards.list.useQuery()

  const createMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCurrentMonth.invalidate()
      utils.dashboard.getTotalDebt.invalidate()
      setIsCreateOpen(false)
      setFormData(initialFormData)
    },
  })

  const voidMutation = trpc.transactions.void.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCurrentMonth.invalidate()
      utils.dashboard.getTotalDebt.invalidate()
    },
  })

  const unvoidMutation = trpc.transactions.unvoid.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCurrentMonth.invalidate()
      utils.dashboard.getTotalDebt.invalidate()
    },
  })

  const handleCreate = () => {
    createMutation.mutate({
      paymentMethod: formData.paymentMethod,
      cardId: formData.paymentMethod === 'credit_card' ? formData.cardId : undefined,
      description: formData.description,
      totalAmount: formData.totalAmount,
      purchaseDate: new Date(formData.purchaseDate),
      installments: formData.paymentMethod === 'credit_card' ? formData.installments : 1,
      expenseType: formData.expenseType,
      notes: formData.notes || undefined,
    })
  }

  const getExpenseTypeLabel = (type: string | null) => {
    switch (type) {
      case 'structural':
        return 'Estructural'
      case 'emotional_recurrent':
        return 'Emocional Recurrente'
      case 'emotional_impulsive':
        return 'Emocional Impulsivo'
      default:
        return 'Sin clasificar'
    }
  }

  const getExpenseTypeColor = (type: string | null) => {
    switch (type) {
      case 'structural':
        return 'bg-blue-500/15 text-blue-400'
      case 'emotional_recurrent':
        return 'bg-purple-500/15 text-purple-400'
      case 'emotional_impulsive':
        return 'bg-orange-500/15 text-orange-400'
      default:
        return 'bg-secondary text-muted-foreground'
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'credit_card':
        return 'Tarjeta'
      case 'cash':
        return 'Efectivo'
      case 'transfer':
        return 'Transferencia'
      default:
        return method
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'credit_card':
        return <CreditCard className="h-4 w-4" />
      case 'cash':
        return <Banknote className="h-4 w-4" />
      case 'transfer':
        return <ArrowRightLeft className="h-4 w-4" />
      default:
        return null
    }
  }

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'credit_card':
        return 'bg-indigo-500/15 text-indigo-400'
      case 'cash':
        return 'bg-green-500/15 text-green-400'
      case 'transfer':
        return 'bg-cyan-500/15 text-cyan-400'
      default:
        return 'bg-secondary text-muted-foreground'
    }
  }

  const isFormValid = () => {
    if (!formData.description || formData.totalAmount <= 0) return false
    if (formData.paymentMethod === 'credit_card' && !formData.cardId) return false
    return true
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando gastos...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gastos</h1>
          <p className="text-muted-foreground">
            Registra y administra tus compras
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(initialFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo gasto</DialogTitle>
              <DialogDescription>
                Registra una nueva compra
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Metodo de pago */}
              <div className="grid gap-2">
                <Label>Metodo de pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={formData.paymentMethod === 'credit_card' ? 'default' : 'outline'}
                    className="flex flex-col h-auto py-3"
                    onClick={() => setFormData({ ...formData, paymentMethod: 'credit_card' })}
                  >
                    <CreditCard className="h-5 w-5 mb-1" />
                    <span className="text-xs">Tarjeta</span>
                  </Button>
                  <Button
                    type="button"
                    variant={formData.paymentMethod === 'cash' ? 'default' : 'outline'}
                    className="flex flex-col h-auto py-3"
                    onClick={() => setFormData({ ...formData, paymentMethod: 'cash', cardId: '', installments: 1 })}
                  >
                    <Banknote className="h-5 w-5 mb-1" />
                    <span className="text-xs">Efectivo</span>
                  </Button>
                  <Button
                    type="button"
                    variant={formData.paymentMethod === 'transfer' ? 'default' : 'outline'}
                    className="flex flex-col h-auto py-3"
                    onClick={() => setFormData({ ...formData, paymentMethod: 'transfer', cardId: '', installments: 1 })}
                  >
                    <ArrowRightLeft className="h-5 w-5 mb-1" />
                    <span className="text-xs">Transferencia</span>
                  </Button>
                </div>
              </div>

              {/* Tarjeta (solo si es credit_card) */}
              {formData.paymentMethod === 'credit_card' && (
                <div className="grid gap-2">
                  <Label htmlFor="cardId">Tarjeta</Label>
                  <Select
                    value={formData.cardId}
                    onValueChange={(value) => setFormData({ ...formData, cardId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tarjeta" />
                    </SelectTrigger>
                    <SelectContent>
                      {cards?.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!cards?.length && (
                    <p className="text-xs text-muted-foreground">
                      No tenes tarjetas. <a href="/dashboard/cards" className="text-primary underline">Agrega una</a>
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  placeholder="ej: Smart TV Samsung 55"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="totalAmount">Monto total</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    placeholder="Ej: 15000"
                    value={formData.totalAmount || ''}
                    onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {formData.paymentMethod === 'credit_card' && (
                  <div className="grid gap-2">
                    <Label htmlFor="installments">Cuotas</Label>
                    <Input
                      id="installments"
                      type="number"
                      min={1}
                      max={60}
                      value={formData.installments}
                      onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}
              </div>

              {formData.paymentMethod === 'credit_card' && formData.totalAmount > 0 && formData.installments > 0 && (
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  Cuota mensual: {formatCurrency(formData.totalAmount / formData.installments)}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="purchaseDate">Fecha de compra</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="expenseType">Tipo de gasto</Label>
                <Select
                  value={formData.expenseType || ''}
                  onValueChange={(value) => setFormData({ ...formData, expenseType: value as ExpenseType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="structural">Estructural</SelectItem>
                    <SelectItem value="emotional_recurrent">Emocional Recurrente</SelectItem>
                    <SelectItem value="emotional_impulsive">Emocional Impulsivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Input
                  id="notes"
                  placeholder="Notas adicionales..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !isFormValid()}
              >
                {createMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {transactions?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tenes gastos registrados</h3>
            <p className="text-muted-foreground text-center mb-4">
              Registra tu primer gasto para comenzar a trackear tus finanzas
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo gasto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions?.map((transaction) => (
            <Card
              key={transaction.id}
              className={transaction.isVoided ? 'opacity-60' : ''}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {transaction.description}
                      </CardTitle>
                      {transaction.isVoided && (
                        <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded">
                          ANULADO
                        </span>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${getPaymentMethodColor((transaction as any).paymentMethod || 'credit_card')}`}>
                        {getPaymentMethodIcon((transaction as any).paymentMethod || 'credit_card')}
                        {getPaymentMethodLabel((transaction as any).paymentMethod || 'credit_card')}
                      </span>
                      {transaction.card && (
                        <span>{transaction.card.name}</span>
                      )}
                      <span>-</span>
                      <span>{format(new Date(transaction.purchaseDate), "d 'de' MMMM, yyyy", { locale: es })}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatCurrency(Number(transaction.totalAmount))}
                    </div>
                    {(transaction as any).paymentMethod === 'credit_card' && transaction.installments > 1 && (
                      <div className="text-sm text-muted-foreground">
                        {transaction.installments} cuotas de{' '}
                        {formatCurrency(Number(transaction.totalAmount) / transaction.installments)}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${getExpenseTypeColor(transaction.expenseType)}`}>
                      {getExpenseTypeLabel(transaction.expenseType)}
                    </span>
                    {transaction.notes && (
                      <span className="text-xs text-muted-foreground">
                        {transaction.notes}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {transaction.isVoided ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unvoidMutation.mutate(transaction.id)}
                        disabled={unvoidMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restaurar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => voidMutation.mutate(transaction.id)}
                        disabled={voidMutation.isPending}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Anular
                      </Button>
                    )}
                    {(transaction as any).paymentMethod === 'credit_card' && transaction.installmentsList?.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedTransaction(
                          expandedTransaction === transaction.id ? null : transaction.id
                        )}
                      >
                        {expandedTransaction === transaction.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        Ver cuotas
                      </Button>
                    )}
                  </div>
                </div>

                {expandedTransaction === transaction.id && transaction.installmentsList?.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Detalle de cuotas</h4>
                    <div className="grid gap-2">
                      {transaction.installmentsList.map((installment) => (
                        <div
                          key={installment.id}
                          className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Cuota {installment.installmentNumber}/{transaction.installments}
                            </span>
                            <span className="text-muted-foreground">
                              {format(new Date(installment.impactDate), "MMMM yyyy", { locale: es })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatCurrency(Number(installment.amount))}
                            </span>
                            {installment.isPaid ? (
                              <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded">
                                Pagada
                              </span>
                            ) : (
                              <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded">
                                Pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
