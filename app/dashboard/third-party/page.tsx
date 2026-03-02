'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { ThirdPartyForm } from '@/components/third-party/third-party-form'
import { ThirdPartyDetail } from '@/components/third-party/third-party-detail'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, cn, formatDateToInput } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Users, CreditCard, Trash2, AlertCircle, RefreshCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface LinkFormData {
  personName: string
  personId: string
  currency: 'ARS' | 'USD'
  notes: string
}

const initialLinkForm: LinkFormData = {
  personName: '',
  personId: '',
  currency: 'ARS',
  notes: '',
}

export default function ThirdPartyPage() {
  const [tab, setTab] = useState<'active' | 'completed' | 'all'>('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkingTxId, setLinkingTxId] = useState<string | null>(null)
  const [linkForm, setLinkForm] = useState<LinkFormData>(initialLinkForm)
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const { data: purchases, isLoading } = trpc.thirdPartyPurchases.list.useQuery({
    status: tab,
  })

  const { data: pendingTxs } = trpc.thirdPartyPurchases.getPendingTransactions.useQuery()
  const { data: persons } = trpc.persons.list.useQuery()

  const deleteMutation = trpc.thirdPartyPurchases.delete.useMutation({
    onSuccess: () => {
      toast({ title: 'Compra eliminada' })
      utils.thirdPartyPurchases.list.invalidate()
      utils.dashboard.getCardBalances.invalidate()
      utils.dashboard.getMonthlyBalance.invalidate()
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  const recalcMutation = trpc.thirdPartyPurchases.recalculateDates.useMutation({
    onSuccess: (result) => {
      toast({
        title: 'Fechas recalculadas',
        description: `${result.cyclesFixed} ciclos y ${result.installmentsFixed} cuotas actualizadas`,
      })
      utils.thirdPartyPurchases.list.invalidate()
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  const linkMutation = trpc.thirdPartyPurchases.createFromTransaction.useMutation({
    onSuccess: () => {
      toast({ title: 'Compra de tercero vinculada' })
      setLinkingTxId(null)
      setLinkForm(initialLinkForm)
      utils.thirdPartyPurchases.list.invalidate()
      utils.thirdPartyPurchases.getPendingTransactions.invalidate()
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Esto anulará la transacción subyacente en la tarjeta. ¿Continuar?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkingTxId || !linkForm.personName.trim()) return

    linkMutation.mutate({
      transactionId: linkingTxId,
      personName: linkForm.personName,
      personId: linkForm.personId || undefined,
      currency: linkForm.currency,
      notes: linkForm.notes || undefined,
    })
  }

  const handlePersonSelect = (personId: string) => {
    if (personId === '_none') {
      setLinkForm((prev) => ({ ...prev, personId: '', personName: '' }))
      return
    }
    const person = persons?.find((p) => p.id === personId)
    if (person) {
      setLinkForm((prev) => ({ ...prev, personId: person.id, personName: person.name }))
    }
  }

  const linkingTx = pendingTxs?.find((t) => t.id === linkingTxId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Compras de Terceros</h1>
          <p className="text-muted-foreground mt-1">Compras con tu tarjeta para otras personas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Recalcular fechas de cuotas usando el calendario de cierres. Esto corrige datos históricos. ¿Continuar?')) {
                recalcMutation.mutate()
              }
            }}
            disabled={recalcMutation.isPending}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Recalcular fechas
          </Button>
          <ThirdPartyForm />
        </div>
      </div>

      {/* Orphan transactions banner */}
      {pendingTxs && pendingTxs.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  Tenés {pendingTxs.length} compra{pendingTxs.length !== 1 ? 's' : ''} de tercero sin completar
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Completá los datos del tercero para hacer seguimiento del cobro
                </p>
                <div className="mt-3 space-y-2">
                  {pendingTxs.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {tx.card && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {tx.card.name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {tx.installments} cuota{tx.installments !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs font-medium">{formatCurrency(tx.totalAmount)}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLinkingTxId(tx.id)
                          setLinkForm(initialLinkForm)
                        }}
                      >
                        Completar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="completed">Completadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : !purchases || purchases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {tab === 'active' ? 'No hay compras activas' : tab === 'completed' ? 'No hay compras completadas' : 'No hay compras registradas'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => {
                const progress = p.installments > 0 ? (p.collectedCount / p.installments) * 100 : 0
                return (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                            <Users className="h-5 w-5 text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate">{p.description}</p>
                              <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                {p.status === 'completed' ? 'Completada' : 'Activa'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{p.personName}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {p.card.name}
                              </span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(p.purchaseDate), "d MMM yy", { locale: es })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-sm">{formatCurrency(p.totalAmount, p.currency)}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.collectedCount}/{p.installments} cobradas ({progress.toFixed(0)}%)
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={(e) => handleDelete(p.id, e)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <ThirdPartyDetail
        purchaseId={selectedId}
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
      />

      {/* Link orphan transaction dialog */}
      <Dialog open={!!linkingTxId} onOpenChange={(open) => { if (!open) setLinkingTxId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Completar datos del tercero</DialogTitle>
            <DialogDescription>
              {linkingTx && (
                <span>
                  {linkingTx.description} · {formatCurrency(linkingTx.totalAmount)} · {linkingTx.installments} cuota{linkingTx.installments !== 1 ? 's' : ''}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLinkSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Persona</Label>
                <Select value={linkForm.personId || '_none'} onValueChange={handlePersonSelect}>
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={linkForm.personName}
                  onChange={(e) => setLinkForm((prev) => ({ ...prev, personName: e.target.value }))}
                  placeholder="Nombre del tercero"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={linkForm.currency} onValueChange={(v: 'ARS' | 'USD') => setLinkForm((prev) => ({ ...prev, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={linkForm.notes}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={linkMutation.isPending}
            >
              {linkMutation.isPending ? 'Vinculando...' : 'Vincular compra'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
