'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/contexts/trpc-client'
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
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatDateToInput } from '@/lib/utils'
import {
  Plus,
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertCircle,
  Banknote,
  Trash2,
  Pencil,
  Check,
  X,
  UserCircle,
  RefreshCw,
  Link2,
  MinusCircle,
  Ban,
  MoreHorizontal,
  Users,
  XCircle,
  Undo2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

import { amountClass, loanRateInfo } from '@/components/loans/helpers'
import { LoansDashboardSummary, OverdueBanner } from '@/components/loans/loans-dashboard-summary'
import { DebtsDashboardSummary } from '@/components/loans/debts-dashboard-summary'

import { LoanListHeader } from '@/components/loans/loan-list-header'
import { LoansTableView } from '@/components/loans/loans-table-view'
import { InstallmentCalendar } from '@/components/loans/installment-calendar'
import { RegisterPaymentDialog } from '@/components/loans/register-payment-dialog'
import { PaymentHistorySection } from '@/components/loans/payment-history-section'
import { MonthlyAccrualsTable } from '@/components/loans/monthly-accruals-table'
import { RefinanceDialog } from '@/components/loans/refinance-dialog'
import { CopyCollectionMessage } from '@/components/loans/copy-collection-message'
import { LoanActivityTimeline } from '@/components/loans/loan-activity-timeline'
import { LoanAttachments } from '@/components/loans/loan-attachments'
import { CollectorView } from '@/components/loans/collector-view'
import { GenerateContractButton } from '@/components/loans/generate-contract-button'

export default function LoansPage() {
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'calendar' | 'collector'>('table')
  const [tab, setTab] = useState<'lender' | 'borrower'>('lender')

  if (selectedLoanId) {
    return <LoanDetail loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />
  }

  if (view === 'collector') {
    return (
      <div className="space-y-6">
        <LoanListHeader view={view} onViewChange={setView} direction={tab} tab={tab} onTabChange={setTab} />
        <OverdueBanner />
        <CollectorView onSelect={setSelectedLoanId} />
      </div>
    )
  }

  const mainContent = view === 'calendar'
    ? <InstallmentCalendar onSelectLoan={setSelectedLoanId} />
    : <LoansTableView onSelect={setSelectedLoanId} direction={tab} />

  return (
    <div className="space-y-6">
      <LoanListHeader view={view} onViewChange={setView} direction={tab} tab={tab} onTabChange={setTab} />

      {tab === 'lender' ? (
        <div className="space-y-6">
          <LoansDashboardSummary />
          {mainContent}
        </div>
      ) : (
        <div className="space-y-6">
          <DebtsDashboardSummary />
          {mainContent}
        </div>
      )}
    </div>
  )
}

// ─── Loan Detail ─────────────────────────────────────────────────────

function LoanDetail({ loanId, onBack }: { loanId: string; onBack: () => void }) {
  const utils = trpc.useUtils()
  const router = useRouter()
  const { data: loan, isLoading } = trpc.loans.getById.useQuery({ id: loanId })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editConcept, setEditConcept] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editTna, setEditTna] = useState('')
  const [assignPersonOpen, setAssignPersonOpen] = useState(false)
  const [assignPersonId, setAssignPersonId] = useState('')
  const [assignCollectorOpen, setAssignCollectorOpen] = useState(false)
  const [assignCollectorId, setAssignCollectorId] = useState('')
  const { data: allPersons } = trpc.persons.list.useQuery()
  // allPersons is already queried above — reuse for collector assignment
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

  const updateRateMutation = trpc.loans.updateRate.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.getMonthlyAccruals.invalidate({ loanId })
      utils.loans.getLoanPayments.invalidate({ loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      utils.loans.getDashboardMetricsDebtor?.invalidate?.()
      toast({ title: 'Tasa actualizada y cuotas recalculadas' })
      setEditing(false)
    },
  })

  const completeMutation = trpc.loans.completeLoan.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      setConfirmComplete(false)
      toast({ title: 'Préstamo completado' })
    },
    onError: (err) => {
      toast({ title: 'Error al completar', description: err.message, variant: 'destructive' })
    },
  })

  const [confirmUncollectible, setConfirmUncollectible] = useState(false)

  const markUncollectibleMutation = trpc.loans.markUncollectible.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      utils.portfolio.getFullPortfolio.invalidate()
      utils.portfolio.getYieldMetrics.invalidate()
      utils.portfolio.getMetrics.invalidate()
      setConfirmUncollectible(false)
      toast({ title: 'Préstamo marcado como incobrable', description: 'La TIR de tu cartera se recalculó incluyendo este préstamo como pérdida.' })
    },
    onError: (err) => {
      toast({ title: 'No se pudo marcar como incobrable', description: err.message, variant: 'destructive' })
    },
  })

  const unmarkUncollectibleMutation = trpc.loans.unmarkUncollectible.useMutation({
    onSuccess: () => {
      utils.loans.getById.invalidate({ id: loanId })
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      utils.portfolio.getFullPortfolio.invalidate()
      utils.portfolio.getYieldMetrics.invalidate()
      utils.portfolio.getMetrics.invalidate()
      toast({ title: 'Préstamo reactivado', description: 'Vuelve a contar como préstamo activo en tu cartera.' })
    },
    onError: (err) => {
      toast({ title: 'No se pudo reactivar', description: err.message, variant: 'destructive' })
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
    setEditConcept(loan.concept ?? '')
    setEditStartDate(formatDateToInput(new Date(loan.startDate)))
    setEditTna(String((Number(loan.tna) * 100).toFixed(2)))
    setEditing(true)
  }

  function saveEdit() {
    if (!loan) return

    const originalTnaPct = (Number(loan.tna) * 100).toFixed(2)
    const newTnaPct = parseFloat(editTna)
    const tnaChanged = !isNaN(newTnaPct) && newTnaPct.toFixed(2) !== originalTnaPct && loan.status === 'active'

    const changes: { id: string; borrowerName?: string; concept?: string | null; startDate?: string } = { id: loanId }
    if (!loan.person && editName !== loan.borrowerName) changes.borrowerName = editName
    if (loan.person) {
      const trimmed = editConcept.trim()
      const current = loan.concept ?? ''
      if (trimmed !== current) changes.concept = trimmed || null
    }
    const currentStart = formatDateToInput(new Date(loan.startDate))
    if (editStartDate !== currentStart) changes.startDate = editStartDate

    if (Object.keys(changes).length > 1) updateMutation.mutate(changes)

    if (tnaChanged) {
      updateRateMutation.mutate({ loanId, tna: newTnaPct / 100 })
    } else if (Object.keys(changes).length === 1) {
      // Nothing changed
      setEditing(false)
    }
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
  const isZeroRate = Number(loan.monthlyRate) === 0
  const isZeroRateAmortized = !isInterestOnly && isZeroRate
  const cur = loan.currency
  const loanSubtitle = loan.person ? (loan.concept ?? '') : ''
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
              {loan.person ? (
                <>
                  <p className="text-lg font-bold text-foreground">{loan.person.name}</p>
                  <Input
                    value={editConcept}
                    onChange={(e) => setEditConcept(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Concepto (opcional, ej: consumo, auto)"
                    autoFocus
                  />
                </>
              ) : (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-bold h-9"
                  autoFocus
                />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-xs text-muted-foreground shrink-0">Fecha inicio:</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="h-8 text-sm w-auto"
                />
                {loan?.status === 'active' && (
                  <>
                    <Label className="text-xs text-muted-foreground shrink-0">TNA (%):</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editTna}
                      onChange={(e) => setEditTna(e.target.value)}
                      className="h-8 text-sm w-24"
                    />
                    {(() => {
                      const newTna = parseFloat(editTna)
                      const origTna = Number(loan?.tna) * 100
                      return !isNaN(newTna) && Math.abs(newTna - origTna) > 0.01 ? (
                        <span className="text-xs text-amber-400">⚠ Recalcula cuotas y rendimiento</span>
                      ) : null
                    })()}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {loan.person
                    ? (loan.person.name || loan.person.alias || loan.borrowerName)
                    : loan.borrowerName
                  }
                </h1>
                {(isInterestOnly || isZeroRateAmortized) && (
                  <Badge variant="outline" className="text-xs">
                    {isZeroRate ? 'Sin intereses' : 'Solo interés'}
                  </Badge>
                )}
                {cur !== 'ARS' && (
                  <Badge variant="outline" className="text-xs">{cur}</Badge>
                )}
              </div>
              {loanSubtitle && (
                <p className="text-sm text-muted-foreground font-medium">{loanSubtitle}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {isZeroRate
                  ? `${formatCurrency(Number(loan.capital), cur)} · Sin intereses`
                  : isInterestOnly
                    ? `${formatCurrency(Number(loan.capital), cur)} · Interés mensual: ${formatCurrency(Number(loan.installmentAmount), cur)}`
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
        <button
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted hover:bg-muted/70 transition-colors w-full text-left"
          onClick={() => router.push(`/dashboard/persons?person=${loan.person!.id}`)}
        >
          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Persona:</span>
          <strong className="text-foreground">{loan.person.name || loan.person.alias}</strong>
          {loan.person.alias && loan.person.name && (
            <span className="text-muted-foreground">({loan.person.alias})</span>
          )}
          <Link2 className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
        </button>
      )}

      {/* Collector assignment */}
      {loan.direction === 'lender' && (
        loan.collector ? (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted w-full">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Cobrador:</span>
            <strong className="text-foreground">{loan.collector.name}</strong>
            {loan.collector.alias && (
              <span className="text-muted-foreground text-xs">({loan.collector.alias})</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 text-xs text-muted-foreground"
              onClick={() => updateMutation.mutate({ id: loanId, collectorId: null })}
            >
              Quitar
            </Button>
          </div>
        ) : allPersons && allPersons.length > 0 ? (
          assignCollectorOpen ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={assignCollectorId} onValueChange={setAssignCollectorId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Seleccionar cobrador" />
                </SelectTrigger>
                <SelectContent>
                  {allPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.alias ? `(${p.alias})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!assignCollectorId || updateMutation.isPending}
                onClick={() => {
                  updateMutation.mutate({ id: loanId, collectorId: assignCollectorId })
                  setAssignCollectorOpen(false)
                }}
              >
                Asignar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAssignCollectorOpen(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAssignCollectorOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Asignar cobrador
            </Button>
          )
        ) : null
      )}

      {/* Summary cards */}
      <div className={cn("grid gap-4", (isInterestOnly || isZeroRateAmortized) ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
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
        {isInterestOnly && !isZeroRate ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Interés mensual</p>
              <p className="text-xl font-bold text-accent-blue mt-1">{formatCurrency(Number(loan.installmentAmount), cur)}</p>
            </CardContent>
          </Card>
        ) : isZeroRateAmortized || (isInterestOnly && isZeroRate) ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital pendiente</p>
              <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(Number(loan.principalOutstanding ?? loan.capital), cur)}</p>
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

      {/* Defaulted (incobrable) banner — reversible */}
      {loan.status === 'defaulted' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-accent-danger/5 border border-accent-danger/30 border-l-4 border-l-accent-danger">
          <XCircle className="h-5 w-5 text-accent-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-accent-danger">Préstamo marcado como incobrable</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              En la cartera, su TIR se calcula con los flujos realmente cobrados. Si no se cobró nada, contribuye con -100% al rendimiento ponderado.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => unmarkUncollectibleMutation.mutate({ loanId })}
            disabled={unmarkUncollectibleMutation.isPending}
            className="shrink-0"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
            {unmarkUncollectibleMutation.isPending ? 'Reactivando...' : 'Reactivar'}
          </Button>
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

      {/* Action buttons — amortized with installments */}
      {loan.status === 'active' && unpaidCount > 0 && !isZeroRateAmortized && (
        <div className="flex flex-wrap gap-2">
          <CopyCollectionMessage loan={loan} />
          <RegisterPaymentDialog loanId={loanId} cur={cur} loan={loan} />
          <RefinanceDialog loan={loan} onBack={onBack} />
          <GenerateContractButton loan={loan} />
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
          {confirmUncollectible ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-accent-danger font-medium">Marcar como incobrable?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => markUncollectibleMutation.mutate({ loanId })}
                disabled={markUncollectibleMutation.isPending}
              >
                {markUncollectibleMutation.isPending ? 'Marcando...' : 'Si, incobrable'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmUncollectible(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmUncollectible(true)}
              className="text-muted-foreground hover:text-accent-danger ml-auto"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Marcar como incobrable
            </Button>
          )}
        </div>
      )}

      {/* Amortized loan fully paid but not auto-completed */}
      {!isInterestOnly && !isZeroRateAmortized && loan.status === 'active' && unpaidCount === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Todas las cuotas están pagas.</span>
          </div>
          {confirmComplete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Confirmar cierre?</span>
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

      {/* Interest-only and zero-rate action buttons */}
      {(isInterestOnly || isZeroRateAmortized) && loan.status === 'active' && (
        <div className="flex flex-wrap gap-2">
          {isInterestOnly && !isZeroRate && unpaidCount <= 3 && (
            <Button
              variant="outline"
              onClick={() => generateMoreMutation.mutate({ loanId })}
              disabled={generateMoreMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {generateMoreMutation.isPending ? 'Generando...' : 'Generar más cuotas'}
            </Button>
          )}
          {isZeroRate && <RegisterPaymentDialog loanId={loanId} cur={cur} loan={loan} />}
          <GenerateContractButton loan={loan} />
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
          {confirmUncollectible ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-accent-danger font-medium">Marcar como incobrable?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => markUncollectibleMutation.mutate({ loanId })}
                disabled={markUncollectibleMutation.isPending}
              >
                {markUncollectibleMutation.isPending ? 'Marcando...' : 'Si, incobrable'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmUncollectible(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmUncollectible(true)}
              className="text-muted-foreground hover:text-accent-danger ml-auto"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Marcar como incobrable
            </Button>
          )}
        </div>
      )}

      {/* Installments table */}
      <Tabs defaultValue="installments" className="w-full">
        <TabsList>
          <TabsTrigger value="installments">Cuotas</TabsTrigger>
          <TabsTrigger value="accounting">Contabilidad</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>
        <TabsContent value="installments" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {/* Zero-rate amortized: no installment schedule */}
              {isZeroRateAmortized && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <Banknote className="h-8 w-8" />
                  <p className="text-sm">Este préstamo no tiene cuotas programadas.</p>
                  <p className="text-xs">El capital se devuelve sin intereses ni calendario fijo.</p>
                </div>
              )}
              {/* Desktop table */}
              {!isZeroRateAmortized && <div className="hidden md:block overflow-x-auto">
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
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {paidAmount === 0 && (
                                      <DropdownMenuItem onClick={() => {
                                        setEditInstId(inst.id)
                                        setEditInstAmount(String(Number(inst.amount)))
                                        setEditInstDate(formatDateToInput(dueDate))
                                      }}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" />
                                        Editar cuota
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      className="text-red-400 focus:text-red-400"
                                      onClick={() => setWaiveInstId(inst.id)}
                                    >
                                      <Ban className="h-3.5 w-3.5 mr-2" />
                                      Condonar saldo
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>}

              {/* Mobile list */}
              {!isZeroRateAmortized && <div className="md:hidden divide-y divide-border">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {paidAmount === 0 && (
                                <DropdownMenuItem onClick={() => {
                                  setEditInstId(inst.id)
                                  setEditInstAmount(String(Number(inst.amount)))
                                  setEditInstDate(formatDateToInput(dueDate))
                                }}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" />
                                  Editar cuota
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-red-400 focus:text-red-400"
                                onClick={() => setWaiveInstId(inst.id)}
                              >
                                <Ban className="h-3.5 w-3.5 mr-2" />
                                Condonar saldo
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="accounting" className="mt-4">
          <MonthlyAccrualsTable loanId={loanId} cur={cur} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <LoanActivityTimeline loanId={loanId} logs={loan.activityLogs || []} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <LoanAttachments loanId={loanId} />
            </CardContent>
          </Card>
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
    </div>
  )
}


