'use client'

import { useParams } from 'next/navigation'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Circle, AlertCircle, Banknote } from 'lucide-react'

export default function SharePersonPage() {
  const params = useParams<{ personId: string }>()
  const { data, isLoading, error } = trpc.share.getPersonStatement.useQuery(
    { personId: params.personId },
  )

  if (isLoading) {
    return (
      <Shell>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64" />
      </Shell>
    )
  }

  if (error || !data) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg font-medium text-foreground">Estado de cuenta no disponible</p>
            <p className="text-sm text-muted-foreground mt-1">El link puede ser inválido o la persona no existe.</p>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  const now = new Date()

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Estado de cuenta</h1>
        <p className="text-muted-foreground">{data.name}</p>
      </div>

      {data.loans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Sin préstamos activos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.loans.map((loan) => {
            const paid = loan.installments.filter((i) => i.isPaid)
            const pending = loan.installments.filter((i) => !i.isPaid)
            const totalPaid = paid.reduce((s, i) => s + (i.paidAmount ?? i.amount), 0)
            const totalPending = pending.reduce((s, i) => s + i.amount, 0)
            const nextDue = pending.find((i) => new Date(i.dueDate) >= now) ?? pending[0]

            return (
              <Card key={loan.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    {loan.borrowerName}
                    <Badge variant="outline" className="ml-auto text-xs">{loan.currency}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Installments list */}
                  <div className="space-y-1">
                    {loan.installments.map((inst) => {
                      const due = new Date(inst.dueDate)
                      const isOverdue = !inst.isPaid && due < now
                      const isNext = nextDue?.id === inst.id

                      return (
                        <div
                          key={inst.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                            isNext && 'bg-primary/10 border border-primary/30',
                            isOverdue && !isNext && 'bg-red-500/10',
                          )}
                        >
                          {/* Status icon */}
                          {inst.isPaid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : isOverdue ? (
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}

                          {/* Number */}
                          <span className="text-muted-foreground w-8 shrink-0">#{inst.number}</span>

                          {/* Date */}
                          <span className={cn(
                            'flex-1',
                            isOverdue ? 'text-red-400' : 'text-foreground',
                          )}>
                            {format(due, "d MMM yyyy", { locale: es })}
                          </span>

                          {/* Amount */}
                          <span className={cn(
                            'font-semibold shrink-0',
                            inst.isPaid ? 'text-muted-foreground line-through' : isOverdue ? 'text-red-400' : 'text-foreground',
                          )}>
                            {formatCurrency(inst.amount, loan.currency)}
                          </span>

                          {/* Status badge */}
                          {inst.isPaid ? (
                            <Badge variant="secondary" className="text-[10px] shrink-0">Pagada</Badge>
                          ) : isOverdue ? (
                            <Badge variant="destructive" className="text-[10px] shrink-0">Vencida</Badge>
                          ) : isNext ? (
                            <Badge className="text-[10px] shrink-0">Próxima</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] shrink-0">Pendiente</Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Totals */}
                  <div className="flex justify-between pt-3 border-t text-sm">
                    <div>
                      <span className="text-muted-foreground">Cobrado: </span>
                      <span className="font-semibold text-green-400">{formatCurrency(totalPaid, loan.currency)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pendiente: </span>
                      <span className="font-semibold text-foreground">{formatCurrency(totalPending, loan.currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-8">Spensiv</p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {children}
      </div>
    </div>
  )
}
