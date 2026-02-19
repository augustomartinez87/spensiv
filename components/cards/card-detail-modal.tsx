'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CreditCard,
  Calendar,
  DollarSign,
  TrendingUp,
  Building2,
  Hash,
  Users,
} from 'lucide-react'

interface CardDetailModalProps {
  cardId: string | null
  isOpen: boolean
  onClose: () => void
}

function getBankColor(bank: string): string {
  const colors: Record<string, string> = {
    'CIUDAD': 'bg-blue-600',
    'GALICIA': 'bg-orange-500',
    'SANTANDER': 'bg-red-600',
    'BBVA': 'bg-blue-700',
    'MACRO': 'bg-indigo-600',
    'HSBC': 'bg-red-500',
    'ICBC': 'bg-red-700',
    'BRUBANK': 'bg-purple-600',
    'UALA': 'bg-blue-500',
    'MERCADOPAGO': 'bg-sky-500',
  }
  const key = bank.toUpperCase()
  for (const [k, v] of Object.entries(colors)) {
    if (key.includes(k)) return v
  }
  return 'bg-gray-500'
}

function getBrandName(brand: string): string {
  switch (brand) {
    case 'visa':
      return 'Visa'
    case 'mastercard':
      return 'Mastercard'
    case 'amex':
      return 'American Express'
    default:
      return brand
  }
}

export function CardDetailModal({ cardId, isOpen, onClose }: CardDetailModalProps) {
  const { data: cardDetail, isLoading } = trpc.cards.getDetail.useQuery(
    cardId || '',
    { enabled: !!cardId }
  )
  const { data: thirdPartySummary } = trpc.thirdPartyPurchases.getSummaryByCard.useQuery(
    cardId || '',
    { enabled: !!cardId }
  )

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-48" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!cardDetail) {
    return null
  }

  const {
    card,
    totalBalance,
    currentPeriodBalance,
    nextDueDate,
    nextDueAmount,
    limitPercentage,
    recentTransactions,
  } = cardDetail

  const isOverLimit = limitPercentage && limitPercentage > 100

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold',
              getBankColor(card.bank)
            )}>
              {card.bank.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="text-xl">{card.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs">
                  {getBrandName(card.brand)}
                </Badge>
                {card.last4 && (
                  <span className="text-xs text-muted-foreground font-mono">
                    **** {card.last4}
                  </span>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Resumen de balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Deuda Total</span>
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(totalBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todas las cuotas pendientes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Este período</span>
                  </div>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(currentPeriodBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cuotas de este mes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Límite y próximo vencimiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {card.creditLimit && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-sm">Límite utilizado</span>
                    </div>
                    <span className={cn(
                      "text-sm font-semibold",
                      isOverLimit ? "text-red-600" : "text-foreground"
                    )}>
                      {limitPercentage?.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(limitPercentage || 0, 100)} 
                    className={cn(
                      "h-2",
                      isOverLimit && "bg-red-200"
                    )}
                  />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>{formatCurrency(totalBalance)} usado</span>
                    <span>{formatCurrency(Number(card.creditLimit))} límite</span>
                  </div>
                  {isOverLimit && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Has superado el límite de crédito
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Próximo vencimiento</span>
                </div>
                {nextDueDate ? (
                  <>
                    <p className="text-2xl font-bold">
                      {format(new Date(nextDueDate), "d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-lg font-semibold text-primary mt-1">
                      {formatCurrency(nextDueAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pago total del cierre
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Sin vencimientos próximos</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Información de la tarjeta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Información de la tarjeta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Banco:</span>
                  <span className="font-medium">{card.bank}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Día de cierre:</span>
                  <span className="font-medium">{card.closingDay}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Día de vencimiento:</span>
                  <span className="font-medium">{card.dueDay}</span>
                </div>
                {card.creditLimit && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Límite:</span>
                    <span className="font-medium">{formatCurrency(Number(card.creditLimit))}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Movimientos recientes */}
          {recentTransactions && recentTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Movimientos recientes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {recentTransactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-sm">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.purchaseDate), "d MMM yyyy", { locale: es })}
                          {tx.installments > 1 && ` • ${tx.installments} cuotas`}
                        </p>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(Number(tx.totalAmount))}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compras de terceros */}
          {thirdPartySummary && thirdPartySummary.count > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Compras de Terceros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Activas</p>
                    <p className="text-lg font-bold">{thirdPartySummary.count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Monto total</p>
                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(thirdPartySummary.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Pendiente</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(thirdPartySummary.pendingAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
