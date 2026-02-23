'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Pencil, Plus, RefreshCcw, Sparkles, Trash2, X } from 'lucide-react'

export default function CategoriesPage() {
  const utils = trpc.useUtils()
  const { toast } = useToast()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryNames, setNewSubcategoryNames] = useState<Record<string, string>>({})

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null)
  const [editingSubcategoryName, setEditingSubcategoryName] = useState('')
  const [editingSubcategoryCategoryId, setEditingSubcategoryCategoryId] = useState('')

  const { data: categories, isLoading } = trpc.transactions.getCategories.useQuery()

  const invalidateAll = () => {
    utils.transactions.getCategories.invalidate()
    utils.transactions.list.invalidate()
    utils.budget.listCategories.invalidate()
    utils.budget.getProgress.invalidate()
  }

  const createCategoryMutation = trpc.transactions.createCategory.useMutation({
    onSuccess: () => {
      setNewCategoryName('')
      invalidateAll()
      toast({
        title: 'Categoria creada',
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

  const updateCategoryMutation = trpc.transactions.updateCategory.useMutation({
    onSuccess: () => {
      setEditingCategoryId(null)
      setEditingCategoryName('')
      invalidateAll()
      toast({
        title: 'Categoria actualizada',
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

  const deleteCategoryMutation = trpc.transactions.deleteCategory.useMutation({
    onSuccess: () => {
      invalidateAll()
      toast({
        title: 'Categoria eliminada',
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
    onSuccess: (_, variables) => {
      setNewSubcategoryNames((prev) => ({
        ...prev,
        [variables.categoryId]: '',
      }))
      invalidateAll()
      toast({
        title: 'Subcategoria creada',
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

  const updateSubcategoryMutation = trpc.transactions.updateSubcategory.useMutation({
    onSuccess: () => {
      setEditingSubcategoryId(null)
      setEditingSubcategoryName('')
      setEditingSubcategoryCategoryId('')
      invalidateAll()
      toast({
        title: 'Subcategoria actualizada',
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

  const deleteSubcategoryMutation = trpc.transactions.deleteSubcategory.useMutation({
    onSuccess: () => {
      invalidateAll()
      toast({
        title: 'Subcategoria eliminada',
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

  const seedMutation = trpc.transactions.seedExpenseCategories.useMutation({
    onSuccess: (result) => {
      invalidateAll()
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

  const normalizeMutation = trpc.transactions.normalizeExpenseCategories.useMutation({
    onSuccess: (result) => {
      invalidateAll()
      toast({
        title: 'Categorias reorganizadas',
        description: `Migradas ${result.migratedCategories} categorias, ${result.migratedTransactions} transacciones`,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Categorias</h1>
          <p className="text-muted-foreground mt-1">
            Administra categorias y subcategorias de egresos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={() => normalizeMutation.mutate()}
            disabled={normalizeMutation.isPending}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            {normalizeMutation.isPending ? 'Reorganizando...' : 'Reorganizar estructura'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Nueva categoria</CardTitle>
          <CardDescription>Crear una categoria principal para egresos</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              const name = newCategoryName.trim()
              if (!name) return
              createCategoryMutation.mutate({ name })
            }}
          >
            <Input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Ej: Salud preventiva"
            />
            <Button
              type="submit"
              className="sm:w-auto"
              disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-36" />
          ))}
        </div>
      ) : !categories?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay categorias disponibles.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const subcategories = category.subcategories || []
            const isEditingCategory = editingCategoryId === category.id
            const pendingSubcategoryName = newSubcategoryNames[category.id] || ''

            return (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditingCategory ? (
                        <div className="space-y-2">
                          <Label htmlFor={`category-${category.id}`}>Nombre de categoria</Label>
                          <Input
                            id={`category-${category.id}`}
                            value={editingCategoryName}
                            onChange={(event) => setEditingCategoryName(event.target.value)}
                            placeholder="Nombre de categoria"
                          />
                        </div>
                      ) : (
                        <>
                          <CardTitle className="text-xl">{category.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {subcategories.length} subcategorias
                          </CardDescription>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {isEditingCategory ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateCategoryMutation.mutate({
                                id: category.id,
                                name: editingCategoryName,
                              })
                            }
                            disabled={!editingCategoryName.trim() || updateCategoryMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingCategoryId(null)
                              setEditingCategoryName('')
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingCategoryId(category.id)
                              setEditingCategoryName(category.name)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            onClick={() => {
                              const shouldDelete = window.confirm(
                                `Eliminar categoria "${category.name}"? Las transacciones quedaran sin categoria.`
                              )
                              if (!shouldDelete) return
                              deleteCategoryMutation.mutate({ id: category.id })
                            }}
                            disabled={deleteCategoryMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {subcategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Esta categoria no tiene subcategorias.
                      </p>
                    ) : (
                      subcategories.map((subcategory) => {
                        const isEditingSubcategory = editingSubcategoryId === subcategory.id

                        if (isEditingSubcategory) {
                          return (
                            <div
                              key={subcategory.id}
                              className="rounded-lg border border-border p-3 space-y-2"
                            >
                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`subcategory-name-${subcategory.id}`}>
                                    Nombre
                                  </Label>
                                  <Input
                                    id={`subcategory-name-${subcategory.id}`}
                                    value={editingSubcategoryName}
                                    onChange={(event) =>
                                      setEditingSubcategoryName(event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`subcategory-category-${subcategory.id}`}>
                                    Categoria
                                  </Label>
                                  <Select
                                    value={editingSubcategoryCategoryId}
                                    onValueChange={setEditingSubcategoryCategoryId}
                                  >
                                    <SelectTrigger id={`subcategory-category-${subcategory.id}`}>
                                      <SelectValue placeholder="Selecciona categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories.map((optionCategory) => (
                                        <SelectItem key={optionCategory.id} value={optionCategory.id}>
                                          {optionCategory.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    updateSubcategoryMutation.mutate({
                                      id: subcategory.id,
                                      name: editingSubcategoryName,
                                      categoryId: editingSubcategoryCategoryId,
                                    })
                                  }
                                  disabled={
                                    !editingSubcategoryName.trim() ||
                                    !editingSubcategoryCategoryId ||
                                    updateSubcategoryMutation.isPending
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingSubcategoryId(null)
                                    setEditingSubcategoryName('')
                                    setEditingSubcategoryCategoryId('')
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div
                            key={subcategory.id}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                          >
                            <span className="text-sm text-foreground">{subcategory.name}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingSubcategoryId(subcategory.id)
                                  setEditingSubcategoryName(subcategory.name)
                                  setEditingSubcategoryCategoryId(category.id)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                onClick={() => {
                                  const shouldDelete = window.confirm(
                                    `Eliminar subcategoria "${subcategory.name}"?`
                                  )
                                  if (!shouldDelete) return
                                  deleteSubcategoryMutation.mutate({ id: subcategory.id })
                                }}
                                disabled={deleteSubcategoryMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const name = pendingSubcategoryName.trim()
                      if (!name) return
                      createSubcategoryMutation.mutate({
                        categoryId: category.id,
                        name,
                      })
                    }}
                  >
                    <Input
                      value={pendingSubcategoryName}
                      onChange={(event) =>
                        setNewSubcategoryNames((prev) => ({
                          ...prev,
                          [category.id]: event.target.value,
                        }))
                      }
                      placeholder="Nueva subcategoria..."
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={!pendingSubcategoryName.trim() || createSubcategoryMutation.isPending}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
