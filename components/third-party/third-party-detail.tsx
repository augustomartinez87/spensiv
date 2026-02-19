'use client'

import { trpc } from '@/lib/trpc-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, Undo2, CreditCard, User, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ThirdPartyDetailProps {
  purchaseId: string | null
  isOpen: boolean
  onClose: () => void
}

export function ThirdPartyDetail({ purchaseId, isOpen, onClose }: ThirdPartyDetailProps) {
  const { toast } = useToast()
  const utils = trpc.useUtils()

  const { data: purchase, isLoading } = trpc.thirdPartyPurchases.getById.useQuery(
    purchaseId || '',
    { enabled: !!purchaseId }
  )

  const markCollected = trpc.thirdPartyPurchases.markInstallmentCollected.useMutation({
    onSuccess: () => {
      toast({ title: 'Cuota marcada como cobrada' })
      utils.thirdPartyPurchases.getById.invalidate(purchaseId || '')
      utils.thirdPartyPurchases.list.invalidate()
    },
  })

  const markUncollected = trpc.thirdPartyPurchases.markInstallmentUncollected.useMutation({
    onSuccess: () => {
      toast({ title: 'Cobro revertido' })
      utils.thirdPartyPurchases.getById.invalidate(purchaseId || '')
      utils.thirdPartyPurchases.list.invalidate()
    },
  })

  if (!isOpen) return null

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-48" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!purchase) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {purchase.description}
            <Badge variant={purchase.status === 'completed' ? 'default' : 'secondary'}>
              {purchase.status === 'completed' ? 'Completada' : 'Activa'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="font-medium text-foreground">{purchase.personName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span className="font-medium text-foreground">{purchase.card.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {format(new Date(purchase.purchaseDate), "d MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                <p className="text-lg font-bold">{formatCurrency(purchase.totalAmount, purchase.currency)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">Cobrado</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(purchase.collectedAmount, purchase.currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase">Pendiente</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(purchase.pendingAmount, purchase.currency)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Installments Table */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Cuotas de cobro</p>
            <div className="border rounded-lg divide-y">
              {purchase.collectionInstallments.map((inst) => {
                const isOverdue = !inst.isCollected && new Date(inst.dueDate) < new Date()
                return (
                  <div key={inst.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground w-6">
                        #{inst.number}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(inst.amount, purchase.currency)}
                        </p>
                        <p className={cn(
                          "text-xs",
                          isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
                        )}>
                          {format(new Date(inst.dueDate), "d MMM yyyy", { locale: es })}
                          {isOverdue && ' (vencida)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inst.isCollected ? (
                        <>
                          <Badge variant="default" className="bg-emerald-600 text-xs">Cobrada</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => markUncollected.mutate(inst.id)}
                            disabled={markUncollected.isPending}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => markCollected.mutate({ installmentId: inst.id })}
                          disabled={markCollected.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Cobrar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {purchase.notes && (
            <div>
              <p className="text-sm font-semibold mb-1">Notas</p>
              <p className="text-sm text-muted-foreground">{purchase.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
