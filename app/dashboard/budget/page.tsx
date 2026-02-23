'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
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
import { Plus, Target, Trash2, Sparkles, Pencil } from 'lucide-react'

type BudgetProgressItem = {
  categoryId: string
  categoryName: string
  monthlyLimit: number
  spent: number
  percentage: number
}

export default function BudgetPage() {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  const utils = trpc.useUtils()
  const { toast } = useToast()

  const { data: progress, isLoading: isLoadingProgress } =
    trpc.budget.getProgress.useQuery({ period })
  const { data: categories, isLoading: isLoadingCategories } =
    trpc.budget.listCategories.useQuery()

  const seedMutation = trpc.budget.seedDefaultCategories.useMutation({
    onSuccess: (result) => {
      utils.budget.listCategories.invalidate()
      utils.budget.getProgress.invalidate()
      utils.transactions.getCategories.invalidate()
      toast({
        title: 'Categorias base sincronizadas',
        description: `${result.totalCategories} categorias y ${result.totalSubcategories} subcategorias`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const normalizeCategoriesMutation = trpc.transactions.normalizeExpenseCategories.useMutation({
    onSuccess: (result) => {
      utils.budget.listCategories.invalidate()
      utils.budget.getProgress.invalidate()
      utils.transactions.getCategories.invalidate()
      utils.transactions.list.invalidate()
      toast({
        title: 'Categorias normalizadas',
        description: `Migradas ${result.migratedCategories} categorias, ${result.migratedTransactions} transacciones y ${result.removedSubcategories ?? 0} subcategorias`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const isLoading = isLoadingProgress || isLoadingCategories
  const progressList = useMemo(() => progress ?? [], [progress])
  const categoriesList = useMemo(() => categories ?? [], [categories])
  const hasCategories = categoriesList.length > 0

  const totalLimit = useMemo(
    () => progressList.reduce((sum, item) => sum + item.monthlyLimit, 0),
    [progressList]
  )

  const totalSpent = useMemo(
    () => progressList.reduce((sum, item) => sum + item.spent, 0),
    [progressList]
  )

  const totalPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Presupuesto</h1>
          <p className="text-muted-foreground mt-1">Control de gastos por categoria</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasCategories && (
            <AddBudgetDialog existingCategoryIds={progressList.map((item) => item.categoryId)} />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {seedMutation.isPending ? 'Sincronizando...' : 'Sincronizar base'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => normalizeCategoriesMutation.mutate()}
            disabled={normalizeCategoriesMutation.isPending || !hasCategories}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {normalizeCategoriesMutation.isPending ? 'Normalizando...' : 'Normalizar categorias'}
          </Button>
          <MonthSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {!isLoading && progressList.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total presupuestado</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalLimit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total gastado</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">% uso global</p>
              <p
                className={cn(
                  'text-xl font-bold mt-1',
                  totalPercentage > 100
                    ? 'text-red-500'
                    : totalPercentage >= 80
                      ? 'text-amber-500'
                      : 'text-green-500'
                )}
              >
                {Math.round(totalPercentage)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : progressList.length === 0 ? (
        <EmptyState
          hasCategories={hasCategories}
          isSeeding={seedMutation.isPending}
          onSeed={() => seedMutation.mutate()}
          existingCategoryIds={[]}
        />
      ) : (
        <BudgetTable progress={progressList} existingCategoryIds={progressList.map((item) => item.categoryId)} />
      )}
    </div>
  )
}

function EmptyState({
  hasCategories,
  isSeeding,
  onSeed,
  existingCategoryIds,
}: {
  hasCategories: boolean
  isSeeding: boolean
  onSeed: () => void
  existingCategoryIds: string[]
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        {!hasCategories ? (
          <>
            <p className="text-lg font-medium text-foreground">No hay categorias cargadas</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4 text-center max-w-md">
              Para usar presupuesto, primero crea categorias sugeridas.
            </p>
            <Button variant="outline" onClick={onSeed} disabled={isSeeding}>
              <Sparkles className="h-4 w-4 mr-2" />
              {isSeeding ? 'Cargando...' : 'Cargar categorias sugeridas'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-lg font-medium text-foreground">No hay limites configurados</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4 text-center max-w-md">
              Define limites mensuales por categoria para empezar a controlar el gasto.
            </p>
            <AddBudgetDialog existingCategoryIds={existingCategoryIds} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function BudgetTable({
  progress,
  existingCategoryIds,
}: {
  progress: BudgetProgressItem[]
  existingCategoryIds: string[]
}) {
  const utils = trpc.useUtils()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const setLimitMutation = trpc.budget.setLimit.useMutation({
    onSuccess: () => {
      utils.budget.getProgress.invalidate()
      setEditingId(null)
      setEditValue('')
    },
  })

  const deleteMutation = trpc.budget.deleteLimit.useMutation({
    onSuccess: () => {
      utils.budget.getProgress.invalidate()
      if (editingId) {
        setEditingId(null)
        setEditValue('')
      }
    },
  })

  const sorted = [...progress].sort((a, b) => b.percentage - a.percentage)

  const saveLimit = (categoryId: string) => {
    const parsed = Number.parseFloat(editValue)
    if (Number.isFinite(parsed) && parsed > 0) {
      setLimitMutation.mutate({ categoryId, monthlyLimit: parsed })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddBudgetDialog existingCategoryIds={existingCategoryIds} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">Categoria</th>
                  <th className="text-right py-3 px-4 font-medium">Gastado</th>
                  <th className="text-right py-3 px-4 font-medium">Limite</th>
                  <th className="text-right py-3 px-4 font-medium w-16">%</th>
                  <th className="py-3 px-4 font-medium w-48">Progreso</th>
                  <th className="py-3 px-4 font-medium w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const barColor =
                    item.percentage > 100
                      ? 'bg-red-500'
                      : item.percentage >= 80
                        ? 'bg-amber-500'
                        : 'bg-green-500'

                  const isEditing = editingId === item.categoryId

                  return (
                    <tr
                      key={item.categoryId}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-foreground">{item.categoryName}</td>
                      <td className="py-3 px-4 text-right text-foreground">{formatCurrency(item.spent)}</td>
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <form
                            className="flex items-center gap-1 justify-end"
                            onSubmit={(e) => {
                              e.preventDefault()
                              saveLimit(item.categoryId)
                            }}
                          >
                            <Input
                              type="number"
                              min="1"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 w-28 text-right text-sm"
                              autoFocus
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="h-8 px-2"
                              disabled={setLimitMutation.isPending}
                            >
                              OK
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => {
                                setEditingId(null)
                                setEditValue('')
                              }}
                            >
                              X
                            </Button>
                          </form>
                        ) : (
                          formatCurrency(item.monthlyLimit)
                        )}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-bold text-xs',
                          item.percentage > 100
                            ? 'text-red-500'
                            : item.percentage >= 80
                              ? 'text-amber-500'
                              : 'text-green-500'
                        )}
                      >
                        {Math.round(item.percentage)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', barColor)}
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(item.categoryId)
                              setEditValue(item.monthlyLimit.toString())
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => deleteMutation.mutate({ categoryId: item.categoryId })}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-border">
            {sorted.map((item) => {
              const barColor =
                item.percentage > 100
                  ? 'bg-red-500'
                  : item.percentage >= 80
                    ? 'bg-amber-500'
                    : 'bg-green-500'

              const isEditing = editingId === item.categoryId

              return (
                <div key={item.categoryId} className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{item.categoryName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(item.spent)} de {formatCurrency(item.monthlyLimit)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(item.categoryId)
                          setEditValue(item.monthlyLimit.toString())
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => deleteMutation.mutate({ categoryId: item.categoryId })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {isEditing && (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        saveLimit(item.categoryId)
                      }}
                    >
                      <Input
                        type="number"
                        min="1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button type="submit" size="sm" className="h-8" disabled={setLimitMutation.isPending}>
                        Guardar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          setEditingId(null)
                          setEditValue('')
                        }}
                      >
                        Cancelar
                      </Button>
                    </form>
                  )}

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', barColor)}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <span
                      className={cn(
                        'text-xs font-bold',
                        item.percentage > 100
                          ? 'text-red-500'
                          : item.percentage >= 80
                            ? 'text-amber-500'
                            : 'text-green-500'
                      )}
                    >
                      {Math.round(item.percentage)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AddBudgetDialog({ existingCategoryIds }: { existingCategoryIds: string[] }) {
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')

  const { data: categories } = trpc.budget.listCategories.useQuery()

  const setLimitMutation = trpc.budget.setLimit.useMutation({
    onSuccess: () => {
      utils.budget.getProgress.invalidate()
      setOpen(false)
      setCategoryId('')
      setLimit('')
    },
  })

  const availableCategories = (categories ?? []).filter(
    (cat) => !existingCategoryIds.includes(cat.id)
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar limite
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar limite de presupuesto</DialogTitle>
        </DialogHeader>

        {availableCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ya tienes limites para todas tus categorias.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const parsedLimit = Number.parseFloat(limit)
              if (!categoryId || !Number.isFinite(parsedLimit) || parsedLimit <= 0) return
              setLimitMutation.mutate({ categoryId, monthlyLimit: parsedLimit })
            }}
          >
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Limite mensual ($)</Label>
              <Input
                type="number"
                min="1"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="50000"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={setLimitMutation.isPending || !categoryId}
            >
              {setLimitMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
