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
import { Plus, ShoppingCart, Ban, RotateCcw, ChevronDown, ChevronUp, CreditCard, Banknote, ArrowRightLeft, TrendingUp, Pencil, Trash2, LayoutGrid, Table, Download, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PrivateAmount } from '@/lib/privacy-context'
import { getCategoryIconInfo } from '@/lib/category-icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  getIncomeCategoryMappingByName,
  normalizeIncomeCategoryText,
} from '@/lib/income-categories'

type TabType = 'gastos' | 'ingresos'
type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

const PENDING_CLASSIFICATION_FILTER = '__pending_classification__'
const PENDING_CLASSIFICATION_LABEL = 'Pendiente de clasificar'

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('gastos')
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null)
  const [transactionToVoid, setTransactionToVoid] = useState<{ id: string; description: string; amount: number } | null>(null)
  const [transactionToDelete, setTransactionToDelete] = useState<{ id: string; description: string } | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    description: '',
    categoryId: '',
    subcategoryId: '',
    expenseType: '',
    notes: '',
  })

  // Income States
  const [incomeToDelete, setIncomeToDelete] = useState<{ id: string; description: string } | null>(null)
  const [editingIncome, setEditingIncome] = useState<any>(null)
  const [editIncomeFormData, setEditIncomeFormData] = useState({
    description: '',
    category: '',
    subcategory: '',
    isRecurring: false,
    notes: '',
  })
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const [visibleCount, setVisibleCount] = useState(20)

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
  const { data: incomeCategories } = trpc.incomes.getCategories.useQuery()
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
    },
  })

  // Income Mutations
  const incomeUpdateMutation = trpc.incomes.update.useMutation({
    onSuccess: () => {
      utils.incomes.list.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
      setEditingIncome(null)
    },
  })

  const incomeDeleteMutation = trpc.incomes.delete.useMutation({
    onSuccess: () => {
      utils.incomes.list.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
      setIncomeToDelete(null)
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
        return 'bg-[#1f6c9c]/15 text-[#4da8d4]'
      case 'emotional_recurrent':
        return 'bg-[#feb92e]/15 text-[#feb92e]'
      case 'emotional_impulsive':
        return 'bg-[#e54352]/15 text-[#f07a85]'
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
        return 'bg-indigo-500/15 text-indigo-400'
      case 'debit_card':
        return 'bg-blue-500/15 text-blue-400'
      case 'cash':
        return 'bg-green-500/15 text-green-400'
      case 'transfer':
        return 'bg-cyan-500/15 text-cyan-400'
      default:
        return 'bg-secondary text-muted-foreground'
    }
  }

  const getIncomeCategoryLabel = (category: string) => {
    return getIncomeCategoryMappingByName(category)?.category || category
  }

  const getIncomeCategoryColor = (category: string) => {
    const normalized = normalizeIncomeCategoryText(getIncomeCategoryLabel(category))

    if (normalized === normalizeIncomeCategoryText('Ingresos Activos')) {
      return 'bg-green-500/15 text-green-400'
    }
    if (normalized === normalizeIncomeCategoryText('Ingresos Pasivos')) {
      return 'bg-emerald-500/15 text-emerald-400'
    }
    if (normalized === normalizeIncomeCategoryText('Otros Ingresos')) {
      return 'bg-blue-500/15 text-blue-400'
    }

    return 'bg-secondary text-muted-foreground'
  }

  const isTransactionPendingClassification = (transaction: any) => {
    return !transaction.categoryId && !transaction.subcategoryId
  }

  const getTransactionCategoryLabel = (transaction: any) => {
    if (isTransactionPendingClassification(transaction)) {
      return PENDING_CLASSIFICATION_LABEL
    }

    return transaction.category?.name || 'Sin categoría'
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
    if (filters.categoryId) {
      if (filters.categoryId === PENDING_CLASSIFICATION_FILTER) {
        if (!isTransactionPendingClassification(tx)) return false
      } else if (tx.categoryId !== filters.categoryId) {
        return false
      }
    }
    if (filters.expenseType && tx.expenseType !== filters.expenseType) return false
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const matchesDescription = tx.description.toLowerCase().includes(query)
      const matchesCategory = getTransactionCategoryLabel(tx).toLowerCase().includes(query)
      const matchesSubcategory = tx.subcategory?.name?.toLowerCase().includes(query)
      const matchesAmount = tx.totalAmount.toString().includes(query)
      if (!matchesDescription && !matchesCategory && !matchesSubcategory && !matchesAmount) {
        return false
      }
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

  // Ordenar ingresos
  const sortedIncomes = incomes?.sort((a: any, b: any) => {
    switch (sortOrder) {
      case 'date-desc':
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      case 'date-asc':
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      case 'amount-desc':
        return Number(b.amount) - Number(a.amount)
      case 'amount-asc':
        return Number(a.amount) - Number(b.amount)
      default:
        return 0
    }
  })

  const normalizedEditCategory = normalizeIncomeCategoryText(editIncomeFormData.category || '')
  const editIncomeCategoryOption = (incomeCategories ?? []).find(
    (category) => normalizeIncomeCategoryText(category.name) === normalizedEditCategory
  )
  const editIncomeSubcategoryOptions = editIncomeCategoryOption?.subcategories ?? []
  const editExpenseCategoryOption = (categories ?? []).find(
    (category: any) => category.id === editFormData.categoryId
  )
  const editExpenseSubcategoryOptions = editExpenseCategoryOption?.subcategories ?? []

  const displayedTransactions = sortedTransactions?.slice(0, visibleCount)
  const remainingCount = (sortedTransactions?.length || 0) - visibleCount

  const hasActiveFilters = filters.cardId || filters.categoryId || filters.expenseType || filters.searchQuery

  function exportToCSV() {
    if (!sortedTransactions || sortedTransactions.length === 0) return
    const BOM = '\uFEFF'
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Tipo de Gasto', 'Método de Pago', 'Monto', 'Cuotas']
    const rows = sortedTransactions.map((tx: any) => [
      format(new Date(tx.purchaseDate), 'yyyy-MM-dd'),
      `"${tx.description.replace(/"/g, '""')}"`,
      getTransactionCategoryLabel(tx),
      getExpenseTypeLabel(tx.expenseType),
      getPaymentMethodLabel((tx as any).paymentMethod || 'credit_card'),
      Number(tx.totalAmount).toFixed(2),
      tx.installments || 1,
    ])
    const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
        <div className="flex items-center gap-2">
          {activeTab === 'gastos' && sortedTransactions && sortedTransactions.length > 0 && (
            <>
              <div className="flex bg-muted rounded-lg p-0.5">
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('cards')}
                  title="Vista tarjetas"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('table')}
                  title="Vista tabla"
                >
                  <Table className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-1.5" />
                CSV
              </Button>
            </>
          )}
          {activeTab === 'gastos' ? (
            <TransactionForm />
          ) : (
            <IncomeForm />
          )}
        </div>
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
        <div className="bg-muted/50 p-3 rounded-lg space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={filters.cardId}
              onChange={(e) => setFilters({ ...filters, cardId: e.target.value })}
              className={cn("h-9 w-[160px] rounded-md border px-3 py-1 text-sm shadow-sm transition-colors", filters.cardId ? "border-primary bg-primary/10 text-primary font-medium" : "border-input bg-background")}
            >
              <option value="">Todas las tarjetas</option>
              {cards?.map((card: any) => (
                <option key={card.id} value={card.id}>{card.name}</option>
              ))}
            </select>

            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              className={cn("h-9 w-[160px] rounded-md border px-3 py-1 text-sm shadow-sm transition-colors", filters.categoryId ? "border-primary bg-primary/10 text-primary font-medium" : "border-input bg-background")}
            >
              <option value="">Todas las categorías</option>
              <option value={PENDING_CLASSIFICATION_FILTER}>
                {PENDING_CLASSIFICATION_LABEL}
              </option>
              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={filters.expenseType}
              onChange={(e) => setFilters({ ...filters, expenseType: e.target.value })}
              className={cn("h-9 w-[160px] rounded-md border px-3 py-1 text-sm shadow-sm transition-colors", filters.expenseType ? "border-primary bg-primary/10 text-primary font-medium" : "border-input bg-background")}
            >
              <option value="">Todos los tipos</option>
              <option value="structural">Estructural</option>
              <option value="emotional_recurrent">Emocional Recurrente</option>
              <option value="emotional_impulsive">Emocional Impulsivo</option>
            </select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Descripción, categoría, monto..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className={cn("h-9 pl-8", filters.searchQuery ? "border-primary bg-primary/10 text-primary font-medium" : "")}
              />
            </div>

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

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({
                    cardId: '',
                    categoryId: '',
                    expenseType: '',
                    searchQuery: '',
                  })
                  setVisibleCount(20)
                }}
                className="h-9"
              >
                Limpiar filtros
              </Button>
            )}
          </div>

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
                <ShoppingCart className="h-12 w-12 text-primary/40 mb-4" />
                <h3 className="text-lg font-medium mb-2">¡Tomá el control de tus gastos!</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  Aún no tenés movimientos en este período. Registrá tu primer gasto para entender a dónde va tu plata y mejorar tu salud financiera.
                </p>
                <TransactionForm triggerText="Nuevo gasto" className="shadow-lg shadow-primary/20" />
              </CardContent>
            </Card>
          ) : viewMode === 'table' ? (
            <>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="text-left py-3 px-4 font-medium">Fecha</th>
                          <th className="text-left py-3 px-4 font-medium">Descripción</th>
                          <th className="text-left py-3 px-4 font-medium">Categoría</th>
                          <th className="text-left py-3 px-4 font-medium">Tipo</th>
                          <th className="text-left py-3 px-4 font-medium">Método</th>
                          <th className="text-right py-3 px-4 font-medium">Monto</th>
                          <th className="w-[100px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {displayedTransactions?.map((transaction) => (
                          <tr
                            key={transaction.id}
                            className={cn(
                              "group hover:bg-muted/50 transition-colors",
                              transaction.isVoided && "opacity-50 line-through"
                            )}
                          >
                            <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                              {format(new Date(transaction.purchaseDate), 'd MMM yy', { locale: es })}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-foreground max-w-[250px]">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const catInfo = getCategoryIconInfo(
                                    getTransactionCategoryLabel(transaction),
                                    transaction.subcategory?.name
                                  )
                                  const Icon = catInfo.icon
                                  return (
                                    <div
                                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                                      style={{ backgroundColor: `${catInfo.color}15` }}
                                    >
                                      <Icon className="h-3.5 w-3.5" style={{ color: catInfo.color }} />
                                    </div>
                                  )
                                })()}
                                <span className="truncate">
                                  {transaction.description}
                                  {transaction.isVoided && <span className="ml-1 text-red-500 text-xs">ANULADO</span>}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              {isTransactionPendingClassification(transaction) ? (
                                <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded">
                                  {PENDING_CLASSIFICATION_LABEL}
                                </span>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-foreground">
                                    {transaction.category?.name || 'Sin categoría'}
                                  </span>
                                  {transaction.subcategory?.name && (
                                    <span className="text-xs text-muted-foreground">
                                      {transaction.subcategory.name}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={cn('text-xs px-1.5 py-0.5 rounded', getExpenseTypeColor(transaction.expenseType))}>
                                {getExpenseTypeLabel(transaction.expenseType)}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground">
                              {getPaymentMethodLabel((transaction as any).paymentMethod || 'credit_card')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold whitespace-nowrap tabular-nums">
                              <PrivateAmount>{formatCurrency(Number(transaction.totalAmount))}</PrivateAmount>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Editar"
                                  onClick={() => {
                                    setEditingTransaction(transaction)
                                    setEditFormData({
                                      description: transaction.description,
                                      categoryId: transaction.categoryId || '',
                                      subcategoryId: transaction.subcategoryId || '',
                                      expenseType: transaction.expenseType || '',
                                      notes: transaction.notes || '',
                                    })
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Eliminar"
                                  onClick={() => setTransactionToDelete({
                                    id: transaction.id,
                                    description: transaction.description
                                  })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              {remainingCount > 0 && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setVisibleCount(v => v + 20)}>
                    Ver más ({remainingCount} restantes)
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-4">
                {displayedTransactions?.map((transaction) => (
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
                          <div className="text-lg font-bold tabular-nums">
                            <PrivateAmount>{formatCurrency(Number(transaction.totalAmount))}</PrivateAmount>
                          </div>
                          {(transaction as any).paymentMethod === 'credit_card' && transaction.installments > 1 && (
                            <div className="text-sm text-muted-foreground tabular-nums">
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
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded',
                              isTransactionPendingClassification(transaction)
                                ? 'bg-yellow-500/15 text-yellow-400'
                                : 'bg-secondary text-muted-foreground'
                            )}
                          >
                            {getTransactionCategoryLabel(transaction)}
                          </span>
                          {!isTransactionPendingClassification(transaction) &&
                            transaction.subcategory?.name && (
                              <span className="text-xs text-muted-foreground">
                                {transaction.subcategory.name}
                              </span>
                            )}
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
                                    subcategoryId: transaction.subcategoryId || '',
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
              {remainingCount > 0 && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setVisibleCount(v => v + 20)}>
                    Ver más ({remainingCount} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {sortedIncomes?.length === 0 ? (
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
          ) : viewMode === 'table' ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="text-left py-3 px-4 font-medium">Fecha</th>
                        <th className="text-left py-3 px-4 font-medium">Descripción</th>
                        <th className="text-left py-3 px-4 font-medium">Categoría</th>
                        <th className="text-left py-3 px-4 font-medium">Subcategoría</th>
                        <th className="text-center py-3 px-4 font-medium">Recurrente</th>
                        <th className="text-right py-3 px-4 font-medium">Monto</th>
                        <th className="w-[100px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedIncomes?.map((income) => (
                        <tr
                          key={income.id}
                          className="group hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                            {format(new Date(income.date), 'd MMM yy', { locale: es })}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-foreground max-w-[200px] truncate">
                            {income.description}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={cn('text-xs px-1.5 py-0.5 rounded', getIncomeCategoryColor(income.category))}>
                              {getIncomeCategoryLabel(income.category)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {income.subcategory || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {income.isRecurring ? (
                              <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded">
                                Sí
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-green-400 whitespace-nowrap tabular-nums">
                            <PrivateAmount>+{formatCurrency(Number(income.amount))}</PrivateAmount>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Editar"
                                onClick={() => {
                                  setEditingIncome(income)
                                  setEditIncomeFormData({
                                    description: income.description,
                                    category: getIncomeCategoryLabel(income.category),
                                    subcategory: income.subcategory || '',
                                    isRecurring: income.isRecurring,
                                    notes: income.notes || '',
                                  })
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Eliminar"
                                onClick={() => setIncomeToDelete({
                                  id: income.id,
                                  description: income.description
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedIncomes?.map((income) => (
                <Card key={income.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {income.description}
                          </CardTitle>
                          {income.isRecurring && (
                            <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded">
                              RECURRENTE
                            </span>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>{format(new Date(income.date), "d 'de' MMMM, yyyy", { locale: es })}</span>
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400 tabular-nums">
                          <PrivateAmount>+{formatCurrency(Number(income.amount))}</PrivateAmount>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingIncome(income)
                            setEditIncomeFormData({
                              description: income.description,
                              category: getIncomeCategoryLabel(income.category),
                              subcategory: income.subcategory || '',
                              isRecurring: income.isRecurring,
                              notes: income.notes || '',
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
                          onClick={() => setIncomeToDelete({
                            id: income.id,
                            description: income.description
                          })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )
      }

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
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    categoryId: e.target.value,
                    subcategoryId: '',
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Sin categoría</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-subcategory">Subcategoría</Label>
              <select
                id="edit-subcategory"
                value={editFormData.subcategoryId}
                onChange={(e) => setEditFormData({ ...editFormData, subcategoryId: e.target.value })}
                disabled={!editFormData.categoryId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Sin subcategoría</option>
                {editExpenseSubcategoryOptions.map((subcategory: any) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
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
                    subcategoryId: editFormData.subcategoryId || null,
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

      {/* Modal para editar ingreso */}
      <Dialog open={!!editingIncome} onOpenChange={() => setEditingIncome(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ingreso</DialogTitle>
            <DialogDescription>
              Modificá los datos del ingreso. El monto y fecha no se pueden cambiar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-inc-description">Descripción</Label>
              <Input
                id="edit-inc-description"
                value={editIncomeFormData.description}
                onChange={(e) => setEditIncomeFormData({ ...editIncomeFormData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-inc-category">Categoría</Label>
              <Input
                id="edit-inc-category"
                value={editIncomeFormData.category}
                onChange={(e) => setEditIncomeFormData({ ...editIncomeFormData, category: e.target.value })}
                placeholder="Ej: Ingresos Activos"
                list="edit-income-category-options"
              />
              <datalist id="edit-income-category-options">
                {(incomeCategories ?? []).map((category) => (
                  <option key={category.name} value={category.name} />
                ))}
              </datalist>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-inc-subcategory">Subcategoría</Label>
              <Input
                id="edit-inc-subcategory"
                value={editIncomeFormData.subcategory}
                onChange={(e) => setEditIncomeFormData({ ...editIncomeFormData, subcategory: e.target.value })}
                placeholder="Ej: Sueldo, Freelance..."
                list="edit-income-subcategory-options"
              />
              <datalist id="edit-income-subcategory-options">
                {editIncomeSubcategoryOptions.map((subcategory) => (
                  <option key={subcategory} value={subcategory} />
                ))}
              </datalist>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-inc-recurring"
                checked={editIncomeFormData.isRecurring}
                onChange={(e) => setEditIncomeFormData({ ...editIncomeFormData, isRecurring: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-inc-recurring" className="cursor-pointer">
                Es recurrente (mensual)
              </Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-inc-notes">Notas</Label>
              <Input
                id="edit-inc-notes"
                value={editIncomeFormData.notes}
                onChange={(e) => setEditIncomeFormData({ ...editIncomeFormData, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIncome(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingIncome) {
                  const description = editIncomeFormData.description.trim()
                  const category = editIncomeFormData.category.trim()

                  if (!description || !category) return

                  incomeUpdateMutation.mutate({
                    id: editingIncome.id,
                    description,
                    category,
                    subcategory: editIncomeFormData.subcategory.trim() || null,
                    isRecurring: editIncomeFormData.isRecurring,
                    notes: editIncomeFormData.notes || undefined,
                  })
                }
              }}
              disabled={incomeUpdateMutation.isPending}
            >
              {incomeUpdateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación para eliminar ingreso */}
      <Dialog open={!!incomeToDelete} onOpenChange={() => setIncomeToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar ingreso?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que querés eliminar <strong>{incomeToDelete?.description}</strong>?{' '}
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIncomeToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (incomeToDelete) {
                  incomeDeleteMutation.mutate(incomeToDelete.id)
                }
              }}
              disabled={incomeDeleteMutation.isPending}
            >
              {incomeDeleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}
