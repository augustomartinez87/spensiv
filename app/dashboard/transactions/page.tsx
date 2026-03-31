'use client'

import { useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { IncomeForm } from '@/components/transactions/income-form'
import { ExpenseList } from '@/components/transactions/expense-list'
import { IncomeList } from '@/components/transactions/income-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { LayoutGrid, Table, Download, Search } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  PENDING_CLASSIFICATION_FILTER,
  PENDING_CLASSIFICATION_LABEL,
  getExpenseTypeLabel,
  getPaymentMethodLabel,
  isTransactionPendingClassification,
  getTransactionCategoryLabel,
} from '@/lib/transaction-utils'

type TabType = 'gastos' | 'ingresos'
type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('gastos')
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

  const { data: transactions, isLoading: isLoadingTransactions } = trpc.transactions.list.useQuery({
    cardId: filters.cardId || undefined,
  })
  const { data: incomes, isLoading: isLoadingIncomes } = trpc.incomes.list.useQuery()
  const { data: incomeCategories } = trpc.incomes.getCategories.useQuery()
  const { data: categories } = trpc.transactions.getCategories.useQuery()
  const { data: cards } = trpc.cards.list.useQuery()

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
        <ExpenseList
          transactions={sortedTransactions}
          displayedTransactions={displayedTransactions}
          viewMode={viewMode}
          remainingCount={remainingCount}
          onLoadMore={() => setVisibleCount(v => v + 20)}
          categories={categories}
        />
      ) : (
        <IncomeList
          incomes={sortedIncomes}
          viewMode={viewMode}
          incomeCategories={incomeCategories}
        />
      )}
    </div>
  )
}
