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
} from 'lucide-react'
import { calculatePersonScore } from '@/lib/loan-scoring'

export default function LoansPage() {
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  if (selectedLoanId) {
    return <LoanDetail loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />
  }

  return (
    <div className="space-y-8">
      <LoanListHeader view={view} onViewChange={setView} />
      <LoansDashboardSummary />
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          {view === 'list' ? (
            <LoanListContent onSelect={setSelectedLoanId} />
          ) : (
            <InstallmentCalendar onSelectLoan={setSelectedLoanId} />
          )}
        </div>
        <UpcomingInstallmentsGadget />
      </div>
    </div>
  )
}

// ─── Loan List Header ────────────────────────────────────────────────

function LoanListHeader({ view, onViewChange }: { view: 'list' | 'calendar'; onViewChange: (v: 'list' | 'calendar') => void }) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Préstamos</h1>
        <p className="text-muted-foreground mt-1">Gestioná tus préstamos personales</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex bg-muted rounded-lg p-0.5">
          <Button
            variant={view === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => onViewChange('list')}
          >
            <Banknote className="h-4 w-4 mr-1.5" />
            Lista
          </Button>
          <Button
            variant={view === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => onViewChange('calendar')}
          >
            <CalendarDays className="h-4 w-4 mr-1.5" />
            Calendario
          </Button>
        </div>
        <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </div>
  )
}

// ─── Dashboard Summary ──────────────────────────────────────────────

