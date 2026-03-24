'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AmountInput } from '@/components/ui/amount-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/hooks/use-toast'
import { Plus, Check, Sparkles, RefreshCcw } from 'lucide-react'
import { formatDateToInput, parseInputDate } from '@/lib/utils'
import {
  normalizeIncomeCategoryText,
  sortIncomeCategoriesByTaxonomy,
  sortIncomeSubcategoriesByTaxonomy,
} from '@/lib/income-categories'

type IncomeCategoryOption = {
  name: string
  subcategories: string[]
}

interface IncomeFormProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  triggerText?: string
}

type IncomeFormState = {
  description: string
  amount: string
  date: string
  category: string
  subcategory: string
  isRecurring: boolean
}

const initialFormData: IncomeFormState = {
  description: '',
  amount: '',
  date: formatDateToInput(new Date()),
  category: 'Ingresos Activos',
  subcategory: '',
  isRecurring: false,
}

const EMPTY_SUBCATEGORY_VALUE = '__none__'

function mergeIncomeCategories(
  baseCategories: IncomeCategoryOption[],
  extraCategories: IncomeCategoryOption[]
): IncomeCategoryOption[] {
  const categoryMap = new Map<string, { name: string; subcategories: Set<string> }>()

  const addCategory = (category: IncomeCategoryOption) => {
    const key = normalizeIncomeCategoryText(category.name)
    const current = categoryMap.get(key) ?? {
      name: category.name,
      subcategories: new Set<string>(),
    }

    for (const subcategory of category.subcategories) {
      if (subcategory.trim()) {
        current.subcategories.add(subcategory.trim())
      }
    }

    if (!current.name.trim()) {
      current.name = category.name.trim()
    }

    categoryMap.set(key, current)
  }

  for (const category of baseCategories) addCategory(category)
  for (const category of extraCategories) addCategory(category)

  return sortIncomeCategoriesByTaxonomy(
    Array.from(categoryMap.values()).map((entry) => ({
      name: entry.name,
      subcategories: sortIncomeSubcategoriesByTaxonomy(
        entry.name,
        Array.from(entry.subcategories).map((subcategory) => ({ name: subcategory }))
      ).map((subcategory) => subcategory.name),
    }))
  )
}

