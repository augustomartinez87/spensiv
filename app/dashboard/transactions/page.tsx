'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
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
import { Plus, ShoppingCart, Ban, RotateCcw, ChevronDown, ChevronUp, CreditCard, Banknote, ArrowRightLeft, TrendingUp } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { formatCurrency, formatDateToInput, parseInputDate } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type PaymentMethod = 'credit_card' | 'cash' | 'transfer'
type ExpenseType = 'structural' | 'emotional_recurrent' | 'emotional_impulsive'
type TabType = 'gastos' | 'ingresos'

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

interface IncomeFormData {
  description: string
  amount: number
  date: string
  category: 'active_income' | 'other_income'
  subcategory: string
  isRecurring: boolean
}

const initialFormData: TransactionFormData = {
  paymentMethod: 'credit_card',
  cardId: '',
  description: '',
  totalAmount: 0,
  purchaseDate: formatDateToInput(new Date()),
  installments: 1,
  expenseType: undefined,
  notes: '',
}

const initialIncomeFormData: IncomeFormData = {
  description: '',
  amount: 0,
  date: formatDateToInput(new Date()),
  category: 'active_income',
  subcategory: '',
  isRecurring: false,
}

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('gastos')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isIncomeCreateOpen, setIsIncomeCreateOpen] = useState(false)
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData)
  const [incomeFormData, setIncomeFormData] = useState<IncomeFormData>(initialIncomeFormData)
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null)
  const [transactionToVoid, setTransactionToVoid] = useState<{ id: string; description: string; amount: number } | null>(null)

  const utils = trpc.useUtils()
  const { data: transactions, isLoading: isLoadingTransactions } = trpc.transactions.list.useQuery()
  const { data: incomes, isLoading: isLoadingIncomes } = trpc.incomes.list.useQuery()
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

  const createIncomeMutation = trpc.incomes.create.useMutation({
    onSuccess: () => {
      utils.incomes.list.invalidate()
      utils.dashboard.getCurrentMonth.invalidate()
      setIsIncomeCreateOpen(false)
      setIncomeFormData(initialIncomeFormData)
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

  // Nota: Los ingresos no tienen funcionalidad de anulación por ahora

  const handleCreate = () => {
    createMutation.mutate({
      paymentMethod: formData.paymentMethod,
      cardId: formData.paymentMethod === 'credit_card' ? formData.cardId : undefined,
      description: formData.description,
      totalAmount: formData.totalAmount,
      purchaseDate: parseInputDate(formData.purchaseDate),
      installments: formData.paymentMethod === 'credit_card' ? formData.installments : 1,
      expenseType: formData.expenseType,
      notes: formData.notes || undefined,
    })
  }

  const handleCreateIncome = () => {
    createIncomeMutation.mutate({
      description: incomeFormData.description,
      amount: incomeFormData.amount,
      date: parseInputDate(incomeFormData.date),
      category: incomeFormData.category,
      subcategory: incomeFormData.subcategory || undefined,
      isRecurring: incomeFormData.isRecurring,
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
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
      case 'emotional_recurrent':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
      case 'emotional_impulsive':
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
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
        return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
      case 'cash':
        return 'bg-green-500/15 text-green-600 dark:text-green-400'
      case 'transfer':
        return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
      default:
        return 'bg-secondary text-muted-foreground'
    }
  }

  const getIncomeCategoryLabel = (category: string) => {
    switch (category) {
      case 'active_income':
        return 'Ingreso Activo'
      case 'other_income':
        return 'Otro Ingreso'
      default:
        return category
    }
  }

  const getIncomeCategoryColor = (category: string) => {
    switch (category) {
      case 'active_income':
        return 'bg-green-500/15 text-green-600 dark:text-green-400'
      case 'other_income':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
      default:
        return 'bg-secondary text-muted-foreground'
    }
  }

  const isFormValid = () => {
    if (!formData.description || formData.totalAmount <= 0) return false
    if (formData.paymentMethod === 'credit_card' && !formData.cardId) return false
    return true
  }

  const isIncomeFormValid = () => {
    return incomeFormData.description && incomeFormData.amount > 0
  }

  if (isLoadingTransactions || isLoadingIncomes) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando movimientos...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Movimientos</h1>
          <p className="text-muted-foreground">
            Registra y administra tus gastos e ingresos
          </p>
        </div>
        {activeTab === 'gastos' ? (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData(initialFormData)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo gasto</DialogTitle>
                <DialogDescription>
                  Registra una nueva compra
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Metodo de pago */}
                <div className="grid gap-2">
                  <Label>Método de pago</Label>
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
                        No tenés tarjetas. <a href="/dashboard/cards" className="text-primary underline">Agregá una</a>
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
                <DatePicker
                  date={formData.purchaseDate ? parseInputDate(formData.purchaseDate) : undefined}
                  onSelect={(date) => setFormData({ ...formData, purchaseDate: date ? formatDateToInput(date) : formatDateToInput(new Date()) })}
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
        ) : (
          <Dialog open={isIncomeCreateOpen} onOpenChange={setIsIncomeCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIncomeFormData(initialIncomeFormData)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo ingreso
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo ingreso</DialogTitle>
                <DialogDescription>
                  Registra un nuevo ingreso
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="income-description">Descripción</Label>
                  <Input
                    id="income-description"
                    placeholder="ej: Sueldo Enero"
                    value={incomeFormData.description}
                    onChange={(e) => setIncomeFormData({ ...incomeFormData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="income-amount">Monto</Label>
                    <Input
                      id="income-amount"
                      type="number"
                      placeholder="Ej: 50000"
                      value={incomeFormData.amount || ''}
                      onChange={(e) => setIncomeFormData({ ...incomeFormData, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="income-date">Fecha</Label>
                    <DatePicker
                      date={incomeFormData.date ? parseInputDate(incomeFormData.date) : undefined}
                      onSelect={(date) => setIncomeFormData({ ...incomeFormData, date: date ? formatDateToInput(date) : formatDateToInput(new Date()) })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="income-category">Categoría</Label>
                  <Select
                    value={incomeFormData.category}
                    onValueChange={(value: 'active_income' | 'other_income') => setIncomeFormData({ ...incomeFormData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active_income">Ingresos Activos</SelectItem>
                      <SelectItem value="other_income">Otros Ingresos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="income-subcategory">Subcategoría (opcional)</Label>
                  <Input
                    id="income-subcategory"
                    placeholder="ej: Sueldo, Freelance, etc."
                    value={incomeFormData.subcategory}
                    onChange={(e) => setIncomeFormData({ ...incomeFormData, subcategory: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="income-isRecurring"
                    checked={incomeFormData.isRecurring}
                    onChange={(e) => setIncomeFormData({ ...incomeFormData, isRecurring: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="income-isRecurring" className="cursor-pointer">
                    Es recurrente (mensual)
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsIncomeCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateIncome}
                  disabled={createIncomeMutation.isPending || !isIncomeFormValid()}
                >
                  {createIncomeMutation.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('gastos')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'gastos'
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Gastos
        </button>
        <button
          onClick={() => setActiveTab('ingresos')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeTab === 'ingresos'
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Ingresos
        </button>
      </div>

      {/* Content */}
      {activeTab === 'gastos' ? (
        <>
          {transactions?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No tenés gastos registrados</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Registrá tu primer gasto para comenzar a trackear tus finanzas
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
                            <span className="text-xs bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">
                              ANULADO
                            </span>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
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
                      <div className="flex items-center gap-2 flex-wrap">
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
                            onClick={() => setTransactionToVoid({ 
                              id: transaction.id, 
                              description: transaction.description,
                              amount: Number(transaction.totalAmount)
                            })}
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
                                  <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                                    Pagada
                                  </span>
                                ) : (
                                  <span className="text-xs bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded">
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
        </>
      ) : (
        <>
          {incomes?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No tenés ingresos registrados</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Registrá tu primer ingreso para comenzar a trackear tus finanzas
                </p>
                <Button onClick={() => setIsIncomeCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo ingreso
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {incomes?.map((income) => (
                <Card key={income.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {income.description}
                          </CardTitle>
                          {income.isRecurring && (
                            <span className="text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                              RECURRENTE
                            </span>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>{format(new Date(income.date), "d 'de' MMMM, yyyy", { locale: es })}</span>
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          +{formatCurrency(Number(income.amount))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded ${getIncomeCategoryColor(income.category)}`}>
                        {getIncomeCategoryLabel(income.category)}
                      </span>
                      {income.subcategory && (
                        <span className="text-xs text-muted-foreground">
                          {income.subcategory}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Confirmación para anular gasto */}
      <Dialog open={!!transactionToVoid} onOpenChange={() => setTransactionToVoid(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
            <DialogDescription>
              ¿Querés anular <strong>{transactionToVoid?.description}</strong> por{' '}
              <strong>{transactionToVoid ? formatCurrency(transactionToVoid.amount) : ''}</strong>?{' '}
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransactionToVoid(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (transactionToVoid) {
                  voidMutation.mutate(transactionToVoid.id)
                  setTransactionToVoid(null)
                }
              }}
              disabled={voidMutation.isPending}
            >
              {voidMutation.isPending ? 'Anulando...' : 'Sí, anular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
