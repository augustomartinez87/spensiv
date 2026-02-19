'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CreditCard, Layers, Users } from 'lucide-react'

export default function InstallmentsPage() {
  const [includeThirdParty, setIncludeThirdParty] = useState(true)
  const [cardFilter, setCardFilter] = useState<string>('all')

  const { data: cards } = trpc.cards.list.useQuery()
  const { data: purchases, isLoading } = trpc.transactions.getActiveInstallmentPurchases.useQuery({
    includeThirdParty,
    cardId: cardFilter !== 'all' ? cardFilter : undefined,
  })

  const totalPending = purchases?.reduce((sum, p) => sum + p.installmentAmount * p.pendingCount, 0) ?? 0
  const totalPurchases = purchases?.length ?? 0

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
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => {
            const progress = (p.paidCount / p.installments) * 100

            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{p.description}</p>
                        {p.isForThirdParty && (
                          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-0 text-[10px] shrink-0">
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

                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{formatCurrency(p.totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(p.installmentAmount)} / cuota
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
