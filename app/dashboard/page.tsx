'use client'

import { trpc } from '@/lib/trpc-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { ArrowUpRight, CreditCard, TrendingUp, Calendar, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { data: currentMonth, isLoading: loadingMonth } = trpc.dashboard.getCurrentMonth.useQuery()
  const { data: totalDebt, isLoading: loadingDebt } = trpc.dashboard.getTotalDebt.useQuery()
  const { data: upcomingPayments, isLoading: loadingPayments } = trpc.dashboard.getUpcomingPayments.useQuery()

  if (loadingMonth || loadingDebt || loadingPayments) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    )
  }

  const nextPayment = upcomingPayments?.[0]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen de tu situación financiera
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Gasto del mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Impacto del mes
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentMonth?.totalImpact || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonth?.installmentCount || 0} cuotas activas
            </p>
          </CardContent>
        </Card>

        {/* Deuda total */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Deuda total
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalDebt?.amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalDebt?.cardCount || 0} tarjetas activas
            </p>
          </CardContent>
        </Card>

        {/* Próximo vencimiento */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximo vencimiento
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {nextPayment ? (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(nextPayment.amount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {nextPayment.card.name} • En {nextPayment.daysUntil} días
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Sin vencimientos próximos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribución por tarjeta */}
      {currentMonth && Object.keys(currentMonth.byCard).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución por tarjeta</CardTitle>
            <CardDescription>
              Cuotas que impactan este mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(currentMonth.byCard).map(([card, amount]) => (
                <div key={card} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium">{card}</span>
                  </div>
                  <span className="text-sm font-bold">
                    {formatCurrency(amount as number)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Próximos vencimientos */}
      {upcomingPayments && upcomingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimientos</CardTitle>
            <CardDescription>
              Fechas de pago de tus tarjetas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingPayments.map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{payment.card.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Vence {new Date(payment.dueDate).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(payment.amount)}</div>
                    <div className={`text-xs ${payment.daysUntil <= 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      En {payment.daysUntil} días
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state si no hay datos */}
      {(!currentMonth || currentMonth.installmentCount === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay gastos registrados</h3>
            <p className="text-muted-foreground text-center mb-4">
              Agregá tu primera tarjeta y empezá a registrar tus gastos
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/dashboard/cards">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar tarjeta
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
