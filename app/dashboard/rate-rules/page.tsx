'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Pencil, Check, X, Users, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ── Borrower Types Section ────────────────────────────────────────────

function BorrowerTypesSection() {
  const utils = trpc.useUtils()
  const { toast } = useToast()
  const { data: types, isLoading } = trpc.rateRules.listBorrowerTypes.useQuery()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTna, setEditTna] = useState('')

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTna, setNewTna] = useState('')

  const upsert = trpc.rateRules.upsertBorrowerType.useMutation({
    onSuccess: () => {
      utils.rateRules.listBorrowerTypes.invalidate()
      setEditingId(null)
      setAdding(false)
      setNewName('')
      setNewTna('')
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  })

  const deleteMut = trpc.rateRules.deleteBorrowerType.useMutation({
    onSuccess: () => utils.rateRules.listBorrowerTypes.invalidate(),
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  })

  function startEdit(id: string, name: string, tna: number) {
    setEditingId(id)
    setEditName(name)
    setEditTna(String(tna))
  }

  function saveEdit(id: string) {
    if (!editName.trim() || !editTna) return
    upsert.mutate({ id, name: editName.trim(), baseTna: parseFloat(editTna) })
  }

  function saveNew() {
    if (!newName.trim() || !newTna) return
    upsert.mutate({ name: newName.trim(), baseTna: parseFloat(newTna) })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Tipos de Prestatario
            </CardTitle>
            <CardDescription>TNA mínima base según el tipo de cliente</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_80px] gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
              <span>Tipo de cliente</span>
              <span>TNA mínima</span>
              <span></span>
            </div>

            {types?.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[1fr_120px_80px] gap-2 items-center px-3 py-2 rounded-md hover:bg-muted/50"
              >
                {editingId === t.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editTna}
                        onChange={(e) => setEditTna(e.target.value)}
                        className="h-8"
                        min={0}
                        step={1}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(t.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-sm">{Number(t.baseTna)}%</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEdit(t.id, t.name, Number(t.baseTna))}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate({ id: t.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {types?.length === 0 && !adding && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay tipos definidos. Agregá al menos uno para usar la sugerencia de tasas.
              </p>
            )}

            {/* Add row */}
            {adding && (
              <div className="grid grid-cols-[1fr_120px_80px] gap-2 items-center px-3 py-2 rounded-md bg-muted/30">
                <Input
                  placeholder="Ej: Amigo / Conocido"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="110"
                    value={newTna}
                    onChange={(e) => setNewTna(e.target.value)}
                    className="h-8"
                    min={0}
                    step={1}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveNew} disabled={upsert.isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setNewName(''); setNewTna('') }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Duration Adjustments Section ──────────────────────────────────────

function DurationAdjustmentsSection() {
  const utils = trpc.useUtils()
  const { toast } = useToast()
  const { data: adjustments, isLoading } = trpc.rateRules.listDurationAdjustments.useQuery()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMin, setEditMin] = useState('')
  const [editMax, setEditMax] = useState('')
  const [editAdj, setEditAdj] = useState('')

  const [adding, setAdding] = useState(false)
  const [newMin, setNewMin] = useState('')
  const [newMax, setNewMax] = useState('')
  const [newAdj, setNewAdj] = useState('')

  const upsert = trpc.rateRules.upsertDurationAdjustment.useMutation({
    onSuccess: () => {
      utils.rateRules.listDurationAdjustments.invalidate()
      setEditingId(null)
      setAdding(false)
      setNewMin('')
      setNewMax('')
      setNewAdj('')
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  })

  const deleteMut = trpc.rateRules.deleteDurationAdjustment.useMutation({
    onSuccess: () => utils.rateRules.listDurationAdjustments.invalidate(),
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  })

  function startEdit(id: string, min: number, max: number, adj: number) {
    setEditingId(id)
    setEditMin(String(min))
    setEditMax(String(max))
    setEditAdj(String(adj))
  }

  function saveEdit(id: string) {
    if (!editMin || !editMax || !editAdj) return
    upsert.mutate({
      id,
      minMonths: parseInt(editMin),
      maxMonths: parseInt(editMax),
      adjustment: parseFloat(editAdj),
    })
  }

  function saveNew() {
    if (!newMin || !newMax) return
    upsert.mutate({
      minMonths: parseInt(newMin),
      maxMonths: parseInt(newMax),
      adjustment: parseFloat(newAdj || '0'),
    })
  }

  function formatRange(min: number, max: number) {
    if (min === 0) return `Hasta ${max} meses`
    return `${min} a ${max} meses`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ajuste por Plazo
            </CardTitle>
            <CardDescription>
              A mayor plazo, mayor tasa. Este ajuste se suma a la TNA base del tipo de cliente.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar tramo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_100px_120px_80px] gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
              <span>Rango</span>
              <span>Desde (m)</span>
              <span>Hasta (m)</span>
              <span>Ajuste TNA</span>
              <span></span>
            </div>

            {adjustments?.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_100px_100px_120px_80px] gap-2 items-center px-3 py-2 rounded-md hover:bg-muted/50"
              >
                {editingId === a.id ? (
                  <>
                    <span className="text-sm text-muted-foreground">-</span>
                    <Input
                      type="number"
                      value={editMin}
                      onChange={(e) => setEditMin(e.target.value)}
                      className="h-8"
                      min={0}
                    />
                    <Input
                      type="number"
                      value={editMax}
                      onChange={(e) => setEditMax(e.target.value)}
                      className="h-8"
                      min={1}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">+</span>
                      <Input
                        type="number"
                        value={editAdj}
                        onChange={(e) => setEditAdj(e.target.value)}
                        className="h-8"
                        min={0}
                        step={1}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(a.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">{formatRange(a.minMonths, a.maxMonths)}</span>
                    <span className="text-sm">{a.minMonths}</span>
                    <span className="text-sm">{a.maxMonths}</span>
                    <span className="text-sm">+{Number(a.adjustment)}%</span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEdit(a.id, a.minMonths, a.maxMonths, Number(a.adjustment))}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate({ id: a.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Add row */}
            {adding && (
              <div className="grid grid-cols-[1fr_100px_100px_120px_80px] gap-2 items-center px-3 py-2 rounded-md bg-muted/30">
                <span className="text-sm text-muted-foreground">Nuevo tramo</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={newMin}
                  onChange={(e) => setNewMin(e.target.value)}
                  className="h-8"
                  min={0}
                  autoFocus
                />
                <Input
                  type="number"
                  placeholder="3"
                  value={newMax}
                  onChange={(e) => setNewMax(e.target.value)}
                  className="h-8"
                  min={1}
                />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">+</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newAdj}
                    onChange={(e) => setNewAdj(e.target.value)}
                    className="h-8"
                    min={0}
                    step={1}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveNew} disabled={upsert.isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setNewMin(''); setNewMax(''); setNewAdj('') }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Example Preview ───────────────────────────────────────────────────

function RatePreview() {
  const { data: types } = trpc.rateRules.listBorrowerTypes.useQuery()
  const { data: adjustments } = trpc.rateRules.listDurationAdjustments.useQuery()

  if (!types?.length || !adjustments?.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vista Previa: Curva de Tasas</CardTitle>
        <CardDescription>TNA resultante = TNA base + ajuste por plazo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                {adjustments.map((a) => (
                  <th key={a.id} className="text-center py-2 px-2 font-medium text-muted-foreground">
                    {a.minMonths === 0 ? `≤${a.maxMonths}m` : `${a.minMonths}-${a.maxMonths}m`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{t.name}</td>
                  {adjustments.map((a) => (
                    <td key={a.id} className="text-center py-2 px-2 tabular-nums">
                      {Number(t.baseTna) + Number(a.adjustment)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function RateRulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reglas de Tasas</h1>
        <p className="text-muted-foreground">
          Configurá las tasas mínimas de referencia según tipo de prestatario y plazo.
        </p>
      </div>

      <BorrowerTypesSection />
      <DurationAdjustmentsSection />
      <RatePreview />
    </div>
  )
}
