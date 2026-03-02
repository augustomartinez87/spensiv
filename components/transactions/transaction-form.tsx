'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/hooks/use-toast'
import { Switch } from '@/components/ui/switch'
import { ToastAction } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import {
  Plus,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Users,
  Check,
  Sparkles,
  RefreshCcw,
} from 'lucide-react'
import { formatDateToInput, parseInputDate, formatCurrency, cn } from '@/lib/utils'

type PaymentMethod = 'credit_card' | 'debit_card' | 'cash' | 'transfer'
type ExpenseType = 'structural' | 'emotional_recurrent' | 'emotional_impulsive'

interface TransactionFormData {
  description: string
  totalAmount: string
  purchaseDate: string
  paymentMethod: PaymentMethod
  cardId: string
  installments: string
  categoryId: string
  subcategoryId: string
  expenseType: ExpenseType
  notes: string
  isForThirdParty: boolean
  personId: string
  personName: string
}

const initialFormData: TransactionFormData = {
  description: '',
  totalAmount: '',
  purchaseDate: formatDateToInput(new Date()),
  paymentMethod: 'credit_card',
  cardId: '',
  installments: '1',
  categoryId: '',
  subcategoryId: '',
  expenseType: 'structural',
  notes: '',
  isForThirdParty: false,
  personId: '',
  personName: '',
}

const expenseTypeOptions = [
  { value: 'structural', label: 'Estructural', color: 'bg-blue-500', textColor: 'text-blue-400' },
  { value: 'emotional_recurrent', label: 'Emocional Recurrente', color: 'bg-orange-500', textColor: 'text-orange-400' },
  { value: 'emotional_impulsive', label: 'Emocional Impulsivo', color: 'bg-red-500', textColor: 'text-red-400' },
] as const

interface TransactionFormProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  triggerText?: string
}