export function IncomeForm({
  variant = 'outline',
  size = 'default',
  className,
  triggerText = 'Nuevo Ingreso',
}: IncomeFormProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const [formData, setFormData] = useState<IncomeFormState>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [manualCategories, setManualCategories] = useState<IncomeCategoryOption[]>([])

  const { data: serverCategories } = trpc.incomes.getCategories.useQuery()

  const categories = useMemo(
    () => mergeIncomeCategories(serverCategories ?? [], manualCategories),
    [serverCategories, manualCategories]
  )

  const selectedCategory = categories.find(
    (category) =>
      normalizeIncomeCategoryText(category.name) ===
      normalizeIncomeCategoryText(formData.category)
  )
  const subcategories = selectedCategory?.subcategories ?? []

  const upsertManualCategory = (categoryName: string, subcategoryName?: string) => {
    setManualCategories((prev) => {
      const map = new Map(
        prev.map((category) => [
          normalizeIncomeCategoryText(category.name),
          {
            name: category.name,
            subcategories: [...category.subcategories],
          },
        ])
      )

      const key = normalizeIncomeCategoryText(categoryName)
      const current = map.get(key) ?? { name: categoryName, subcategories: [] }

      if (
        subcategoryName &&
        !current.subcategories.some(
          (subcategory) =>
            normalizeIncomeCategoryText(subcategory) ===
            normalizeIncomeCategoryText(subcategoryName)
        )
      ) {
        current.subcategories.push(subcategoryName)
      }

      map.set(key, current)
      return Array.from(map.values())
    })
  }

  const createCategoryMutation = trpc.incomes.createCategory.useMutation({
    onSuccess: (created) => {
      upsertManualCategory(created.name)
      setFormData((prev) => ({
        ...prev,
        category: created.name,
        subcategory: '',
      }))
      setNewCategoryName('')
      toast({
        title: 'Categoria creada',
        description: `Se agrego "${created.name}"`,
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

  const createSubcategoryMutation = trpc.incomes.createSubcategory.useMutation({
    onSuccess: (created) => {
      upsertManualCategory(created.category, created.name)
      setFormData((prev) => ({ ...prev, category: created.category, subcategory: created.name }))
      setNewSubcategoryName('')
      toast({
        title: 'Subcategoria creada',
        description: `Se agrego "${created.name}"`,
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

  const seedMutation = trpc.incomes.seedDefaultCategories.useMutation({
    onSuccess: (result) => {
      utils.incomes.getCategories.invalidate()
      toast({
        title: 'Categorias base listas',
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

  const normalizeMutation = trpc.incomes.normalizeCategories.useMutation({
    onSuccess: (result) => {
      utils.incomes.getCategories.invalidate()
      utils.incomes.list.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
      toast({
        title: 'Ingresos normalizados',
        description: `Ajustados ${result.normalizedIncomes} ingresos`,
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

  const createMutation = trpc.incomes.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Ingreso registrado',
        description: 'El ingreso se registro exitosamente',
      })
      setOpen(false)
      setFormData(initialFormData)
      setErrors({})
      setNewCategoryName('')
      setNewSubcategoryName('')
      utils.dashboard.getMonthlyBalance.invalidate()
      utils.incomes.list.invalidate()
      utils.incomes.getCategories.invalidate()
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}

    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida'
    }

    let parsedAmount = 0
    if (!formData.amount) {
      newErrors.amount = 'El monto es requerido'
    } else {
      parsedAmount = parseFloat(formData.amount.replace(',', '.'))
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        newErrors.amount = 'El monto debe ser mayor a 0'
      }
    }

    if (!formData.category.trim()) {
      newErrors.category = 'La categoría es requerida'
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      return
    }

    createMutation.mutate({
      description: formData.description.trim(),
      amount: parsedAmount,
      date: parseInputDate(formData.date),
      category: formData.category,
      subcategory: formData.subcategory.trim() || undefined,
      isRecurring: formData.isRecurring,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Plus className="h-4 w-4 mr-2" />
          {triggerText}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Ingreso</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description" className={errors.description ? "text-red-500" : ""}>Descripcion</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                if (errors.description) setErrors({ ...errors, description: '' })
              }}
              placeholder="Ej: Sueldo Enero"
              className={errors.description ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AmountInput
              label="Monto"
              value={formData.amount}
              onChange={(value) => {
                setFormData({ ...formData, amount: value })
                if (errors.amount) setErrors({ ...errors, amount: '' })
              }}
              error={errors.amount}
              placeholder="Ej: 50000"
            />

            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <DatePicker
                date={formData.date ? parseInputDate(formData.date) : undefined}
                onSelect={(date) =>
                  setFormData({
                    ...formData,
                    date: date ? formatDateToInput(date) : formatDateToInput(new Date()),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className={errors.category ? "text-red-500" : ""}>Categoria</Label>

            <Select
              value={formData.category}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, category: value, subcategory: '' }))
                if (errors.category) setErrors({ ...errors, category: '' })
              }}
            >
              <SelectTrigger id="category" className={errors.category ? "border-red-500 focus-visible:ring-red-500" : ""}>
                <SelectValue placeholder="Seleccionar categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategoria (opcional)</Label>
            {formData.category ? (
              <>
                <Select
                  value={formData.subcategory || EMPTY_SUBCATEGORY_VALUE}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      subcategory: value === EMPTY_SUBCATEGORY_VALUE ? '' : value,
                    })
                  }
                >
                  <SelectTrigger id="subcategory">
                    <SelectValue placeholder="Seleccionar subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SUBCATEGORY_VALUE}>Sin subcategoria</SelectItem>
                    {subcategories.map((subcategory) => (
                      <SelectItem key={subcategory} value={subcategory}>
                        {subcategory}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <Input disabled placeholder="Selecciona una categoria primero" />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isRecurring"
              checked={formData.isRecurring}
              onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="isRecurring" className="cursor-pointer">
              Es recurrente (mensual)
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
