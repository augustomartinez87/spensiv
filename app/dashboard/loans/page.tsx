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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths as addMonthsFn, subMonths } from 'date-fns'
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
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Pencil,
  Check,
  X,
  Infinity,
  UserCircle,
  ShieldCheck,
  Shield,
  ShieldAlert,
  ShieldX,
  Phone,
  Handshake,
  MessageCircle,
  Copy,
  RefreshCw,
  Link2,
  Info,
  MinusCircle,
  ChevronDown,
  Ban,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { calculatePersonScore } from '@/lib/loan-scoring'
import { tnaToMonthlyRate, frenchInstallment, generateAmortizationTable } from '@/lib/loan-calculator'

import { amountClass, loanRateInfo } from '@/components/loans/helpers'
import { LoansDashboardSummary } from '@/components/loans/loans-dashboard-summary'
import { DebtsDashboardSummary } from '@/components/loans/debts-dashboard-summary'
import { UpcomingInstallmentsGadget } from '@/components/loans/upcoming-installments-gadget'
import { PreApprovedLoanCard } from '@/components/loans/pre-approved-loan-card'

import { LoanListHeader } from '@/components/loans/loan-list-header'
import { LoanListContent } from '@/components/loans/loan-list-content'
import { InstallmentCalendar } from '@/components/loans/installment-calendar'

