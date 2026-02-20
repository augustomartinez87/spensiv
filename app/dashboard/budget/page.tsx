'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { MonthSelector } from '@/components/dashboard/month-selector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
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
import { Plus, Target, Trash2, Sparkles } from 'lucide-react'

export default function BudgetPage() {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  const utils = trpc.useUtils()
  const { data: progress, isLoading } = trpc.budget.getProgress.useQuery({ period })
  const { data: categories } = trpc.budget.getProgress.useQuery({ period })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Presupuesto</h1>
          <p className="text-muted-foreground mt-1">Control de gastos por categoría</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !progress || progress.length === 0 ? (
        <EmptyState />
      ) : (
        <BudgetTable progress={progress} period={period} />
      )}
    </div>
  )
}

function EmptyState() {
  const utils = trpc.useUtils()
  const seedMutation = trpc.budget.seedDefaultCategories.useMutation({
    onSuccess: () => {
      utils.budget.getProgress.invalidate()
    },
  })

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">Sin presupuestos configurados</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4 text-center max-w-md">
          Configurá límites mensuales por categoría para controlar tus gastos
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {seedMutation.isPending ? 'Cargando...' : 'Cargar categorías sugeridas'}
          </Button>
          <AddBudgetDialog />
        </div>
      </CardContent>
    </Card>
  )
}

function BudgetTable({
  progress,
  period,
}: {
  progress: { categoryId: string; categoryName: string; monthlyLimit: number; spent: number; percentage: number }[]
  period: string
}) {
  const utils = trpc.useUtils()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const setLimitMutation = trpc.budget.setLimit.useMutation({
    onSuccess: () => {
      utils.budget.getProgress.invalidate()
      setEditingId(null)
    },
  })

  const deleteMutation = trpc.budget.deleteLimit.useMutation({
    onSuccess: () => utils.budget.getProgress.invalidate(),
  })

  const sorted = [...progress].sort((a, b) => b.percentage - a.percentage)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddBudgetDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Desktop */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">Categoría</th>
                  <th className="text-right py-3 px-4 font-medium">Gastado</th>
                  <th className="text-right py-3 px-4 font-medium">Límite</th>
                  <th className="text-right py-3 px-4 font-medium w-16">%</th>
                  <th className="py-3 px-4 font-medium w-48">Progreso</th>
                  <th className="py-3 px-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const barColor = item.percentage > 100
                    ? 'bg-red-500'
                    : item.percentage >= 80
                      ? 'bg-amber-500'
                      : 'bg-green-500'

                  return (
                    <tr key={item.categoryId} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{item.categoryName}</td>
                      <td className="py-3 px-4 text-right text-foreground">{formatCurrency(item.spent)}</td>
                      <td className="py-3 px-4 text-right">
                        {editingId === item.categoryId ? (
                          <form
                            className="flex items-center gap-1 justify-end"
                            onSubmit={(e) => {
                              e.preventDefault()
                              const val = parseFloat(editValue)
                              if (val > 0) {
                                setLimitMutation.mutate({ categoryId: item.categoryId, monthlyLimit: val })
                              }
                            }}
                          >
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-7 w-28 text-right text-sm"
                              autoFocus
                              onBlur={() => setEditingId(null)}
                            />
                          </form>
                        ) : (
                          <button
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => {
                              setEditingId(item.categoryId)
                              setEditValue(item.monthlyLimit.toString())
                            }}
                          >
                            {formatCurrency(item.monthlyLimit)}
                          </button>
                        )}
                      </td>
                      <td className={cn(
                        "py-3 px-4 text-right font-bold text-xs",
                        item.percentage > 100 ? 'text-red-400' : item.percentage >= 80 ? 'text-amber-400' : 'text-green-400'
                      )}>
                        {Math.round(item.percentage)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", barColor)}
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => deleteMutation.mutate({ categoryId: item.categoryId })}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border">
            {sorted.map((item) => {
              const barColor = item.percentage > 100
                ? 'bg-red-500'
                : item.percentage >= 80
                  ? 'bg-amber-500'
                  : 'bg-green-500'

              return (
                <div key={item.categoryId} className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground">{item.categoryName}</span>
                    <span className={cn(
                      "text-xs font-bold",
                      item.percentage > 100 ? 'text-red-400' : item.percentage >= 80 ? 'text-amber-400' : 'text-green-400'
                    )}>
                      {Math.round(item.percentage)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", barColor)}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(item.spent)} gastado</span>
                    <span>de {formatCurrency(item.monthlyLimit)}</span>
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

function AddBudgetDialog() {
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')

  const { data: userCategories } = trpc.budget.getProgress.useQuery({
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  })

  // We need all categories for the select
  const { data: allCategories } = trpc.budget.seedDefaultCategories.useMutation()

  // Simpler approach: fetch categories directly - we'll use a dedicated query
  // For now, let's just show a simple form that needs a category ID

  const setLimitMutation = trpc.budget.setLimit.useMutation({
    onSuccess: () => {
      utils.budget.getProgress.invalidate()
      setOpen(false)
      setCategoryId('')
      setLimit('')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar límite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar límite de presupuesto</DialogTitle>
        </DialogHeader>
        <AddBudgetForm onSubmit={(catId, amount) => {
          setLimitMutation.mutate({ categoryId: catId, monthlyLimit: amount })
        }} isPending={setLimitMutation.isPending} />
      </DialogContent>
    </Dialog>
  )
}

function AddBudgetForm({ onSubmit, isPending }: { onSubmit: (catId: string, amount: number) => void; isPending: boolean }) {
  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')

  // Fetch all user categories via a simple query
  const { data: categories } = trpc.budget.listCategories.useQuery()

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (categoryId && parseFloat(limit) > 0) {
          onSubmit(categoryId, parseFloat(limit))
        }
      }}
    >
      <div className="space-y-2">
        <Label>Categoría</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Límite mensual ($)</Label>
        <Input
          type="number"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="50000"
          min="1"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending || !categoryId}>
        {isPending ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  )
}
