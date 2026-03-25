'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency, formatDateToInput, parseInputDate } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { ShoppingCart, Ban, RotateCcw, ChevronDown, ChevronUp, CreditCard, Banknote, ArrowRightLeft, Pencil, Trash2 } from 'lucide-react'
import { PrivateAmount } from '@/lib/privacy-context'
import { EmptyState } from '@/components/ui/empty-state'
import { getCategoryIconInfo } from '@/lib/category-icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TransactionForm } from '@/components/transactions/transaction-form'
import {
  getExpenseTypeLabel,
  getExpenseTypeColor,
  getPaymentMethodLabel,
  getPaymentMethodColor,
  isTransactionPendingClassification,
  getTransactionCategoryLabel,
  PENDING_CLASSIFICATION_LABEL,
} from '@/lib/transaction-utils'

function getPaymentMethodIcon(method: string) {
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

interface ExpenseListProps {
  transactions: any[] | undefined
  displayedTransactions: any[] | undefined
  viewMode: 'cards' | 'table'
  remainingCount: number
  onLoadMore: () => void
  categories: any[] | undefined
}

export function ExpenseList({
  transactions,
  displayedTransactions,
  viewMode,
  remainingCount,
  onLoadMore,
  categories,
}: ExpenseListProps) {
  const utils = trpc.useUtils()

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
    totalAmount: '',
    purchaseDate: '',
  })

  const startEditingTransaction = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditFormData({
      description: transaction.description,
      categoryId: transaction.categoryId || '',
      subcategoryId: transaction.subcategoryId || '',
      expenseType: transaction.expenseType || '',
      notes: transaction.notes || '',
      totalAmount: transaction.totalAmount.toString(),
      purchaseDate: formatDateToInput(new Date(transaction.purchaseDate)),
    })
  }

  const voidMutation = trpc.transactions.void.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCardBalances.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
    },
  })

  const unvoidMutation = trpc.transactions.unvoid.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate()
      utils.dashboard.getCardBalances.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
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
      utils.dashboard.getCardBalances.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
    },
  })

  const editExpenseCategoryOption = (categories ?? []).find(
    (category: any) => category.id === editFormData.categoryId
  )
  const editExpenseSubcategoryOptions = editExpenseCategoryOption?.subcategories ?? []

  if (!transactions || transactions.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="¡Tomá el control de tus gastos!"
        description="Aún no tenés movimientos en este período. Registrá tu primer gasto para entender a dónde va tu plata y mejorar tu salud financiera."
        action={<TransactionForm triggerText="Nuevo gasto" className="shadow-lg shadow-primary/20" />}
      />
    )
  }

  return (
    <>
      {viewMode === 'table' ? (
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
                              onClick={() => startEditingTransaction(transaction)}
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
              <Button variant="outline" onClick={onLoadMore}>
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
                            onClick={() => startEditingTransaction(transaction)}
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
                        {transaction.installmentsList.map((installment: any) => (
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
              <Button variant="outline" onClick={onLoadMore}>
                Ver más ({remainingCount} restantes)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Void confirmation dialog */}
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

      {/* Edit transaction dialog */}
      <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
            <DialogDescription>
              {editingTransaction && (editingTransaction as any).paymentMethod === 'credit_card'
                ? "Modificá los datos del gasto. El monto y la fecha no se pueden cambiar en gastos con tarjeta."
                : "Modificá los datos del gasto."}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-amount">Monto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="edit-amount"
                    type="text"
                    inputMode="decimal"
                    value={editFormData.totalAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, totalAmount: e.target.value.replace(/[^0-9.,]/g, '') })}
                    disabled={editingTransaction && (editingTransaction as any).paymentMethod === 'credit_card'}
                    className="pl-7"
                    title={editingTransaction && (editingTransaction as any).paymentMethod === 'credit_card' ? "No se puede editar el monto de gastos con tarjeta" : ""}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Fecha</Label>
                <DatePicker
                  date={editFormData.purchaseDate ? parseInputDate(editFormData.purchaseDate) : undefined}
                  onSelect={(date) =>
                    setEditFormData({
                      ...editFormData,
                      purchaseDate: date ? formatDateToInput(date) : formatDateToInput(new Date()),
                    })
                  }
                  disabled={editingTransaction && (editingTransaction as any).paymentMethod === 'credit_card'}
                />
              </div>
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
                  const data: any = {
                    id: editingTransaction.id,
                    description: editFormData.description,
                    categoryId: editFormData.categoryId || null,
                    subcategoryId: editFormData.subcategoryId || null,
                    expenseType: (editFormData.expenseType as any) || null,
                    notes: editFormData.notes || null,
                  }

                  if ((editingTransaction as any).paymentMethod !== 'credit_card') {
                    const amount = parseFloat(editFormData.totalAmount.replace(',', '.'))
                    if (!isNaN(amount) && amount > 0) {
                      data.totalAmount = amount
                    }
                    data.purchaseDate = parseInputDate(editFormData.purchaseDate)
                  }

                  updateMutation.mutate(data)
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
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
    </>
  )
}