export default function LoansPage() {
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [tab, setTab] = useState<'lender' | 'borrower'>('lender')

  if (selectedLoanId) {
    return <LoanDetail loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />
  }

  return (
    <div className="space-y-8">
      <LoanListHeader view={view} onViewChange={setView} direction={tab} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="lender">Soy prestamista</TabsTrigger>
          <TabsTrigger value="borrower">Soy deudor</TabsTrigger>
        </TabsList>

        <TabsContent value="lender" className="space-y-6 mt-6">
          <LoansDashboardSummary />
          <div className="grid gap-6 md:grid-cols-[1fr_280px]">
            <div>
              {view === 'list' ? (
                <LoanListContent onSelect={setSelectedLoanId} direction="lender" />
              ) : (
                <InstallmentCalendar onSelectLoan={setSelectedLoanId} />
              )}
            </div>
            <UpcomingInstallmentsGadget />
          </div>
        </TabsContent>

        <TabsContent value="borrower" className="space-y-6 mt-6">
          <DebtsDashboardSummary />
          <LoanListContent onSelect={setSelectedLoanId} direction="borrower" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Loan Detail ─────────────────────────────────────────────────────

function LoanDetail({ loanId, onBack }: { loanId: string; onBack: () => void }) {
  const utils = trpc.useUtils()
  const { data: loan, isLoading } = trpc.loans.getById.useQuery({ id: loanId })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [assignPersonOpen, setAssignPersonOpen] = useState(false)
  const [assignPersonId, setAssignPersonId] = useState('')
  const { data: allPersons } = trpc.persons.list.useQuery()
  const { toast } = useToast()

  const deleteMutation = trpc.loans.delete.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      onBack()
    },
  })

  const updateMutation = trpc.loans.update.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      setEditing(false)
    },
  })

  const completeMutation = trpc.loans.completeLoan.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      setConfirmComplete(false)
    },
  })

  const generateMoreMutation = trpc.loans.generateMoreInstallments.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
    },
  })

  function startEditing() {
    if (!loan) return
    setEditName(loan.borrowerName)
    setEditStartDate(formatDateToInput(new Date(loan.startDate)))
    setEditing(true)
  }

  function saveEdit() {
    if (!loan) return
    const changes: { id: string; borrowerName?: string; startDate?: string } = { id: loanId }
    if (editName !== loan.borrowerName) changes.borrowerName = editName
    const currentStart = formatDateToInput(new Date(loan.startDate))
    if (editStartDate !== currentStart) changes.startDate = editStartDate
    updateMutation.mutate(changes)
  }

  const recalculateMutation = trpc.loans.recalculate.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.getMonthlyAccruals.invalidate({ loanId })
      toast({ title: 'Recálculo completado' })
    },
  })

  const [editInstId, setEditInstId] = useState<string | null>(null)
  const [editInstAmount, setEditInstAmount] = useState('')
  const [editInstDate, setEditInstDate] = useState('')

  const updateInstallmentMutation = trpc.loans.updateInstallment.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.getMonthlyAccruals.invalidate({ loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      setEditInstId(null)
      toast({ title: 'Cuota actualizada' })
    },
  })

  const [payInstId, setPayInstId] = useState<string | null>(null)
  const [payInstDate, setPayInstDate] = useState(formatDateToInput(new Date()))

  const payInstMutation = trpc.loans.payInstallment.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.getLoanPayments.invalidate({ loanId })
      utils.loans.getMonthlyAccruals.invalidate({ loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()

      setPayInstId(null)
    },
  })

  const [waiveInstId, setWaiveInstId] = useState<string | null>(null)
  const waiveMutation = trpc.loans.waiveInstallmentBalance.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.getLoanPayments.invalidate({ loanId })
      utils.loans.getMonthlyAccruals.invalidate({ loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      setWaiveInstId(null)
      toast({ title: 'Quita aplicada' })
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
    return <p className="text-muted-foreground">Préstamo no encontrado</p>
  }

  const now = new Date()
  const isInterestOnly = loan.loanType === 'interest_only'
  const cur = loan.currency
  const paid = loan.loanInstallments.filter((i) => i.isPaid).length
  const total = loan.loanInstallments.length
  const totalCollected = (loan.loanPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPending = loan.loanInstallments
    .filter((i) => !i.isPaid)
    .reduce((sum, i) => sum + Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0), 0)
  const unpaidCount = loan.loanInstallments.filter((i) => !i.isPaid).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {editing ? (
            <div className="space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-lg font-bold h-9"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0">Fecha inicio:</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="h-8 text-sm w-auto"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{loan.borrowerName}</h1>
                {isInterestOnly && (
                  <Badge variant="outline" className="text-xs">
                    {Number(loan.monthlyRate) === 0 ? 'Sin intereses' : 'Solo interés'}
                  </Badge>
                )}
                {cur !== 'ARS' && (
                  <Badge variant="outline" className="text-xs">{cur}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isInterestOnly
                  ? Number(loan.monthlyRate) === 0
                    ? `${formatCurrency(Number(loan.capital), cur)} · Sin intereses`
                    : `${formatCurrency(Number(loan.capital), cur)} · Interés mensual: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                  : `${formatCurrency(Number(loan.capital), cur)} - ${loan.termMonths} cuotas de ${formatCurrency(Number(loan.installmentAmount), cur)}`
                }
                {' · '}Inicio: {format(new Date(loan.startDate), "d MMM yyyy", { locale: es })}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button variant="ghost" size="icon" onClick={saveEdit} disabled={updateMutation.isPending} className="text-green-600 hover:text-green-700">
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-500 font-medium">Eliminar?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate({ id: loanId })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Si, eliminar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={startEditing} className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="text-muted-foreground hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Person assignment */}
      {!loan.person && allPersons && allPersons.length > 0 && (
        assignPersonOpen ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={assignPersonId} onValueChange={setAssignPersonId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Seleccionar persona" />
              </SelectTrigger>
              <SelectContent>
                {allPersons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · Score: {p.score}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!assignPersonId || updateMutation.isPending}
              onClick={() => {
                updateMutation.mutate({ id: loanId, personId: assignPersonId })
                setAssignPersonOpen(false)
              }}
            >
              Asignar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAssignPersonOpen(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAssignPersonOpen(true)}>
            <UserCircle className="h-4 w-4 mr-2" />
            Asignar persona
          </Button>
        )
      )}
      {loan.person && (
        <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted">
          <UserCircle className="h-4 w-4 text-muted-foreground" />
          <span>Persona: <strong>{loan.person.name}</strong>{loan.person.alias ? ` (${loan.person.alias})` : ''}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className={cn("grid gap-4", isInterestOnly ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(Number(loan.capital), cur)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Cobrado</p>
            <p className="text-xl font-bold text-accent-positive mt-1">{formatCurrency(totalCollected, cur)}</p>
          </CardContent>
        </Card>
        {isInterestOnly ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Interés mensual</p>
              <p className="text-xl font-bold text-accent-blue mt-1">{formatCurrency(Number(loan.installmentAmount), cur)}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendiente</p>
                <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(totalPending, cur)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Cuotas</p>
                <p className="text-xl font-bold text-foreground mt-1">{paid}/{total}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Rate info row */}
      {Number(loan.monthlyRate) > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground px-1">
          {(() => {
            const ri = loanRateInfo(loan)
            return (
              <>
                <span><span className="text-foreground font-medium">TNA:</span> {(ri.tna * 100).toFixed(2)}%</span>
                <span className="text-border">·</span>
                <span><span className="text-foreground font-medium">TEA:</span> {(ri.tea * 100).toFixed(2)}%</span>
                <span className="text-border">·</span>
                <span><span className="text-foreground font-medium">TEM:</span> {(ri.tem * 100).toFixed(3)}%</span>
                {ri.isLegacy && <span className="text-[10px] text-amber-500">(legado)</span>}
              </>
            )
          })()}
        </div>
      )}

      {/* Accounting Summary (Phase 1) */}
      {(loan.irrRealAnnual || loan.irrContractualAnnual || Number(loan.principalOutstanding) > 0) && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital Progresivo</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {formatCurrency(Number(loan.principalOutstanding || loan.capital), cur)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Mora Acumulada</p>
              <p className={cn("text-xl font-bold mt-1", Number(loan.overdueInterestOutstanding) > 0 ? "text-red-400" : "text-foreground")}>
                {formatCurrency(Number(loan.overdueInterestOutstanding || 0), cur)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">TIR Proyectada (XIRR)</p>
                {loan.irrStatus === 'no_convergence' && <AlertCircle className="h-3 w-3 text-amber-500" aria-label="Sin convergencia" />}
              </div>
              <p className="text-xl font-bold text-foreground mt-1">
                {loan.irrRealAnnual ? `${(Number(loan.irrRealAnnual) * 100).toFixed(2)}%` : 'N/D'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Slippage</p>
              <p className={cn("text-xl font-bold mt-1", (loan.irrSlippageBps || 0) < 0 ? "text-red-400" : (loan.irrSlippageBps || 0) > 0 ? "text-green-400" : "text-foreground")}>
                {loan.irrSlippageBps ? `${loan.irrSlippageBps} bps` : '0 bps'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Refinance banner for refinanced loans */}
      {loan.status === 'refinanced' && loan.refinancedByLoanId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>Este préstamo fue refinanciado.</span>
          <button
            className="text-primary font-medium hover:underline"
            onClick={() => {
              onBack()
              setTimeout(() => {
                // Will trigger re-render with new loan
                window.dispatchEvent(new CustomEvent('navigate-loan', { detail: loan.refinancedByLoanId }))
              }, 100)
            }}
          >
            Ver nuevo préstamo
          </button>
        </div>
      )}

      {/* Original loan reference */}
      {loan.originalLoanId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-sm text-blue-400">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Este préstamo es un refinanciamiento.</span>
        </div>
      )}

      {/* Action buttons */}
      {loan.status === 'active' && unpaidCount > 0 && (
        <div className="flex flex-wrap gap-2">
          <CopyCollectionMessage loan={loan} />
          <RegisterPaymentDialog loanId={loanId} cur={cur} loan={loan} />
          <RefinanceDialog loan={loan} onBack={onBack} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => recalculateMutation.mutate({ loanId })}
            disabled={recalculateMutation.isPending}
            className="text-muted-foreground"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", recalculateMutation.isPending && "animate-spin")} />
            Recalcular
          </Button>
        </div>
      )}

      {/* Interest-only action buttons */}
      {isInterestOnly && loan.status === 'active' && (
        <div className="flex flex-wrap gap-2">
          {unpaidCount <= 3 && (
            <Button
              variant="outline"
              onClick={() => generateMoreMutation.mutate({ loanId })}
              disabled={generateMoreMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {generateMoreMutation.isPending ? 'Generando...' : 'Generar más cuotas'}
            </Button>
          )}
          {confirmComplete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Devolvió el capital?</span>
              <Button
                size="sm"
                onClick={() => completeMutation.mutate({ loanId })}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? 'Completando...' : 'Si, completar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmComplete(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmComplete(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completar préstamo
            </Button>
          )}
        </div>
      )}

      {/* Installments table */}
      <Tabs defaultValue="installments" className="w-full">
        <TabsList>
          <TabsTrigger value="installments">Cuotas</TabsTrigger>
          <TabsTrigger value="accounting">Contabilidad</TabsTrigger>
        </TabsList>
        <TabsContent value="installments" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th className="text-left py-2 px-3 font-medium">Vencimiento</th>
                      <th className="text-right py-2 px-3 font-medium">Cuota</th>
                      <th className="text-right py-2 px-3 font-medium">Interés</th>
                      <th className="text-right py-2 px-3 font-medium">Capital</th>
                      <th className="text-right py-2 px-3 font-medium">Saldo</th>
                      <th className="text-center py-2 px-3 font-medium">Estado</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {loan.loanInstallments.map((inst) => {
                      const dueDate = new Date(inst.dueDate)
                      const paidAmount = Number(inst.paidAmount ?? 0)
                      const remaining = Math.max(Number(inst.amount) - paidAmount, 0)
                      const isPartial = paidAmount > 0 && !inst.isPaid && remaining > 0.01
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
                            isOverdue && "text-red-400 font-medium",
                            isUpcoming && "text-amber-400"
                          )}>
                            {format(dueDate, "d MMM yyyy", { locale: es })}
                          </td>
                          <td className="py-2.5 px-3 text-right">{formatCurrency(Number(inst.amount), cur)}</td>
                          <td className="py-2.5 px-3 text-right text-accent-blue">{formatCurrency(Number(inst.interest), cur)}</td>
                          <td className="py-2.5 px-3 text-right">{formatCurrency(Number(inst.principal), cur)}</td>
                          <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(Number(inst.balance), cur)}</td>
                          <td className="py-2.5 px-3 text-center">
                            {inst.isPaid ? (
                              <span className="inline-flex items-center gap-1.5 text-accent-positive">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="text-xs">Cobrada</span>
                              </span>
                            ) : isPartial ? (
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 text-amber-400 cursor-default">
                                      <MinusCircle className="h-5 w-5" />
                                      <span className="text-xs">Parcial</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Pagó {formatCurrency(paidAmount, cur)}, resta {formatCurrency(remaining, cur)}</p>
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            ) : (
                              <span className={cn(
                                "inline-flex items-center gap-1.5",
                                isOverdue ? "text-red-500" : "text-muted-foreground"
                              )}>
                                <Circle className="h-5 w-5" />
                                <span className="text-xs">{isOverdue ? 'Vencida' : 'Pendiente'}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {!inst.isPaid && (
                              <div className="flex items-center justify-center gap-0.5">
                                {paidAmount === 0 && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    title="Editar cuota"
                                    onClick={() => {
                                      setEditInstId(inst.id)
                                      setEditInstAmount(String(Number(inst.amount)))
                                      setEditInstDate(formatDateToInput(dueDate))
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-accent-positive"
                                  title="Cobrar esta cuota"
                                  onClick={() => {
                                    setPayInstId(inst.id)
                                    setPayInstDate(formatDateToInput(new Date()))
                                  }}
                                >
                                  <Banknote className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                  title="Condonar saldo restante"
                                  onClick={() => setWaiveInstId(inst.id)}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
                  const paidAmount = Number(inst.paidAmount ?? 0)
                  const remaining = Math.max(Number(inst.amount) - paidAmount, 0)
                  const isPartial = paidAmount > 0 && !inst.isPaid && remaining > 0.01
                  const isOverdue = !inst.isPaid && dueDate < now

                  return (
                    <div key={inst.id} className={cn("py-3 flex items-center gap-3", inst.isPaid && "opacity-60")}>
                      <span className={cn(
                        "shrink-0",
                        inst.isPaid
                          ? "text-accent-positive"
                          : isPartial
                            ? "text-amber-400"
                            : isOverdue
                              ? "text-red-500"
                              : "text-muted-foreground"
                      )}>
                        {inst.isPaid ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : isPartial ? (
                          <MinusCircle className="h-6 w-6" />
                        ) : (
                          <Circle className="h-6 w-6" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium">Cuota {inst.number}</p>
                          <p className="text-sm font-bold">{formatCurrency(Number(inst.amount), cur)}</p>
                        </div>
                        <p className={cn(
                          "text-xs mt-0.5",
                          isPartial ? "text-amber-400" : isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                        )}>
                          {format(dueDate, "d 'de' MMMM yyyy", { locale: es })}
                          {inst.isPaid && inst.paidAt && ` - Cobrada ${format(new Date(inst.paidAt), "d MMM", { locale: es })}`}
                          {isPartial && ` - Parcial: resta ${formatCurrency(remaining, cur)}`}
                        </p>
                      </div>
                      {!inst.isPaid && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {paidAmount === 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Editar cuota"
                              onClick={() => {
                                setEditInstId(inst.id)
                                setEditInstAmount(String(Number(inst.amount)))
                                setEditInstDate(formatDateToInput(dueDate))
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-accent-positive"
                            title="Cobrar esta cuota"
                            onClick={() => {
                              setPayInstId(inst.id)
                              setPayInstDate(formatDateToInput(new Date()))
                            }}
                          >
                            <Banknote className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                            title="Condonar saldo restante"
                            onClick={() => setWaiveInstId(inst.id)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="accounting" className="mt-4">
          <MonthlyAccrualsTable loanId={loanId} cur={cur} />
        </TabsContent>
      </Tabs>

      {/* Edit installment dialog */}
      {editInstId && (() => {
        const inst = loan.loanInstallments.find((i) => i.id === editInstId)
        if (!inst) return null
        return (
          <Dialog open onOpenChange={(open) => { if (!open) setEditInstId(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar cuota {inst.number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editInstAmount}
                    onChange={(e) => setEditInstAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de vencimiento</Label>
                  <Input
                    type="date"
                    value={editInstDate}
                    onChange={(e) => setEditInstDate(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={updateInstallmentMutation.isPending}
                  onClick={() => {
                    const changes: { installmentId: string; amount?: number; dueDate?: string } = {
                      installmentId: editInstId,
                    }
                    const newAmount = parseFloat(editInstAmount)
                    if (!isNaN(newAmount) && newAmount !== Number(inst.amount)) {
                      changes.amount = newAmount
                    }
                    const origDate = formatDateToInput(new Date(inst.dueDate))
                    if (editInstDate !== origDate) {
                      changes.dueDate = editInstDate
                    }
                    if (!changes.amount && !changes.dueDate) {
                      setEditInstId(null)
                      return
                    }
                    updateInstallmentMutation.mutate(changes)
                  }}
                >
                  {updateInstallmentMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Pay installment dialog */}
      {payInstId && (() => {
        const inst = loan.loanInstallments.find((i) => i.id === payInstId)
        if (!inst) return null
        const remaining = Math.max(Number(inst.amount) - Number(inst.paidAmount ?? 0), 0)
        return (
          <Dialog open onOpenChange={(open) => { if (!open) setPayInstId(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cobrar cuota {inst.number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm flex justify-between">
                  <span className="text-muted-foreground">Monto a cobrar</span>
                  <span className="font-bold">{formatCurrency(remaining, cur)}</span>
                </div>
                <div className="space-y-2">
                  <Label>Fecha del cobro</Label>
                  <Input
                    type="date"
                    value={payInstDate}
                    onChange={(e) => setPayInstDate(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={payInstMutation.isPending}
                  onClick={() => payInstMutation.mutate({
                    installmentId: payInstId,
                    paymentDate: payInstDate,
                  })}
                >
                  {payInstMutation.isPending ? 'Registrando...' : 'Confirmar Cobro'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Waive installment dialog */}
      {waiveInstId && (() => {
        const inst = loan.loanInstallments.find((i: any) => i.id === waiveInstId)
        if (!inst) return null
        const remaining = Math.max(Number(inst.amount) - Number(inst.paidAmount ?? 0), 0)
        return (
          <Dialog open onOpenChange={(open) => { if (!open) setWaiveInstId(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Condonar cuota {inst.number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Se condonará el saldo restante de esta cuota. El monto no se cobrará y la cuota quedará marcada como saldada.
                </p>
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm flex justify-between">
                  <span className="text-muted-foreground">Monto a condonar</span>
                  <span className="font-bold text-red-400">{formatCurrency(remaining, cur)}</span>
                </div>
                {Number(inst.paidAmount ?? 0) > 0 && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm flex justify-between">
                    <span className="text-muted-foreground">Cobrado previamente</span>
                    <span className="font-medium">{formatCurrency(Number(inst.paidAmount ?? 0), cur)}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Esto impactará la TIR proyectada del préstamo.
                </p>
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={waiveMutation.isPending}
                  onClick={() => waiveMutation.mutate({ installmentId: waiveInstId })}
                >
                  {waiveMutation.isPending ? 'Aplicando quita...' : `Condonar ${formatCurrency(remaining, cur)}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Payment History */}
      <PaymentHistorySection loanId={loanId} cur={cur} />

      {/* Activity Timeline */}
      <LoanActivityTimeline loanId={loanId} logs={loan.activityLogs || []} />
    </div>
  )
}

// ─── Register Payment Dialog ────────────────────────────────────────

function RegisterPaymentDialog({ loanId, cur, loan }: { loanId: string; cur: string; loan: any }) {
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDateToInput(new Date()))
  const [note, setNote] = useState('')

  const registerMutation = trpc.loans.registerPayment.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.getMonthlyAccruals.invalidate({ loanId })
      utils.loans.getLoanPayments.invalidate({ loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()

      setOpen(false)
      setAmount('')
    },
  })

  // Compute pending info from loan data
  const now = new Date()
  const unpaidInsts = (loan?.loanInstallments ?? []).filter((i: any) => !i.isPaid)
  const overdueInsts = unpaidInsts.filter((i: any) => new Date(i.dueDate) < now)
  const nextDueInst = unpaidInsts.find((i: any) => new Date(i.dueDate) >= now)
  const pendingCount = unpaidInsts.length
  const totalPendingAmount = unpaidInsts.reduce((s: number, i: any) => {
    const paid = Number(i.paidAmount ?? 0)
    return s + Math.max(Number(i.amount) - paid, 0)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Banknote className="h-4 w-4 mr-2" />
          Registrar Cobro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Cobro Real</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Pending info */}
          {(overdueInsts.length > 0 || nextDueInst) && (
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs space-y-1.5">
              {overdueInsts.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-red-400 font-medium">Vencidas ({overdueInsts.length})</span>
                  <span className="text-red-400 font-medium">
                    {formatCurrency(overdueInsts.reduce((s: number, i: any) => {
                      const paid = Number(i.paidAmount ?? 0)
                      return s + Math.max(Number(i.amount) - paid, 0)
                    }, 0), cur)}
                  </span>
                </div>
              )}
              {nextDueInst && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Próxima ({format(new Date(nextDueInst.dueDate), "d MMM", { locale: es })})
                    {Number(nextDueInst.paidAmount ?? 0) > 0 && ' · Parcial'}
                  </span>
                  <span>
                    {formatCurrency(Math.max(Number(nextDueInst.amount) - Number(nextDueInst.paidAmount ?? 0), 0), cur)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/50 pt-1.5">
                <span className="text-muted-foreground">Cuotas pendientes: {pendingCount}</span>
                <span className="font-medium">{formatCurrency(totalPendingAmount, cur)}</span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Monto cobrado ({cur})</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha del cobro (valor)</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nota</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Transferencia, Efectivo..."
            />
          </div>
          <Button
            className="w-full"
            disabled={!amount || parseFloat(amount) <= 0 || registerMutation.isPending}
            onClick={() => registerMutation.mutate({
              loanId,
              amount: parseFloat(amount),
              paymentDate: date,
              note: note || undefined,
            })}
          >
            {registerMutation.isPending ? 'Registrando...' : 'Confirmar Cobro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Payment History Section ─────────────────────────────────────────

function PaymentHistorySection({ loanId, cur }: { loanId: string; cur: string }) {
  const utils = trpc.useUtils()
  const { data: payments, isLoading } = trpc.loans.getLoanPayments.useQuery({ loanId })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')

  const updateNoteMutation = trpc.loans.updatePaymentNote.useMutation({
    onSuccess: () => {
      utils.loans.getLoanPayments.invalidate({ loanId })
      setEditingId(null)
    },
  })

  const deletePaymentMutation = trpc.loans.deletePayment.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.getLoanPayments.invalidate({ loanId })
      utils.loans.getMonthlyAccruals.invalidate({ loanId })
    },
  })

  if (isLoading) return <Skeleton className="h-24" />
  if (!payments || payments.length === 0) return null

  const componentLabel: Record<string, string> = {
    interest_current: 'Interés corriente',
    interest_overdue: 'Interés mora',
    principal: 'Capital',
    disbursement: 'Desembolso',
    waiver_interest: 'Quita interés',
    waiver_principal: 'Quita capital',
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Historial de Cobros</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {payments.map((payment) => {
            const isExpanded = expandedId === payment.id
            const isEditing = editingId === payment.id
            const breakdowns = payment.realCashflows.filter((f) => f.component !== 'disbursement')

            return (
              <div key={payment.id} className="py-3">
                <button
                  className="w-full flex items-center justify-between gap-3 hover:opacity-80 transition-opacity"
                  onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Banknote className="h-4 w-4 text-accent-positive shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium">
                        {format(new Date(payment.paymentDate), "d 'de' MMMM yyyy", { locale: es })}
                      </p>
                      {payment.note && (
                        <p className="text-xs text-muted-foreground truncate">{payment.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-accent-positive">
                      {formatCurrency(Number(payment.amount), cur)}
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2 ml-7 space-y-2">
                    {breakdowns.length > 0 && (
                      <div className="space-y-1">
                        {breakdowns.map((flow, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                              {componentLabel[flow.component] ?? flow.component}
                              <span className="text-muted-foreground/60">
                                ({format(new Date(flow.flowDate), "d MMM", { locale: es })})
                              </span>
                            </span>
                            <span>{formatCurrency(Math.abs(Number(flow.amountSigned)), cur)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Nota..."
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-500"
                          disabled={updateNoteMutation.isPending}
                          onClick={() => updateNoteMutation.mutate({ paymentId: payment.id, note: editNote })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Editar nota"
                          onClick={() => {
                            setEditingId(payment.id)
                            setEditNote(payment.note ?? '')
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-red-500"
                          title="Eliminar pago"
                          disabled={deletePaymentMutation.isPending}
                          onClick={() => {
                            if (window.confirm('¿Eliminar este pago? Los estados de cuotas se recalcularán.')) {
                              deletePaymentMutation.mutate({ paymentId: payment.id })
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Monthly Accruals Table ─────────────────────────────────────────

function MonthlyAccrualsTable({ loanId, cur }: { loanId: string; cur: string }) {
  const { data: accruals, isLoading } = trpc.loans.getMonthlyAccruals.useQuery({ loanId })

  if (isLoading) return <Skeleton className="h-40" />

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground uppercase tracking-wider">
                <th className="text-left py-2 px-3 font-medium">Periodo</th>
                <th className="text-right py-2 px-3 font-medium">Principal Inicial</th>
                <th className="text-right py-2 px-3 font-medium">Int. Esperado</th>
                <th className="text-right py-2 px-3 font-medium">Int. Cobrado</th>
                <th className="text-right py-2 px-3 font-medium">Desvío</th>
                <th className="text-right py-2 px-3 font-medium">Principal Cobrado</th>
                <th className="text-right py-2 px-3 font-medium">Mora Cierre</th>
              </tr>
            </thead>
            <tbody>
              {accruals?.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium capitalize">
                    {format(new Date(a.year, a.month - 1), 'MMM yyyy', { locale: es })}
                  </td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(Number(a.openingPrincipal), cur)}</td>
                  <td className="py-2.5 px-3 text-right text-accent-blue">{formatCurrency(Number(a.interestExpected), cur)}</td>
                  <td className="py-2.5 px-3 text-right text-accent-positive">{formatCurrency(Number(a.interestCollectedCurrent), cur)}</td>
                  <td className={cn("py-2.5 px-3 text-right", (() => {
                    const isFuture = new Date(a.year, a.month - 1) > new Date()
                    if (isFuture) return 'text-muted-foreground/50'
                    return Number(a.deviationAmount) < 0 ? 'text-red-400' : 'text-foreground'
                  })())}>
                    {(() => {
                      const isFuture = new Date(a.year, a.month - 1) > new Date()
                      if (isFuture) return <span className="text-muted-foreground">—</span>
                      return formatCurrency(Number(a.deviationAmount), cur)
                    })()}
                  </td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(Number(a.principalCollected), cur)}</td>
                  <td className={cn("py-2.5 px-3 text-right font-medium", Number(a.overdueInterestClosing) > 0 ? "text-red-400" : "text-foreground")}>
                    {formatCurrency(Number(a.overdueInterestClosing), cur)}
                  </td>
                </tr>
              ))}
              {!accruals?.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground italic">
                    Sin datos de contabilidad registrados. Realizá un cobro o recalculá.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Refinance Dialog ───────────────────────────────────────────────

function RefinanceDialog({ loan, onBack }: { loan: any; onBack: () => void }) {
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const cur = loan.currency

  // Calculate remaining unpaid capital and interest (accounting for partial payments)
  const unpaidInstallments = loan.loanInstallments.filter((i: any) => !i.isPaid)
  const unpaidPrincipal = unpaidInstallments.reduce((s: number, i: any) => {
    const paid = Number(i.paidAmount ?? 0)
    const paidInterest = Math.min(paid, Number(i.interest))
    const paidPrincipal = Math.max(paid - paidInterest, 0)
    return s + Math.max(Number(i.principal) - paidPrincipal, 0)
  }, 0)
  const unpaidInterest = unpaidInstallments.reduce((s: number, i: any) => {
    const paid = Number(i.paidAmount ?? 0)
    const paidInterest = Math.min(paid, Number(i.interest))
    return s + Math.max(Number(i.interest) - paidInterest, 0)
  }, 0)

  const [capitalizeInterest, setCapitalizeInterest] = useState(false)
  const [tna, setTna] = useState((Number(loan.tna) * 100).toFixed(1))
  const [termMonths, setTermMonths] = useState(String(loan.termMonths || 6))
  const [startDate, setStartDate] = useState(formatDateToInput(new Date()))
  const [note, setNote] = useState('')

  const newCapital = capitalizeInterest ? unpaidPrincipal + unpaidInterest : unpaidPrincipal

  // Client-side preview
  const previewTable = (() => {
    try {
      const t = parseInt(termMonths)
      const tnaVal = parseFloat(tna) / 100
      if (!t || t <= 0 || !tnaVal || newCapital <= 0) return []
      const rate = tnaToMonthlyRate(tnaVal)
      const inst = frenchInstallment(newCapital, rate, t)
      return generateAmortizationTable(newCapital, rate, t, inst, startDate)
    } catch {
      return []
    }
  })()

  const refinanceMutation = trpc.loans.refinanceLoan.useMutation({
    onSuccess: (newLoan) => {
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      utils.loans.getById.invalidate({ id: loan.id })
      setOpen(false)
      onBack()
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refinanciar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refinanciar préstamo</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Capital impago</Label>
              <div className="text-lg font-bold text-foreground">{formatCurrency(unpaidPrincipal, cur)}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Capitalizar intereses</Label>
                <p className="text-xs text-muted-foreground">
                  Sumar {formatCurrency(unpaidInterest, cur)} de intereses al capital
                </p>
              </div>
              <Switch checked={capitalizeInterest} onCheckedChange={setCapitalizeInterest} />
            </div>

            {capitalizeInterest && (
              <div className="bg-amber-500/10 text-amber-400 rounded-lg px-3 py-2 text-sm">
                Nuevo capital: <strong>{formatCurrency(newCapital, cur)}</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>TNA (%)</Label>
                <Input type="number" value={tna} onChange={(e) => setTna(e.target.value)} step="0.5" />
              </div>
              <div className="space-y-2">
                <Label>Plazo (meses)</Label>
                <Input type="number" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} min="1" max="360" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo del refinanciamiento" />
            </div>

            <Button
              className="w-full"
              disabled={refinanceMutation.isPending || newCapital <= 0}
              onClick={() => refinanceMutation.mutate({
                loanId: loan.id,
                capitalizeInterest,
                tna: parseFloat(tna) / 100,
                termMonths: parseInt(termMonths),
                startDate,
                note: note || undefined,
              })}
            >
              {refinanceMutation.isPending ? 'Refinanciando...' : 'Confirmar refinanciamiento'}
            </Button>

            {refinanceMutation.error && (
              <p className="text-sm text-red-500">{refinanceMutation.error.message}</p>
            )}
          </div>

          {/* Right: Preview table */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Preview nueva tabla</p>
            {previewTable.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-muted-foreground">
                      <th className="py-1.5 px-2 text-left">#</th>
                      <th className="py-1.5 px-2 text-right">Cuota</th>
                      <th className="py-1.5 px-2 text-right">Interés</th>
                      <th className="py-1.5 px-2 text-right">Capital</th>
                      <th className="py-1.5 px-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTable.map((row: any) => (
                      <tr key={row.month} className="border-b border-border/50">
                        <td className="py-1 px-2">{row.month}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(row.installment, cur)}</td>
                        <td className="py-1 px-2 text-right text-blue-400">{formatCurrency(row.interest, cur)}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(row.principal, cur)}</td>
                        <td className="py-1 px-2 text-right">{formatCurrency(row.balance, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                Completá los datos para ver la preview
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Copy Collection Message ────────────────────────────────────────

function CopyCollectionMessage({ loan }: { loan: any }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const { toast } = useToast()
  const cur = loan.currency

  const nextInstallment = loan.loanInstallments.find((i: any) => !i.isPaid)
  if (!nextInstallment) return null

  const nombre = loan.borrowerName.split(' - ')[0]
  const fecha = format(new Date(nextInstallment.dueDate), "d 'de' MMMM", { locale: es })
  const monto = formatCurrency(Math.max(Number(nextInstallment.amount) - Number(nextInstallment.paidAmount ?? 0), 0), cur)
  const total = loan.loanInstallments.length
  const saldo = formatCurrency(
    loan.loanInstallments.filter((i: any) => !i.isPaid).reduce((s: number, i: any) =>
      s + Math.max(Number(i.amount) - Number(i.paidAmount ?? 0), 0), 0),
    cur
  )

  const defaultMessage = `Hola ${nombre}! Te recuerdo que el ${fecha} vence tu cuota #${nextInstallment.number} por ${monto} (de un total de ${total} cuotas). Saldo pendiente: ${saldo}. Cualquier consulta avisame. 🙌`

  // Initialize message if empty
  if (message === '' && defaultMessage !== '') {
    setMessage(defaultMessage)
  }

  // Reset message when dialog opens
  function handleOpenChange(v: boolean) {
    if (v) setMessage(defaultMessage)
    setOpen(v)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      toast({ title: '¡Mensaje copiado!' })
      setOpen(false)
    } catch {
      toast({ title: 'Error al copiar', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageCircle className="h-4 w-4 mr-2" />
          Mensaje de cobro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mensaje de cobro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px]"
          />
          <Button onClick={handleCopy} className="w-full">
            <Copy className="h-4 w-4 mr-2" />
            Copiar al portapapeles
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Loan Activity Timeline ──────────────────────────────────────────

const TAG_CONFIG: Record<string, { label: string; color: string; icon: typeof Phone }> = {
  llamada: { label: 'Llamada', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Phone },
  pago: { label: 'Pago', color: 'bg-green-500/15 text-green-400 border-green-500/30', icon: Banknote },
  acuerdo: { label: 'Acuerdo', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Handshake },
  otro: { label: 'Otro', color: 'bg-muted text-muted-foreground border-border', icon: MessageCircle },
}

function LoanActivityTimeline({ loanId, logs }: { loanId: string; logs: any[] }) {
  const utils = trpc.useUtils()
  const [note, setNote] = useState('')
  const [tag, setTag] = useState<string>('otro')
  const [logDate, setLogDate] = useState(formatDateToInput(new Date()))

  const addMutation = trpc.loans.addActivityLog.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      setNote('')
      setTag('otro')
      setLogDate(formatDateToInput(new Date()))
    },
  })

  const deleteMutation = trpc.loans.deleteActivityLog.useMutation({
    onSuccess: () => utils.loans.getById.invalidate({ id: loanId }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Actividad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TAG_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="w-full sm:w-36"
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Agregar nota..."
            className="flex-1 min-h-[38px] h-[38px] resize-none"
          />
          <Button
            size="sm"
            disabled={!note.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate({ loanId, note: note.trim(), tag: tag as any, logDate })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>

        {/* Timeline */}
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 italic">Sin actividad registrada</p>
        ) : (
          <div className="relative pl-6 space-y-3">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

            {logs.map((log) => {
              const cfg = TAG_CONFIG[log.tag] || TAG_CONFIG.otro
              const TagIcon = cfg.icon
              return (
                <div key={log.id} className="relative group">
                  {/* Dot */}
                  <div className="absolute -left-6 top-1.5 h-[18px] w-[18px] rounded-full bg-background border-2 border-border flex items-center justify-center">
                    <TagIcon className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", cfg.color)}>
                          {cfg.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(log.logDate), "d MMM yyyy", { locale: es })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-0.5">{log.note}</p>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate({ logId: log.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

