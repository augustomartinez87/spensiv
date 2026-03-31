'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, ChevronDown, CreditCard, Layers, Undo2, Users } from 'lucide-react'

type SortOption = 'date' | 'progress' | 'pending'

export default function InstallmentsPage() {
  const [includeThirdParty, setIncludeThirdParty] = useState(true)
  const [cardFilter, setCardFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const { data: cards } = trpc.cards.list.useQuery()
  const { data: purchases, isLoading } = trpc.transactions.getActiveInstallmentPurchases.useQuery({
    includeThirdParty,
    cardId: cardFilter !== 'all' ? cardFilter : undefined,
  })

  const markPaid = trpc.transactions.markInstallmentPaid.useMutation({
    onSuccess: () => utils.transactions.getActiveInstallmentPurchases.invalidate(),
  })
  const unmarkPaid = trpc.transactions.unmarkInstallmentPaid.useMutation({
    onSuccess: () => utils.transactions.getActiveInstallmentPurchases.invalidate(),
  })

  const totalPending = purchases?.reduce((sum, p) => sum + p.installmentAmount * p.pendingCount, 0) ?? 0
  const totalPurchases = purchases?.length ?? 0

  const sortedPurchases = useMemo(() => {
    if (!purchases) return []
    const sorted = [...purchases]
    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
        break
      case 'progress':
        sorted.sort((a, b) => (b.paidCount / b.installments) - (a.paidCount / a.installments))
        break
      case 'pending':
        sorted.sort((a, b) => (b.installmentAmount * b.pendingCount) - (a.installmentAmount * a.pendingCount))
        break
    }
    return sorted
  }, [purchases, sortBy])

  // Group by card when showing all cards
  const grouped = useMemo(() => {
    if (cardFilter !== 'all' || !sortedPurchases.length) return null
    const groups = new Map<string, { card: typeof sortedPurchases[0]['card']; items: typeof sortedPurchases }>()
    for (const p of sortedPurchases) {
      const key = p.card?.id ?? 'sin-tarjeta'
      if (!groups.has(key)) {
        groups.set(key, { card: p.card, items: [] })
      }
      groups.get(key)!.items.push(p)
    }
    return Array.from(groups.values())
  }, [sortedPurchases, cardFilter])

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id))

  function renderPurchaseCard(p: typeof sortedPurchases[0]) {
    const progress = (p.paidCount / p.installments) * 100
    const isExpanded = expandedId === p.id

    return (
      <Card key={p.id} className="overflow-hidden">
        <CardContent className="p-0">
          {/* Summary row - clickable */}
          <button
            className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
            onClick={() => toggle(p.id)}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{p.description}</p>
                  {p.isForThirdParty && (
                    <Badge className="bg-purple-500/15 text-purple-400 border-0 text-[10px] shrink-0">
                      <Users className="h-3 w-3 mr-1" />
                      Tercero
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {p.card && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {p.card.name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(p.purchaseDate), "d MMM yy", { locale: es })}
                  </span>
                  {p.category && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{p.category.name}</span>
                    </>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        p.isForThirdParty ? "bg-purple-500" : "bg-primary"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {p.paidCount}/{p.installments} cuotas
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-bold text-sm">{formatCurrency(p.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(p.installmentAmount)} / cuota
                  </p>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </div>
            </div>
          </button>

          {/* Expanded: installment list */}
          {isExpanded && (
            <div className="border-t">
              <div className="divide-y">
                {p.installmentsList.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground w-6">
                        #{inst.installmentNumber}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(inst.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(inst.dueDate), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inst.isPaid ? (
                        <>
                          <Badge variant="default" className="bg-emerald-600 text-xs">Pagada</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => unmarkPaid.mutate({ installmentId: inst.id })}
                            disabled={unmarkPaid.isPending}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => markPaid.mutate({ installmentId: inst.id })}
                          disabled={markPaid.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Marcar pagada
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Compras en Cuotas</h1>
        <p className="text-muted-foreground mt-1">Seguimiento de todas tus compras en cuotas activas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Switch
            id="include-third-party"
            checked={includeThirdParty}
            onCheckedChange={setIncludeThirdParty}
          />
          <Label htmlFor="include-third-party" className="text-sm cursor-pointer">
            Incluir terceros
          </Label>
        </div>

        <Select value={cardFilter} onValueChange={setCardFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas las tarjetas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tarjetas</SelectItem>
            {cards?.map((card) => (
              <SelectItem key={card.id} value={card.id}>
                {card.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Fecha de compra</SelectItem>
            <SelectItem value="progress">Progreso (%)</SelectItem>
            <SelectItem value="pending">Monto pendiente</SelectItem>
          </SelectContent>
        </Select>

        {totalPurchases > 0 && (
          <div className="text-sm text-muted-foreground ml-auto">
            {totalPurchases} compra{totalPurchases !== 1 ? 's' : ''} · {formatCurrency(totalPending)} pendiente
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !purchases || purchases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No hay compras en cuotas activas</p>
          </CardContent>
        </Card>
      ) : grouped ? (
        /* Grouped by card */
        <div className="space-y-6">
          {grouped.map((group) => {
            const groupPending = group.items.reduce((s, p) => s + p.installmentAmount * p.pendingCount, 0)
            return (
              <div key={group.card?.id ?? 'sin-tarjeta'}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">{group.card?.name ?? 'Sin tarjeta'}</h2>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} compra{group.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatCurrency(groupPending)} pendiente
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map(renderPurchaseCard)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Flat list (filtered by specific card) */
        <div className="space-y-2">
          {sortedPurchases.map(renderPurchaseCard)}
        </div>
      )}
    </div>
  )
}