export function TransactionForm({ 
  variant = 'default', 
  size = 'default',
  className,
  triggerText = 'Nuevo Gasto'
}: TransactionFormProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const router = useRouter()

  const [formData, setFormData] = useState<TransactionFormData>(initialFormData)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')

  const { data: cards } = trpc.cards.list.useQuery()
  const { data: categories } = trpc.transactions.getCategories.useQuery()
  const { data: persons } = trpc.persons.list.useQuery(undefined, {
    enabled: formData.isForThirdParty,
  })

  const selectedCategory = categories?.find((c) => c.id === formData.categoryId)
  const subcategories = selectedCategory?.subcategories ?? []

  const createCategoryMutation = trpc.transactions.createCategory.useMutation({
    onSuccess: (created) => {
      setFormData((prev) => ({
        ...prev,
        categoryId: created.id,
        subcategoryId: '',
      }))
      setNewCategoryName('')
      utils.transactions.getCategories.invalidate()
      utils.budget.listCategories.invalidate()
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

  const createSubcategoryMutation = trpc.transactions.createSubcategory.useMutation({
    onSuccess: (created) => {
      setFormData((prev) => ({ ...prev, subcategoryId: created.id }))
      setNewSubcategoryName('')
      utils.transactions.getCategories.invalidate()
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

  const seedExpenseCategoriesMutation =
    trpc.transactions.seedExpenseCategories.useMutation({
      onSuccess: (result) => {
        utils.transactions.getCategories.invalidate()
        utils.budget.listCategories.invalidate()
        toast({
          title: 'Categorias base sincronizadas',
          description: `${result.totalCategories} categorias y ${result.totalSubcategories} subcategorias disponibles`,
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

  const normalizeExpenseCategoriesMutation =
    trpc.transactions.normalizeExpenseCategories.useMutation({
      onSuccess: (result) => {
        utils.transactions.getCategories.invalidate()
        utils.transactions.list.invalidate()
        utils.budget.listCategories.invalidate()
        utils.budget.getProgress.invalidate()
        toast({
          title: 'Categorias normalizadas',
          description: `Migradas: ${result.migratedCategories} categorias, ${result.migratedTransactions} transacciones, ${result.removedSubcategories ?? 0} subcategorias limpias`,
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

  const createMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      const wasForThirdParty = formData.isForThirdParty
      setOpen(false)
      setFormData(initialFormData)
      setNewCategoryName('')
      setNewSubcategoryName('')
      utils.dashboard.getMonthlyBalance.invalidate()
      utils.transactions.list.invalidate()
      utils.dashboard.getCardBalances.invalidate()

      if (wasForThirdParty) {
        utils.thirdPartyPurchases.getPendingTransactions.invalidate()
        toast({
          title: 'Compra de tercero registrada',
          description: 'Completá los datos del tercero para hacer seguimiento del cobro',
          action: (
            <ToastAction altText="Ir a terceros" onClick={() => router.push('/dashboard/third-party')}>
              Completar
            </ToastAction>
          ),
        })
      } else {
        toast({
          title: 'Gasto registrado',
          description: 'El gasto se registró exitosamente',
        })
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const createThirdPartyMutation = trpc.thirdPartyPurchases.create.useMutation({
    onSuccess: () => {
      setOpen(false)
      setFormData(initialFormData)
      setNewCategoryName('')
      setNewSubcategoryName('')
      utils.dashboard.getMonthlyBalance.invalidate()
      utils.transactions.list.invalidate()
      utils.dashboard.getCardBalances.invalidate()
      utils.thirdPartyPurchases.list.invalidate()
      toast({
        title: 'Compra de tercero registrada',
        description: 'La compra se registró con seguimiento de cobro',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(formData.totalAmount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Error',
        description: 'El monto debe ser mayor a 0',
        variant: 'destructive',
      })
      return
    }

    if (formData.paymentMethod === 'credit_card' && !formData.cardId) {
      toast({
        title: 'Error',
        description: 'Seleccioná una tarjeta',
        variant: 'destructive',
      })
      return
    }

    // Si es para un tercero y tiene nombre, crear ThirdPartyPurchase completo
    if (formData.isForThirdParty && formData.personName.trim() && formData.paymentMethod === 'credit_card') {
      createThirdPartyMutation.mutate({
        description: formData.description,
        personId: formData.personId || undefined,
        personName: formData.personName.trim(),
        cardId: formData.cardId,
        totalAmount: amount,
        installments: parseInt(formData.installments) || 1,
        currency: 'ARS',
        purchaseDate: formatDateToInput(parseInputDate(formData.purchaseDate)),
        categoryId: formData.categoryId || undefined,
        subcategoryId: formData.subcategoryId || undefined,
        expenseType: formData.expenseType || undefined,
        notes: formData.notes || undefined,
      })
      return
    }

    createMutation.mutate({
      description: formData.isForThirdParty ? `[Tercero] ${formData.description}` : formData.description,
      totalAmount: amount,
      purchaseDate: parseInputDate(formData.purchaseDate),
      paymentMethod: formData.paymentMethod,
      cardId: formData.paymentMethod === 'credit_card' ? formData.cardId : undefined,
      installments: formData.paymentMethod === 'credit_card' ? parseInt(formData.installments) : 1,
      categoryId: formData.categoryId || undefined,
      subcategoryId: formData.subcategoryId || undefined,
      expenseType: formData.expenseType,
      notes: formData.notes || undefined,
      isForThirdParty: formData.isForThirdParty || undefined,
    })
  }

  const isCardPayment = formData.paymentMethod === 'credit_card'
  const isCreditCard = formData.paymentMethod === 'credit_card'
  const monthlyInstallment = isCreditCard && formData.totalAmount && formData.installments
    ? parseFloat(formData.totalAmount.replace(',', '.')) / parseInt(formData.installments || '1')
    : 0

  const selectedExpenseType = expenseTypeOptions.find(t => t.value === formData.expenseType)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Plus className="h-4 w-4 mr-2" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Gasto</DialogTitle>
          <DialogDescription>
            Registrá una nueva compra o gasto
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Medio de pago - Toggle de botones */}
          <div className="space-y-2">
            <Label>Medio de pago</Label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'credit_card', cardId: '', installments: '1' })}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                  formData.paymentMethod === 'credit_card'
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-xs font-medium">Crédito</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'debit_card', cardId: '', installments: '1' })}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                  formData.paymentMethod === 'debit_card'
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-xs font-medium">Débito</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'cash', cardId: '', installments: '1' })}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                  formData.paymentMethod === 'cash'
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                <Banknote className="h-5 w-5" />
                <span className="text-xs font-medium">Efectivo</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'transfer', cardId: '', installments: '1' })}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                  formData.paymentMethod === 'transfer'
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                <ArrowRightLeft className="h-5 w-5" />
                <span className="text-xs font-medium">Transferencia</span>
              </button>
            </div>
          </div>

          {/* Tarjeta (solo si es tarjeta) */}
          {isCardPayment && (
            <div className="space-y-2">
              <Label htmlFor="card">Tarjeta *</Label>
              <Select
                value={formData.cardId}
                onValueChange={(value) => setFormData({ ...formData, cardId: value })}
              >
                <SelectTrigger id="card">
                  <SelectValue placeholder="Seleccionar tarjeta" />
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

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ej: Supermercado Día"
              required
            />
          </div>

          {/* Monto y Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto total *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={formData.totalAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.,]/g, '')
                    setFormData({ ...formData, totalAmount: value })
                  }}
                  placeholder="0,00"
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Fecha *</Label>
              <DatePicker
                date={formData.purchaseDate ? parseInputDate(formData.purchaseDate) : undefined}
                onSelect={(date) => setFormData({ ...formData, purchaseDate: date ? formatDateToInput(date) : formatDateToInput(new Date()) })}
              />
            </div>
          </div>

          {/* Cuotas (solo crédito) */}
          {isCreditCard && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="installments">Cuotas</Label>
                {monthlyInstallment > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(monthlyInstallment)} / mes
                  </span>
                )}
              </div>
              <Input
                id="installments"
                type="number"
                min="1"
                max="60"
                value={formData.installments}
                onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
              />
            </div>
          )}

          {/* Para tercero (solo crédito) */}
          {isCreditCard && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3 p-3">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-purple-500 shrink-0" />
                <Label htmlFor="is-third-party" className="flex-1 text-sm cursor-pointer">
                  Es para un tercero
                </Label>
                <Switch
                  id="is-third-party"
                  checked={formData.isForThirdParty}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isForThirdParty: checked, personId: '', personName: '' })
                  }
                />
              </div>
              {formData.isForThirdParty && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Persona</Label>
                    <Select
                      value={formData.personId || '_none'}
                      onValueChange={(v) => {
                        if (v === '_none') {
                          setFormData({ ...formData, personId: '', personName: '' })
                          return
                        }
                        const p = persons?.find((p) => p.id === v)
                        if (p) setFormData({ ...formData, personId: p.id, personName: p.name })
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nombre libre</SelectItem>
                        {persons?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre *</Label>
                    <Input
                      className="h-8 text-xs"
                      value={formData.personName}
                      onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                      placeholder="Nombre del tercero"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Categoría */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="category">Categoría</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => router.push('/dashboard/categories')}
                >
                  Gestionar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => seedExpenseCategoriesMutation.mutate()}
                  disabled={seedExpenseCategoriesMutation.isPending}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Base
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => normalizeExpenseCategoriesMutation.mutate()}
                  disabled={normalizeExpenseCategoriesMutation.isPending || !categories?.length}
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                  Normalizar
                </Button>
              </div>
            </div>

            <Select
              value={formData.categoryId}
              onValueChange={(value) =>
                setFormData({ ...formData, categoryId: value, subcategoryId: '' })
              }
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nueva categoría..."
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    e.preventDefault()
                    createCategoryMutation.mutate({ name: newCategoryName.trim() })
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                onClick={() => createCategoryMutation.mutate({ name: newCategoryName.trim() })}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Subcategoría */}
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategoría</Label>
            {formData.categoryId ? (
              <>
                <Select
                  value={formData.subcategoryId}
                  onValueChange={(value) => setFormData({ ...formData, subcategoryId: value })}
                >
                  <SelectTrigger id="subcategory">
                    <SelectValue placeholder="Seleccionar subcategoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                    placeholder="Nueva subcategoría..."
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubcategoryName.trim()) {
                        e.preventDefault()
                        createSubcategoryMutation.mutate({
                          categoryId: formData.categoryId,
                          name: newSubcategoryName.trim(),
                        })
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={!newSubcategoryName.trim() || createSubcategoryMutation.isPending}
                    onClick={() => {
                      createSubcategoryMutation.mutate({
                        categoryId: formData.categoryId,
                        name: newSubcategoryName.trim(),
                      })
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <Select disabled>
                <SelectTrigger id="subcategory">
                  <SelectValue placeholder="Seleccioná una categoría primero" />
                </SelectTrigger>
                <SelectContent />
              </Select>
            )}
          </div>

          {/* Tipo de gasto con indicadores de color */}
          <div className="space-y-2">
            <Label>Tipo de gasto</Label>
            <div className="grid grid-cols-3 gap-2">
              {expenseTypeOptions.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, expenseType: type.value })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                    formData.expenseType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full", type.color)} />
                  <span className={cn("text-xs font-medium", formData.expenseType === type.value ? type.textColor : "text-muted-foreground")}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales sobre el gasto..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || createThirdPartyMutation.isPending}>
              {(createMutation.isPending || createThirdPartyMutation.isPending) ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
