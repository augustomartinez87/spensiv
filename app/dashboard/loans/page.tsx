'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatDateToInput } from '@/lib/utils'
import {
  Plus,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Banknote,
  Undo2,
  Zap,
} from 'lucide-react'

export default function LoansPage() {
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)

  if (selectedLoanId) {
    return <LoanDetail loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />
  }

  return <LoanList onSelect={setSelectedLoanId} />
}

// ─── Loan List ───────────────────────────────────────────────────────

function LoanList({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: loans, isLoading } = trpc.loans.list.useQuery()
  const [createOpen, setCreateOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Prestamos</h1>
          <p className="text-muted-foreground mt-1">Gestiona tus prestamos personales</p>
        </div>
        <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>

      {!loans || loans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">Sin prestamos</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Crea tu primer prestamo o usa el simulador
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Prestamo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {loans.map((loan) => {
            const now = new Date()
            const nextDue = loan.nextDueDate ? new Date(loan.nextDueDate) : null
            const isOverdue = nextDue && nextDue < now
            const progress = loan.totalCount > 0 ? (loan.paidCount / loan.totalCount) * 100 : 0

            return (
              <Card
                key={loan.id}
                className="cursor-pointer hover:border-primary/50 transition-all duration-200"
                onClick={() => onSelect(loan.id)}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{loan.borrowerName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(Number(loan.capital))} a {loan.termMonths} meses
                      </p>
                    </div>
                    <Badge variant={
                      loan.status === 'active' ? 'default' :
                      loan.status === 'completed' ? 'secondary' : 'destructive'
                    }>
                      {loan.status === 'active' ? 'Activo' :
                       loan.status === 'completed' ? 'Completado' : 'Moroso'}
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cuotas pagadas</span>
                      <span className="font-medium text-foreground">{loan.paidCount}/{loan.totalCount}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Next due */}
                  {nextDue && loan.status === 'active' && (
                    <div className={cn(
                      "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
                      isOverdue
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {isOverdue ? (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {isOverdue ? 'Vencida: ' : 'Proxima: '}
                        {format(nextDue, "d 'de' MMM", { locale: es })} - {formatCurrency(loan.nextAmount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Cuota: {formatCurrency(Number(loan.installmentAmount))}</span>
                    <span>TNA: {(Number(loan.tna) * 100).toFixed(1)}%</span>
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

// ─── Loan Detail ─────────────────────────────────────────────────────

function LoanDetail({ loanId, onBack }: { loanId: string; onBack: () => void }) {
  const utils = trpc.useUtils()
  const { data: loan, isLoading } = trpc.loans.getById.useQuery({ id: loanId })

  const markPaid = trpc.loans.markInstallmentPaid.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
    },
  })

  const unmarkPaid = trpc.loans.unmarkInstallmentPaid.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!loan) {
    return <p className="text-muted-foreground">Prestamo no encontrado</p>
  }

  const now = new Date()
  const paid = loan.loanInstallments.filter((i) => i.isPaid).length
  const total = loan.loanInstallments.length
  const totalCollected = loan.loanInstallments
    .filter((i) => i.isPaid)
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const totalPending = loan.loanInstallments
    .filter((i) => !i.isPaid)
    .reduce((sum, i) => sum + Number(i.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{loan.borrowerName}</h1>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(Number(loan.capital))} - {loan.termMonths} cuotas de {formatCurrency(Number(loan.installmentAmount))}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(Number(loan.capital))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Cobrado</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendiente</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Cuotas</p>
            <p className="text-xl font-bold text-foreground mt-1">{paid}/{total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Installments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cuotas</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Vencimiento</th>
                  <th className="text-right py-2 px-3 font-medium">Cuota</th>
                  <th className="text-right py-2 px-3 font-medium">Interes</th>
                  <th className="text-right py-2 px-3 font-medium">Capital</th>
                  <th className="text-right py-2 px-3 font-medium">Saldo</th>
                  <th className="text-center py-2 px-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loan.loanInstallments.map((inst) => {
                  const dueDate = new Date(inst.dueDate)
                  const isOverdue = !inst.isPaid && dueDate < now
                  const isUpcoming = !inst.isPaid && !isOverdue &&
                    dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000

                  return (
                    <tr
                      key={inst.id}
                      className={cn(
                        "border-b border-border/50 hover:bg-muted/50 transition-colors",
                        inst.isPaid && "opacity-60"
                      )}
                    >
                      <td className="py-2.5 px-3 font-medium">{inst.number}</td>
                      <td className={cn(
                        "py-2.5 px-3",
                        isOverdue && "text-red-600 dark:text-red-400 font-medium",
                        isUpcoming && "text-amber-600 dark:text-amber-400"
                      )}>
                        {format(dueDate, "d MMM yyyy", { locale: es })}
                      </td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(Number(inst.amount))}</td>
                      <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">{formatCurrency(Number(inst.interest))}</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(Number(inst.principal))}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(Number(inst.balance))}</td>
                      <td className="py-2.5 px-3 text-center">
                        {inst.isPaid ? (
                          <button
                            onClick={() => unmarkPaid.mutate({ installmentId: inst.id })}
                            className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 hover:opacity-70 transition-opacity"
                            title="Desmarcar como cobrada"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="text-xs">Cobrada</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => markPaid.mutate({ installmentId: inst.id })}
                            className={cn(
                              "inline-flex items-center gap-1.5 hover:text-green-600 dark:hover:text-green-400 transition-colors",
                              isOverdue ? "text-red-500" : "text-muted-foreground"
                            )}
                            title="Marcar como cobrada"
                          >
                            <Circle className="h-5 w-5" />
                            <span className="text-xs">{isOverdue ? 'Vencida' : 'Pendiente'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-border">
            {loan.loanInstallments.map((inst) => {
              const dueDate = new Date(inst.dueDate)
              const isOverdue = !inst.isPaid && dueDate < now

              return (
                <div key={inst.id} className={cn("py-3 flex items-center gap-3", inst.isPaid && "opacity-60")}>
                  <button
                    onClick={() => inst.isPaid
                      ? unmarkPaid.mutate({ installmentId: inst.id })
                      : markPaid.mutate({ installmentId: inst.id })
                    }
                    className={cn(
                      "shrink-0",
                      inst.isPaid
                        ? "text-green-600 dark:text-green-400"
                        : isOverdue
                          ? "text-red-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {inst.isPaid ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Circle className="h-6 w-6" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium">Cuota {inst.number}</p>
                      <p className="text-sm font-bold">{formatCurrency(Number(inst.amount))}</p>
                    </div>
                    <p className={cn(
                      "text-xs mt-0.5",
                      isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                    )}>
                      {format(dueDate, "d 'de' MMMM yyyy", { locale: es })}
                      {inst.isPaid && inst.paidAt && ` - Cobrada ${format(new Date(inst.paidAt), "d MMM", { locale: es })}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Create Loan Dialog ──────────────────────────────────────────────

function CreateLoanDialog({
  open,
  onOpenChange,
  defaultValues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues?: {
    capital?: string
    tna?: string
    termMonths?: string
    startDate?: string
  }
}) {
  const utils = trpc.useUtils()
  const [borrowerName, setBorrowerName] = useState('')
  const [capital, setCapital] = useState(defaultValues?.capital || '')
  const [tna, setTna] = useState(defaultValues?.tna || '')
  const [termMonths, setTermMonths] = useState(defaultValues?.termMonths || '')
  const [startDate, setStartDate] = useState(defaultValues?.startDate || formatDateToInput(new Date()))
  const [customInstallment, setCustomInstallment] = useState('')
  const [impliedTna, setImpliedTna] = useState<number | null>(null)

  const reverseMutation = trpc.loans.reverseFromInstallment.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        const tnaPercent = (data.tna * 100).toFixed(2)
        setImpliedTna(data.tna)
        setTna(tnaPercent)
      } else {
        setImpliedTna(null)
      }
    },
  })

  function handleInstallmentChange(value: string) {
    setCustomInstallment(value)
    setImpliedTna(null)

    const installment = parseFloat(value)
    const cap = parseFloat(capital)
    const term = parseInt(termMonths)

    if (installment > 0 && cap > 0 && term > 0 && installment > cap / term) {
      reverseMutation.mutate({
        capital: cap,
        termMonths: term,
        desiredInstallment: installment,
      })
    }
  }

  // Re-trigger reverse calc when capital or term change and there's a custom installment
  function handleCapitalChange(value: string) {
    setCapital(value)
    retriggerReverse(value, termMonths, customInstallment)
  }

  function handleTermChange(value: string) {
    setTermMonths(value)
    retriggerReverse(capital, value, customInstallment)
  }

  function retriggerReverse(cap: string, term: string, installment: string) {
    if (!installment) return
    setImpliedTna(null)
    const c = parseFloat(cap)
    const t = parseInt(term)
    const i = parseFloat(installment)
    if (i > 0 && c > 0 && t > 0 && i > c / t) {
      reverseMutation.mutate({ capital: c, termMonths: t, desiredInstallment: i })
    }
  }

  const createMutation = trpc.loans.create.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      onOpenChange(false)
      setBorrowerName('')
      setCapital('')
      setTna('')
      setTermMonths('')
      setCustomInstallment('')
      setImpliedTna(null)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate({
      borrowerName,
      capital: parseFloat(capital),
      tna: parseFloat(tna) / 100,
      termMonths: parseInt(termMonths),
      startDate,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Prestamo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Prestamo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="borrowerName">Nombre del Deudor</Label>
            <Input
              id="borrowerName"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="Ej: Juan Perez"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loanCapital">Capital (ARS)</Label>
              <Input
                id="loanCapital"
                type="number"
                value={capital}
                onChange={(e) => handleCapitalChange(e.target.value)}
                placeholder="1000000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loanTerm">Plazo (meses)</Label>
              <Input
                id="loanTerm"
                type="number"
                value={termMonths}
                onChange={(e) => handleTermChange(e.target.value)}
                placeholder="12"
                min="1"
                max="360"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loanTna">TNA (%)</Label>
              <Input
                id="loanTna"
                type="number"
                value={tna}
                onChange={(e) => { setTna(e.target.value); setImpliedTna(null); setCustomInstallment('') }}
                placeholder="55"
                step="0.5"
                required
              />
              {impliedTna !== null && (
                <p className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Zap className="h-3 w-3" />
                  Calculada desde la cuota
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="loanInstallment">Cuota Deseada (opcional)</Label>
              <Input
                id="loanInstallment"
                type="number"
                value={customInstallment}
                onChange={(e) => handleInstallmentChange(e.target.value)}
                placeholder="Calcular TNA desde cuota"
              />
              {reverseMutation.isPending && (
                <p className="text-xs text-muted-foreground">Calculando TNA...</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loanStartDate">Fecha de Inicio</Label>
            <Input
              id="loanStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {createMutation.error && (
            <p className="text-sm text-red-500">{createMutation.error.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creando...' : 'Crear Prestamo'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