function LoansDashboardSummary() {
  const { data: metrics, isLoading } = trpc.loans.getDashboardMetrics.useQuery()

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  if (!metrics || metrics.activeLoansCount === 0) return null

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Capital activo</p>
          <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(metrics.totalCapitalActive)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{metrics.activeLoansCount} préstamo{metrics.activeLoansCount !== 1 ? 's' : ''}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendiente cobro</p>
          <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(metrics.totalPending)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Esta semana</p>
          <p className={cn(
            'text-xl font-bold mt-1',
            metrics.thisWeekCount > 0 ? 'text-accent-blue' : 'text-muted-foreground'
          )}>
            {metrics.thisWeekCount > 0 ? formatCurrency(metrics.thisWeekAmount) : '-'}
          </p>
          {metrics.thisWeekCount > 0 && (
            <p className="text-xs text-accent-blue mt-0.5">{metrics.thisWeekCount} cuota{metrics.thisWeekCount !== 1 ? 's' : ''}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidas</p>
          <p className={cn(
            'text-xl font-bold mt-1',
            metrics.overdueCount > 0 ? 'text-accent-danger' : 'text-accent-positive'
          )}>
            {metrics.overdueCount > 0 ? formatCurrency(metrics.overdueAmount) : 'Ninguna'}
          </p>
          {metrics.overdueCount > 0 && (
            <p className="text-xs text-accent-danger mt-0.5">{metrics.overdueCount} cuota{metrics.overdueCount !== 1 ? 's' : ''} sin cobrar</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Upcoming Installments Gadget ───────────────────────────────────

function UpcomingInstallmentsGadget() {
  const { data: metrics } = trpc.loans.getDashboardMetrics.useQuery()

  if (!metrics || metrics.upcomingInstallments.length === 0) return null

  const now = new Date()

  return (
    <Card className="h-fit sticky top-20">
      <CardContent className="p-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Próximas cuotas</p>
        <div className="space-y-3">
          {metrics.upcomingInstallments.map((inst) => {
            const dueDate = new Date(inst.dueDate)
            const isOverdue = dueDate < now
            return (
              <div key={inst.id} className="flex items-center gap-2.5">
                <div className={cn(
                  'flex flex-col items-center justify-center h-9 w-9 rounded-lg shrink-0',
                  isOverdue ? 'bg-red-500/10' : 'bg-muted'
                )}>
                  <span className={cn(
                    'text-[8px] font-bold uppercase leading-none',
                    isOverdue ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {format(dueDate, 'MMM', { locale: es })}
                  </span>
                  <span className="text-sm font-bold text-foreground leading-none">
                    {format(dueDate, 'd')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{inst.borrowerName}</p>
                  <p className={cn(
                    'text-[10px]',
                    isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
                  )}>
                    #{inst.number}{isOverdue ? ' · VENCIDA' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-foreground">
                    {formatCurrency(inst.amount, inst.currency)}
                  </p>
                  {inst.currency !== 'ARS' && (
                    <p className="text-[10px] text-muted-foreground">{inst.currency}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Loan List Content ───────────────────────────────────────────────

function LoanListContent({ onSelect }: { onSelect: (id: string) => void }) {
  const utils = trpc.useUtils()
  const { data: loans, isLoading } = trpc.loans.list.useQuery()
  const [createOpen, setCreateOpen] = useState(false)

  const confirmMutation = trpc.loans.confirmPreApproved.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
    },
  })

  const deleteMutation = trpc.loans.delete.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
    },
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!loans || loans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">Sin préstamos</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Creá tu primer préstamo o usa el simulador
          </p>
          <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} />
        </CardContent>
      </Card>
    )
  }

  const preApproved = loans.filter((l) => l.status === 'pre_approved')
  const otherLoans = loans.filter((l) => l.status !== 'pre_approved')

  return (
    <div className="space-y-6">
      {/* Pre-approved section */}
      {preApproved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-accent-warning uppercase tracking-wider">
              Preaprobados
            </h2>
            <Badge variant="outline" className="text-accent-warning border-amber-600 text-[10px]">
              {preApproved.length}
            </Badge>
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {preApproved.map((loan) => (
              <PreApprovedLoanCard
                key={loan.id}
                loan={loan}
                onConfirm={(loanId, startDate) => confirmMutation.mutate({ loanId, startDate })}
                onDelete={(id) => deleteMutation.mutate({ id })}
                isConfirming={confirmMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {otherLoans.map((loan) => {
        const now = new Date()
        const nextDue = loan.nextDueDate ? new Date(loan.nextDueDate) : null
        const isOverdue = nextDue && nextDue < now
        const isInterestOnly = loan.loanType === 'interest_only'
        const isZeroRate = Number(loan.monthlyRate) === 0
        const progress = !isInterestOnly && loan.totalCount > 0 ? (loan.paidCount / loan.totalCount) * 100 : 0
        const cur = loan.currency

        // Parse title/subtitle from borrowerName
        let cardTitle: string
        let cardSubtitle: string | null = null
        if (loan.person) {
          cardTitle = loan.person.name || loan.person.alias || loan.borrowerName
          // Remove person name from borrowerName to get subtitle
          const parts = loan.borrowerName.split(' - ')
          if (parts.length > 1) {
            const personName = loan.person.name || loan.person.alias || ''
            cardSubtitle = parts.filter(p => p.trim() !== personName.trim()).join(' - ') || null
          }
        } else {
          const parts = loan.borrowerName.split(' - ')
          cardTitle = parts[0]
          cardSubtitle = parts.length > 1 ? parts.slice(1).join(' - ') : null
        }

        // Collect chips
        const chips: { label: string; variant?: 'destructive' | 'outline' }[] = []
        if (isInterestOnly) {
          chips.push({ label: isZeroRate ? 'Sin intereses' : 'Solo interés', variant: 'outline' })
        }
        if (cur !== 'ARS') {
          chips.push({ label: cur, variant: 'outline' })
        }
        if (Number(loan.tna) > 1.5) {
          chips.push({ label: 'TNA >150%', variant: 'destructive' })
        }
        if (loan.person) {
          const scoreResult = calculatePersonScore(loan.person)
          if (scoreResult.score < 4) {
            chips.push({ label: 'Alto riesgo', variant: 'destructive' })
          }
        }

        return (
          <Card
            key={loan.id}
            className="cursor-pointer hover:border-primary/50 transition-all duration-200"
            onClick={() => onSelect(loan.id)}
          >
            <CardContent className="p-5 space-y-3">
              {/* NIVEL 1 — Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-foreground truncate">{cardTitle}</h3>
                  {cardSubtitle && (
                    <p className="text-sm text-muted-foreground truncate">{cardSubtitle}</p>
                  )}
                </div>
                <Badge
                  variant={
                    loan.status === 'active' ? 'default' :
                    loan.status === 'completed' ? 'secondary' : 'destructive'
                  }
                  className="shrink-0"
                >
                  {loan.status === 'active' ? 'Activo' :
                   loan.status === 'completed' ? 'Completado' : 'Moroso'}
                </Badge>
              </div>

              {/* NIVEL 2 — Info + Chips */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(Number(loan.capital), cur)}
                  {' · '}
                  {isInterestOnly
                    ? isZeroRate ? 'Sin plazo fijo' : 'Solo interés'
                    : `${loan.termMonths} meses`
                  }
                </p>
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <Badge key={chip.label} variant={chip.variant || 'outline'} className="text-[10px] px-1.5 py-0">
                        {chip.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* NIVEL 3 — Footer */}
              {/* Progress bar - only for amortized */}
              {!isInterestOnly && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cuotas pagadas</span>
                    <span className="font-medium text-foreground">{loan.paidCount}/{loan.totalCount}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Next due for amortized */}
              {nextDue && loan.status === 'active' && !isInterestOnly && (
                <div className={cn(
                  "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
                  isOverdue
                    ? "bg-red-500/10 text-red-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  {isOverdue ? (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0" />
                  )}
                  <span className="text-xs">
                    {isOverdue ? 'Vencida: ' : 'Próxima: '}
                    {format(nextDue, "d 'de' MMM", { locale: es })} · {formatCurrency(loan.nextAmount, cur)}
                  </span>
                </div>
              )}

              {/* Interest-only info */}
              {isInterestOnly && loan.status === 'active' && (
                <div className={cn(
                  "flex items-center gap-2 text-sm px-3 py-2 rounded-lg",
                  isZeroRate
                    ? "bg-green-500/10 text-green-400"
                    : "bg-blue-500/10 text-blue-400"
                )}>
                  <Infinity className="h-4 w-4 shrink-0" />
                  <span className="text-xs">
                    {isZeroRate
                      ? `Capital: ${formatCurrency(Number(loan.capital), cur)}`
                      : `Interés mensual: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                    }
                  </span>
                </div>
              )}

              <div className="flex justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
                <span>
                  {isInterestOnly
                    ? isZeroRate ? 'Sin intereses' : `${(Number(loan.monthlyRate) * 100).toFixed(1)}% mensual`
                    : `Cuota: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                  }
                </span>
                <span>{isZeroRate ? 'TNA: 0%' : `TNA: ${(Number(loan.tna) * 100).toFixed(1)}%`}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
    </div>
  )
}

// ─── Pre-Approved Loan Card ──────────────────────────────────────────

function PreApprovedLoanCard({
  loan,
  onConfirm,
  onDelete,
  isConfirming,
  isDeleting,
}: {
  loan: any
  onConfirm: (loanId: string, startDate: string) => void
  onDelete: (id: string) => void
  isConfirming: boolean
  isDeleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDate, setConfirmDate] = useState(formatDateToInput(new Date()))
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const cur = loan.currency
  const isInterestOnly = loan.loanType === 'interest_only'

  return (
    <Card className="border-amber-800/50 bg-amber-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-foreground truncate">{loan.borrowerName}</h3>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(Number(loan.capital), cur)}
              {' · '}
              {isInterestOnly ? 'Solo interés' : `${loan.termMonths} meses`}
            </p>
          </div>
          <Badge variant="outline" className="text-accent-warning border-amber-600 shrink-0">
            Preaprobado
          </Badge>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {isInterestOnly
              ? `${(Number(loan.monthlyRate) * 100).toFixed(1)}% mensual`
              : `Cuota: ${formatCurrency(Number(loan.installmentAmount), cur)}`
            }
          </span>
          <span>TNA: {(Number(loan.tna) * 100).toFixed(1)}%</span>
        </div>

        {expanded ? (
          <div className="space-y-3 pt-2 border-t border-amber-800/50">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha de inicio del préstamo</Label>
              <Input
                type="date"
                value={confirmDate}
                onChange={(e) => setConfirmDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onConfirm(loan.id, confirmDate)}
                disabled={isConfirming}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {isConfirming ? 'Confirmando...' : 'Confirmar'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setExpanded(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Confirmar
            </Button>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(loan.id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? '...' : 'Si'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
    return <p className="text-muted-foreground">Préstamo no encontrado</p>
  }

  const now = new Date()
  const isInterestOnly = loan.loanType === 'interest_only'
  const cur = loan.currency
  const paid = loan.loanInstallments.filter((i) => i.isPaid).length
  const total = loan.loanInstallments.length
  const totalCollected = loan.loanInstallments
    .filter((i) => i.isPaid)
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const totalPending = loan.loanInstallments
    .filter((i) => !i.isPaid)
    .reduce((sum, i) => sum + Number(i.amount), 0)
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
                  <th className="text-right py-2 px-3 font-medium">Interés</th>
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
                          <button
                            onClick={() => unmarkPaid.mutate({ installmentId: inst.id })}
                            className="inline-flex items-center gap-1.5 text-accent-positive hover:opacity-70 transition-opacity"
                            title="Desmarcar como cobrada"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="text-xs">Cobrada</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => markPaid.mutate({ installmentId: inst.id })}
                            className={cn(
                              "inline-flex items-center gap-1.5 hover:text-green-400 transition-colors",
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
                        ? "text-accent-positive"
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
                      <p className="text-sm font-bold">{formatCurrency(Number(inst.amount), cur)}</p>
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

// ─── Installment Calendar ────────────────────────────────────────────

function InstallmentCalendar({ onSelectLoan }: { onSelectLoan: (id: string) => void }) {
  const { data: loans, isLoading } = trpc.loans.list.useQuery()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  if (isLoading) {
    return <Skeleton className="h-[500px]" />
  }

  // Collect all unpaid installments from active loans
  const allInstallments = (loans || [])
    .filter((l) => l.status === 'active')
    .flatMap((loan) =>
      loan.loanInstallments
        .filter((i) => !i.isPaid)
        .map((i) => ({
          ...i,
          dueDate: new Date(i.dueDate),
          amount: Number(i.amount),
          borrowerName: loan.borrowerName,
          loanId: loan.id,
          currency: loan.currency,
        }))
    )

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Offset for first day of month (Monday = 0)
  const startDayOfWeek = (getDay(monthStart) + 6) % 7 // Convert Sunday=0 to Monday=0
  const blanks = Array.from({ length: startDayOfWeek })

  // Group installments by day
  const installmentsByDay = new Map<string, typeof allInstallments>()
  for (const inst of allInstallments) {
    const key = format(inst.dueDate, 'yyyy-MM-dd')
    if (!installmentsByDay.has(key)) installmentsByDay.set(key, [])
    installmentsByDay.get(key)!.push(inst)
  }

  // Monthly totals
  const monthInstallments = allInstallments.filter(
    (i) => isSameMonth(i.dueDate, currentMonth)
  )
  const monthTotal = monthInstallments.reduce((s, i) => s + i.amount, 0)

  const now = new Date()

  // Borrower color mapping
  const borrowerNames = [...new Set((loans || []).map((l) => l.borrowerName))]
  const colorPalette = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
  ]
  const borrowerColors = new Map(borrowerNames.map((name, i) => [name, colorPalette[i % colorPalette.length]]))

  return (
    <div className="space-y-4">
      {/* Month nav + summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </h2>
              {monthTotal > 0 && (
                <p className="text-sm text-muted-foreground">
                  {monthInstallments.length} cuotas - {formatCurrency(monthTotal)} a cobrar
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonthsFn(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="h-20 md:h-24" />
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayInsts = installmentsByDay.get(key) || []
              const isToday = isSameDay(day, now)
              const hasOverdue = dayInsts.some((i) => i.dueDate < now)

              return (
                <div
                  key={key}
                  className={cn(
                    "h-20 md:h-24 rounded-lg border p-1 transition-colors",
                    isToday ? "border-primary bg-primary/5" : "border-border/50",
                    dayInsts.length > 0 && "hover:border-primary/50"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {dayInsts.slice(0, 2).map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => onSelectLoan(inst.loanId)}
                        className={cn(
                          "w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate transition-opacity hover:opacity-80",
                          hasOverdue && inst.dueDate < now
                            ? "bg-red-500/15 text-red-400"
                            : "bg-primary/10 text-primary"
                        )}
                        title={`${inst.borrowerName} - ${formatCurrency(inst.amount, inst.currency)}`}
                      >
                        <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle", borrowerColors.get(inst.borrowerName))} />
                        <span className="hidden md:inline">{inst.borrowerName} </span>
                        {formatCurrency(inst.amount, inst.currency)}
                      </button>
                    ))}
                    {dayInsts.length > 2 && (
                      <p className="text-[9px] text-muted-foreground text-center">+{dayInsts.length - 2} más</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* List below calendar for current month */}
      {monthInstallments.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">Cuotas del mes</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-1">
              {monthInstallments
                .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
                .map((inst) => {
                  const isOverdue = inst.dueDate < now
                  return (
                    <button
                      key={inst.id}
                      onClick={() => onSelectLoan(inst.loanId)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <div className={cn(
                        "flex flex-col items-center justify-center h-10 w-10 rounded-lg shrink-0",
                        isOverdue ? "bg-red-900/30" : "bg-muted"
                      )}>
                        <span className={cn(
                          "text-[9px] font-bold uppercase leading-none",
                          isOverdue ? "text-red-500" : "text-muted-foreground"
                        )}>
                          {format(inst.dueDate, 'MMM', { locale: es })}
                        </span>
                        <span className="text-base font-bold text-foreground leading-none">
                          {format(inst.dueDate, 'd')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{inst.borrowerName}</p>
                        <p className={cn(
                          "text-xs",
                          isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                        )}>
                          Cuota {inst.number} {isOverdue && '- VENCIDA'}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-foreground shrink-0">
                        {formatCurrency(inst.amount, inst.currency)}
                      </p>
                    </button>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
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
  const [currency, setCurrency] = useState<'ARS' | 'USD' | 'EUR'>('ARS')
  const [loanType, setLoanType] = useState<'amortized' | 'interest_only'>('amortized')
  const [tna, setTna] = useState(defaultValues?.tna || '')
  const [monthlyRate, setMonthlyRate] = useState('')
  const [termMonths, setTermMonths] = useState(defaultValues?.termMonths || '')
  const [startDate, setStartDate] = useState(defaultValues?.startDate || formatDateToInput(new Date()))
  const [customInstallment, setCustomInstallment] = useState('')
  const [impliedTna, setImpliedTna] = useState<number | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string>('')
  const [fciRate, setFciRate] = useState('40')
  const [suggestedTna, setSuggestedTna] = useState<number | null>(null)

  const { data: persons } = trpc.persons.list.useQuery()

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

  // Preview for interest-only
  const interestPreview = loanType === 'interest_only' && capital && monthlyRate
    ? parseFloat(capital) * (parseFloat(monthlyRate) / 100)
    : null

  const createMutation = trpc.loans.create.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate()
      utils.loans.getDashboardMetrics.invalidate()
      onOpenChange(false)
      setBorrowerName('')
      setCapital('')
      setCurrency('ARS')
      setLoanType('amortized')
      setTna('')
      setMonthlyRate('')
      setTermMonths('')
      setCustomInstallment('')
      setImpliedTna(null)
      setSelectedPersonId('')
      setSuggestedTna(null)
      setFciRate('40')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loanType === 'interest_only') {
      createMutation.mutate({
        borrowerName,
        capital: parseFloat(capital),
        currency,
        loanType: 'interest_only',
        monthlyInterestRate: parseFloat(monthlyRate) / 100,
        startDate,
        personId: selectedPersonId || undefined,
      })
    } else {
      createMutation.mutate({
        borrowerName,
        capital: parseFloat(capital),
        currency,
        loanType: 'amortized',
        tna: parseFloat(tna) / 100,
        termMonths: parseInt(termMonths),
        startDate,
        personId: selectedPersonId || undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Préstamo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Préstamo</DialogTitle>
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

          {/* Person selector */}
          {persons && persons.length > 0 && (
            <div className="space-y-2">
              <Label>Persona (opcional)</Label>
              <Select value={selectedPersonId} onValueChange={(v) => {
                const id = v === '__none__' ? '' : v
                setSelectedPersonId(id)
                if (id) {
                  const p = persons.find((p) => p.id === id)
                  if (p) {
                    if (!borrowerName) setBorrowerName(p.name)
                    if (p.category !== 'critico') {
                      const fci = parseFloat(fciRate || '0') / 100
                      const suggested = (fci + p.minTnaSpread) * 100
                      const suggestedRounded = Math.round(suggested * 10) / 10
                      setSuggestedTna(suggestedRounded)
                      setTna(suggestedRounded.toString())
                      setCustomInstallment('')
                      setImpliedTna(null)
                      // Also suggest monthly rate for interest-only
                      const monthlyFromTna = (Math.pow(1 + fci + p.minTnaSpread, 1 / 12) - 1) * 100
                      setMonthlyRate(Math.round(monthlyFromTna * 10) / 10 + '')
                    }
                  }
                } else {
                  setSuggestedTna(null)
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin persona asignada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin persona</SelectItem>
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.alias ? `(${p.alias})` : ''} · Score: {p.score}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPersonId && (() => {
                const sp = persons.find((p) => p.id === selectedPersonId)
                if (!sp) return null
                const isCritical = sp.category === 'critico'
                return (
                  <div className={cn(
                    'text-xs px-3 py-2 rounded-lg flex items-center gap-2',
                    isCritical
                      ? 'bg-red-500/10 text-red-400'
                      : sp.category === 'alto'
                        ? 'bg-orange-500/10 text-orange-400'
                        : sp.category === 'medio'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-green-500/10 text-accent-positive'
                  )}>
                    {isCritical ? <ShieldX className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    <span>
                      {isCritical
                        ? 'Score crítico — no se recomienda prestar'
                        : `Riesgo ${sp.category} · Spread mínimo: +${(sp.minTnaSpread * 100).toFixed(0)}pp`
                      }
                    </span>
                  </div>
                )
              })()}
            </div>
          )}

          {/* FCI rate - only show when person selected */}
          {selectedPersonId && persons?.find((p) => p.id === selectedPersonId)?.category !== 'critico' && (
            <div className="space-y-2">
              <Label htmlFor="fciRate">Tasa FCI referencia (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="fciRate"
                  type="number"
                  value={fciRate}
                  onChange={(e) => {
                    setFciRate(e.target.value)
                    const p = persons?.find((p) => p.id === selectedPersonId)
                    if (p && p.category !== 'critico') {
                      const fci = parseFloat(e.target.value || '0') / 100
                      const suggested = (fci + p.minTnaSpread) * 100
                      const suggestedRounded = Math.round(suggested * 10) / 10
                      setSuggestedTna(suggestedRounded)
                      setTna(suggestedRounded.toString())
                      setCustomInstallment('')
                      setImpliedTna(null)
                      const monthlyFromTna = (Math.pow(1 + fci + p.minTnaSpread, 1 / 12) - 1) * 100
                      setMonthlyRate(Math.round(monthlyFromTna * 10) / 10 + '')
                    }
                  }}
                  className="w-24"
                  step="1"
                  min="0"
                />
                <span className="text-xs text-muted-foreground">
                  FCI {fciRate}% + spread {(() => {
                    const p = persons?.find((p) => p.id === selectedPersonId)
                    return p ? `${(p.minTnaSpread * 100).toFixed(0)}pp` : ''
                  })()} = <strong className="text-foreground">{suggestedTna?.toFixed(1)}% TNA</strong>
                </span>
              </div>
            </div>
          )}

          {/* Loan type & currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Préstamo</Label>
              <Select value={loanType} onValueChange={(v) => setLoanType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amortized">Amortizado (cuotas fijas)</SelectItem>
                  <SelectItem value="interest_only">Solo interés (sin plazo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS (Pesos)</SelectItem>
                  <SelectItem value="USD">USD (Dolares)</SelectItem>
                  <SelectItem value="EUR">EUR (Euros)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loanCapital">Capital ({currency})</Label>
              <Input
                id="loanCapital"
                type="number"
                value={capital}
                onChange={(e) => handleCapitalChange(e.target.value)}
                placeholder="1000000"
                required
              />
            </div>
            {loanType === 'amortized' ? (
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="loanMonthlyRate">Tasa Mensual (%)</Label>
                <Input
                  id="loanMonthlyRate"
                  type="number"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(e.target.value)}
                  placeholder="10"
                  step="0.5"
                  required
                />
              </div>
            )}
          </div>

          {loanType === 'amortized' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loanTna">TNA (%)</Label>
                <Input
                  id="loanTna"
                  type="number"
                  value={tna}
                  onChange={(e) => { setTna(e.target.value); setImpliedTna(null); setSuggestedTna(null); setCustomInstallment('') }}
                  placeholder="55"
                  step="0.5"
                  required
                />
                {suggestedTna !== null && impliedTna === null && parseFloat(tna) === suggestedTna && (
                  <p className="text-xs flex items-center gap-1 text-accent-positive">
                    <Zap className="h-3 w-3" />
                    Sugerida desde score ({fciRate}% + spread)
                  </p>
                )}
                {impliedTna !== null && (
                  <p className="text-xs flex items-center gap-1 text-accent-blue">
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
          )}

          {/* Interest-only preview */}
          {loanType === 'interest_only' && interestPreview !== null && interestPreview > 0 && (
            <div className="bg-blue-500/10 text-accent-blue rounded-lg px-3 py-2 text-sm">
              Cuota mensual de interés: <strong>{formatCurrency(interestPreview, currency)}</strong>
            </div>
          )}

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
            {createMutation.isPending ? 'Creando...' : 'Crear Préstamo'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
