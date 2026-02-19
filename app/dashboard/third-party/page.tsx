'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { ThirdPartyForm } from '@/components/third-party/third-party-form'
import { ThirdPartyDetail } from '@/components/third-party/third-party-detail'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Users, CreditCard, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ThirdPartyPage() {
  const [tab, setTab] = useState<'active' | 'completed' | 'all'>('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const { data: purchases, isLoading } = trpc.thirdPartyPurchases.list.useQuery({
    status: tab,
  })

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

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Esto anulará la transacción subyacente en la tarjeta. ¿Continuar?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Compras de Terceros</h1>
          <p className="text-muted-foreground mt-1">Compras con tu tarjeta para otras personas</p>
        </div>
        <ThirdPartyForm />
      </div>

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
                            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
    </div>
  )
}
