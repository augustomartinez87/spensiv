'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { IncomeForm } from '@/components/transactions/income-form'
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
} from '@/components/ui/dialog'
import { Plus, ShoppingCart, Ban, RotateCcw, ChevronDown, ChevronUp, CreditCard, Banknote, ArrowRightLeft, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type TabType = 'gastos' | 'ingresos'
type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('gastos')
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null)
  const [transactionToVoid, setTransactionToVoid] = useState<{ id: string; description: string; amount: number } | null>(null)
  const [transactionToDelete, setTransactionToDelete] = useState<{ id: string; description: string } | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    description: '',
    categoryId: '',
    expenseType: '',
    notes: '',
  })

  // Filtros
  const [filters, setFilters] = useState({
    cardId: '',
    categoryId: '',
    expenseType: '',
    searchQuery: '',
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc')

  const utils = trpc.useUtils()
  const { data: transactions, isLoading: isLoadingTransactions } = trpc.transactions.list.useQuery({
    cardId: filters.cardId || undefined,
  })
  const { data: incomes, isLoading: isLoadingIncomes } = trpc.incomes.list.useQuery()
  const { data: categories } = trpc.transactions.getCategories.useQuery()
  const { data: cards } = trpc.cards.list.useQuery()

  const voidMutation = trpc.transactions.void.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCurrentMonth.invalidate()
      utils.dashboard.getTotalDebt.invalidate()
      utils.dashboard.getCardBalances.invalidate()
    },
  })

  const unvoidMutation = trpc.transactions.unvoid.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCurrentMonth.invalidate()
      utils.dashboard.getTotalDebt.invalidate()
      utils.dashboard.getCardBalances.invalidate()
    },
  })

  const updateMutation = trpc.transactions.update.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
      setEditingTransaction(null)
    },
  })

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCurrentMonth.invalidate()
      utils.dashboard.getTotalDebt.invalidate()
      utils.dashboard.getCardBalances.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
      setTransactionToDelete(null)
    },
  })

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
        return 'Tarjeta Crédito'
      case 'debit_card':
        return 'Tarjeta Débito'
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
      case 'debit_card':
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
      case 'debit_card':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
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

  if (isLoadingTransactions || isLoadingIncomes) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando movimientos...</div>
      </div>
    )
  }

  // Filtrar transacciones
  const filteredTransactions = transactions?.filter((tx: any) => {
    if (filters.categoryId && tx.categoryId !== filters.categoryId) return false
    if (filters.expenseType && tx.expenseType !== filters.expenseType) return false
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const matchesDescription = tx.description.toLowerCase().includes(query)
      const matchesCategory = tx.category?.name?.toLowerCase().includes(query)
      const matchesAmount = tx.totalAmount.toString().includes(query)
      if (!matchesDescription && !matchesCategory && !matchesAmount) return false
    }
    return true
  })

  // Ordenar transacciones
  const sortedTransactions = filteredTransactions?.sort((a: any, b: any) => {
    switch (sortOrder) {
      case 'date-desc':
        return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      case 'date-asc':
        return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
      case 'amount-desc':
        return Number(b.totalAmount) - Number(a.totalAmount)
      case 'amount-asc':
        return Number(a.totalAmount) - Number(b.totalAmount)
      default:
        return 0
    }
  })

  const hasActiveFilters = filters.cardId || filters.categoryId || filters.expenseType || filters.searchQuery

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
          <TransactionForm />
        ) : (
          <IncomeForm />
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

      {/* Filtros - solo mostrar en pestaña de gastos */}
      {activeTab === 'gastos' && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Filtro por tarjeta */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tarjeta</Label>
              <select
                value={filters.cardId}
                onChange={(e) => setFilters({ ...filters, cardId: e.target.value })}
                className="h-9 w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="">Todas las tarjetas</option>
                {cards?.map((card: any) => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </select>
            </div>

            {/* Filtro por categoría */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoría</Label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                className="h-9 w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="">Todas las categorías</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Filtro por tipo de gasto */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de gasto</Label>
              <select
                value={filters.expenseType}
                onChange={(e) => setFilters({ ...filters, expenseType: e.target.value })}
                className="h-9 w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="">Todos los tipos</option>
                <option value="structural">Estructural</option>
                <option value="emotional_recurrent">Emocional Recurrente</option>
                <option value="emotional_impulsive">Emocional Impulsivo</option>
              </select>
            </div>

            {/* Búsqueda */}
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <Input
                type="text"
                placeholder="Descripción, categoría, monto..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="h-9"
              />
            </div>

            {/* Ordenamiento */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ordenar por</Label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="h-9 w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="date-desc">Fecha: Más reciente</option>
                <option value="date-asc">Fecha: Más antigua</option>
                <option value="amount-desc">Monto: Mayor a menor</option>
                <option value="amount-asc">Monto: Menor a mayor</option>
              </select>
            </div>

            {/* Botón limpiar filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({
                  cardId: '',
                  categoryId: '',
                  expenseType: '',
                  searchQuery: '',
                })}
                className="h-9"
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Contador de resultados */}
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground">
              Mostrando {sortedTransactions?.length || 0} de {transactions?.length || 0} movimientos
            </p>
          )}
        </div>
      )}

      {/* Content */}
      {activeTab === 'gastos' ? (
        <>
          {sortedTransactions?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No tenés gastos registrados</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Registrá tu primer gasto para comenzar a trackear tus finanzas
                </p>
                <TransactionForm triggerText="Nuevo gasto" />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedTransactions?.map((transaction) => (
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
                        {!transaction.isVoided && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTransaction(transaction)
                                setEditFormData({
                                  description: transaction.description,
                                  categoryId: transaction.categoryId || '',
                                  expenseType: transaction.expenseType || '',
                                  notes: transaction.notes || '',
                                })
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setTransactionToDelete({ 
                                id: transaction.id, 
                                description: transaction.description 
                              })}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Eliminar
                            </Button>
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
                          </>
                        )}
                        {transaction.isVoided && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unvoidMutation.mutate(transaction.id)}
                            disabled={unvoidMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restaurar
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
                <IncomeForm triggerText="Nuevo ingreso" />
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

      {/* Modal para editar transacción */}
      <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
            <DialogDescription>
              Modificá los datos del gasto. El monto, fecha y cuotas no se pueden cambiar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Input
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-category">Categoría</Label>
              <select
                id="edit-category"
                value={editFormData.categoryId}
                onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Sin categoría</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-type">Tipo de gasto</Label>
              <select
                id="edit-type"
                value={editFormData.expenseType}
                onChange={(e) => setEditFormData({ ...editFormData, expenseType: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Sin clasificar</option>
                <option value="structural">Estructural</option>
                <option value="emotional_recurrent">Emocional Recurrente</option>
                <option value="emotional_impulsive">Emocional Impulsivo</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notas</Label>
              <Input
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTransaction(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingTransaction) {
                  updateMutation.mutate({
                    id: editingTransaction.id,
                    description: editFormData.description,
                    categoryId: editFormData.categoryId || null,
                    expenseType: (editFormData.expenseType as any) || null,
                    notes: editFormData.notes || null,
                  })
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación para eliminar transacción */}
      <Dialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar permanentemente?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que querés eliminar <strong>{transactionToDelete?.description}</strong>?{' '}
              Esta acción no se puede deshacer y se eliminarán todas las cuotas asociadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransactionToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (transactionToDelete) {
                  deleteMutation.mutate(transactionToDelete.id)
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
