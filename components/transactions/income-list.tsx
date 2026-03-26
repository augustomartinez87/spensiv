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
import { TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { PrivateAmount } from '@/lib/privacy-context'
import { EmptyState } from '@/components/ui/empty-state'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { IncomeForm } from '@/components/transactions/income-form'
import { normalizeIncomeCategoryText } from '@/lib/income-categories'
import {
  getIncomeCategoryLabel,
  getIncomeCategoryColor,
} from '@/lib/transaction-utils'

interface IncomeListProps {
  incomes: any[] | undefined
  viewMode: 'cards' | 'table'
  incomeCategories: any[] | undefined
}

export function IncomeList({
  incomes,
  viewMode,
  incomeCategories,
}: IncomeListProps) {
  const utils = trpc.useUtils()

  const [incomeToDelete, setIncomeToDelete] = useState<{ id: string; description: string } | null>(null)
  const [editingIncome, setEditingIncome] = useState<any>(null)
  const [editIncomeFormData, setEditIncomeFormData] = useState({
    description: '',
    category: '',
    subcategory: '',
    isRecurring: false,
    notes: '',
    amount: '',
    date: '',
  })

  const startEditingIncome = (income: any) => {
    setEditingIncome(income)
    setEditIncomeFormData({
      description: income.description,
      category: getIncomeCategoryLabel(income.category),
      subcategory: income.subcategory || '',
      isRecurring: income.isRecurring,
      notes: income.notes || '',
      amount: income.amount.toString(),
      date: formatDateToInput(new Date(income.date)),
    })
  }

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

  const normalizedEditCategory = normalizeIncomeCategoryText(editIncomeFormData.category || '')
  const editIncomeCategoryOption = (incomeCategories ?? []).find(
    (category: any) => normalizeIncomeCategoryText(category.name) === normalizedEditCategory
  )
  const editIncomeSubcategoryOptions = editIncomeCategoryOption?.subcategories ?? []

  if (!incomes || incomes.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No tenés ingresos registrados"
        description="Registrá tu primer ingreso para comenzar a trackear tus finanzas"
        action={<IncomeForm triggerText="Nuevo ingreso" />}
      />
    )
  }

  return (
    <>
      {viewMode === 'table' ? (
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
                  {incomes.map((income) => (
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
                        {income.subcategory || <span className="text-muted-foreground/50 italic">Sin subcategoría</span>}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {income.isRecurring ? (
                          <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded">
                            Sí
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
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
                            onClick={() => startEditingIncome(income)}
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
          {incomes.map((income) => (
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
                      onClick={() => startEditingIncome(income)}
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

      {/* Edit income dialog */}
      <Dialog open={!!editingIncome} onOpenChange={() => setEditingIncome(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ingreso</DialogTitle>
            <DialogDescription>
              Modificá los datos del ingreso.
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
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-inc-amount">Monto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="edit-inc-amount"
                    type="text"
                    inputMode="decimal"
                    value={editIncomeFormData.amount}
                    onChange={(e) => setEditIncomeFormData({ ...editIncomeFormData, amount: e.target.value.replace(/[^0-9.,]/g, '') })}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-inc-date">Fecha</Label>
                <DatePicker
                  date={editIncomeFormData.date ? parseInputDate(editIncomeFormData.date) : undefined}
                  onSelect={(date) =>
                    setEditIncomeFormData({
                      ...editIncomeFormData,
                      date: date ? formatDateToInput(date) : formatDateToInput(new Date()),
                    })
                  }
                />
              </div>
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
                {(incomeCategories ?? []).map((category: any) => (
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
                {editIncomeSubcategoryOptions.map((subcategory: any) => (
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
                  const amount = parseFloat(editIncomeFormData.amount.replace(',', '.'))

                  if (!description || !category || isNaN(amount) || amount <= 0) return

                  incomeUpdateMutation.mutate({
                    id: editingIncome.id,
                    description,
                    amount,
                    date: parseInputDate(editIncomeFormData.date),
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

      {/* Delete income confirmation dialog */}
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
    </>
  )
}
