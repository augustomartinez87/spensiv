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

function loanRateInfo(loan: { rateIsNominal: boolean | null; tna: any; monthlyRate: any }) {
  const tem = Number(loan.monthlyRate)
  const tea = Math.pow(1 + tem, 12) - 1
  const tna = loan.rateIsNominal ? Number(loan.tna) : tem * 12
  return { tem, tea, tna, isLegacy: !loan.rateIsNominal }
}

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

// ─── Loan List Header ────────────────────────────────────────────────

function LoanListHeader({ view, onViewChange, direction }: { view: 'list' | 'calendar'; onViewChange: (v: 'list' | 'calendar') => void; direction: 'lender' | 'borrower' }) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {direction === 'lender' ? 'Préstamos' : 'Mis Deudas'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {direction === 'lender' ? 'Gestioná tus préstamos personales' : 'Controlá lo que debés'}
        </p>
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
        <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
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

// ─── Debts Dashboard Summary ─────────────────────────────────────────

function DebtsDashboardSummary() {
  const { data: metrics, isLoading } = trpc.loans.getDashboardMetricsDebtor.useQuery()

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  if (!metrics || metrics.activeDebtsCount === 0) return null

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deuda total</p>
          <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(metrics.totalDebt)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{metrics.activeDebtsCount} deuda{metrics.activeDebtsCount !== 1 ? 's' : ''}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendiente pago</p>
          <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(metrics.totalPending)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Próxima cuota</p>
          {metrics.nextInstallment ? (
            <>
              <p className="text-xl font-bold text-accent-blue mt-1">
                {formatCurrency(metrics.nextInstallment.amountArs)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(metrics.nextInstallment.dueDate), "d 'de' MMM", { locale: es })}
              </p>
            </>
          ) : (
            <p className="text-xl font-bold text-muted-foreground mt-1">-</p>
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
            <p className="text-xs text-accent-danger mt-0.5">{metrics.overdueCount} cuota{metrics.overdueCount !== 1 ? 's' : ''} sin pagar</p>
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

function LoanListContent({ onSelect, direction }: { onSelect: (id: string) => void; direction: 'lender' | 'borrower' }) {
  const utils = trpc.useUtils()
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'refinanced'>('active')
  const { data: loans, isLoading } = trpc.loans.list.useQuery({ direction, status: statusFilter })
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
    const emptyLabel =
      statusFilter === 'completed' ? 'Sin préstamos finalizados' :
      statusFilter === 'refinanced' ? 'Sin préstamos refinanciados' :
      direction === 'lender' ? 'Sin préstamos' : 'Sin deudas'
    const emptySubLabel =
      statusFilter !== 'active' ? null :
      direction === 'lender' ? 'Creá tu primer préstamo o usa el simulador' : 'Registrá una deuda que tengas con alguien'

    return (
      <div className="space-y-4">
        {/* Status filter toggle — shown even when empty */}
        <div className="flex bg-muted rounded-lg p-0.5 w-fit">
          {(['active', 'completed', 'refinanced'] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'active' ? 'Activos' : s === 'completed' ? 'Finalizados' : 'Refinanciados'}
            </Button>
          ))}
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">{emptyLabel}</p>
            {emptySubLabel && (
              <p className="text-sm text-muted-foreground mt-1 mb-4">{emptySubLabel}</p>
            )}
            {statusFilter === 'active' && (
              <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const preApproved = loans.filter((l) => l.status === 'pre_approved')
  const otherLoans = loans.filter((l) => l.status !== 'pre_approved')

  return (
    <div className="space-y-6">
      {/* Status filter toggle + create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex bg-muted rounded-lg p-0.5 w-fit">
          {(['active', 'completed', 'refinanced'] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'active' ? 'Activos' : s === 'completed' ? 'Finalizados' : 'Refinanciados'}
            </Button>
          ))}
        </div>
        <CreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} direction={direction} />
      </div>

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
                        loan.status === 'completed' ? 'secondary' :
                          loan.status === 'refinanced' ? 'secondary' : 'destructive'
                    }
                    className="shrink-0"
                  >
                    {loan.status === 'active' ? 'Activo' :
                      loan.status === 'completed' ? 'Completado' :
                        loan.status === 'refinanced' ? 'Refinanciado' : 'Moroso'}
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

                {(() => {
                  const ri = loanRateInfo(loan)
                  return (
                    <div className="flex justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
                      <span>
                        {isInterestOnly
                          ? isZeroRate ? 'Sin intereses' : `${(ri.tem * 100).toFixed(2)}% TEM`
                          : `Cuota: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                        }
                      </span>
                      <span>
                        {isZeroRate
                          ? 'TNA: 0%'
                          : `TNA ${(ri.tna * 100).toFixed(1)}% · TEA ${(ri.tea * 100).toFixed(1)}%`
                        }
                      </span>
                    </div>
                  )
                })()}
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

        {(() => {
          const ri = loanRateInfo(loan)
          return (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {isInterestOnly
                  ? `${(ri.tem * 100).toFixed(2)}% TEM`
                  : `Cuota: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                }
              </span>
              <span>TNA {(ri.tna * 100).toFixed(1)}% · TEA {(ri.tea * 100).toFixed(1)}%</span>
            </div>
          )
        })()}

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
                  <td className={cn("py-2.5 px-3 text-right", Number(a.deviationAmount) < 0 ? "text-red-400" : "text-foreground")}>
                    {formatCurrency(Number(a.deviationAmount), cur)}
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
  direction = 'lender',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues?: {
    capital?: string
    tna?: string
    termMonths?: string
    startDate?: string
  }
  direction?: 'lender' | 'borrower'
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
  const [creditorName, setCreditorName] = useState('')
  const [fciRate, setFciRate] = useState('40')
  const [suggestedTna, setSuggestedTna] = useState<number | null>(null)
  const [smartDueDate, setSmartDueDate] = useState(true)

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
      utils.loans.getDashboardMetricsDebtor.invalidate()
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
      setCreditorName('')
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
        direction,
        creditorName: direction === 'borrower' ? creditorName || undefined : undefined,
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
        direction,
        creditorName: direction === 'borrower' ? creditorName || undefined : undefined,
        smartDueDate,
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
          <DialogTitle>{direction === 'lender' ? 'Crear Préstamo' : 'Registrar Deuda'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="borrowerName">
              {direction === 'lender' ? 'Nombre del Deudor' : 'Descripción'}
            </Label>
            <Input
              id="borrowerName"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder={direction === 'lender' ? 'Ej: Juan Perez' : 'Ej: Tarjeta Visa - Cuotas celular'}
              required
            />
          </div>

          {direction === 'borrower' && (
            <div className="space-y-2">
              <Label htmlFor="creditorName">Acreedor</Label>
              <Input
                id="creditorName"
                value={creditorName}
                onChange={(e) => setCreditorName(e.target.value)}
                placeholder="Ej: Banco Galicia, Mercado Crédito"
              />
            </div>
          )}

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
                {monthlyRate && parseFloat(monthlyRate) > 0 && (() => {
                  const tem = parseFloat(monthlyRate) / 100
                  const tea = (Math.pow(1 + tem, 12) - 1) * 100
                  const tna = tem * 12 * 100
                  return (
                    <p className="text-xs text-muted-foreground">
                      TNA {tna.toFixed(1)}% · TEA {tea.toFixed(2)}%
                    </p>
                  )
                })()}
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
                {tna && parseFloat(tna) > 0 && (() => {
                  const tem = tnaToMonthlyRate(parseFloat(tna) / 100)
                  const tea = (Math.pow(1 + tem, 12) - 1) * 100
                  return (
                    <p className="text-xs text-muted-foreground">
                      TEA equivalente: <strong className="text-foreground">{tea.toFixed(2)}%</strong>
                    </p>
                  )
                })()}
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
                {impliedTna !== null && (
                  <p className="text-xs flex items-center gap-1 text-accent-positive">
                    <Zap className="h-3 w-3" />
                    → TNA resultante: {(impliedTna * 100).toFixed(2)}%
                  </p>
                )}
                {!reverseMutation.isPending && impliedTna === null && customInstallment !== '' &&
                  parseFloat(customInstallment) > 0 && parseFloat(capital) > 0 && parseInt(termMonths) > 0 &&
                  parseFloat(customInstallment) <= parseFloat(capital) / parseInt(termMonths) && (
                  <p className="text-xs text-red-500">Cuota insuficiente para amortizar</p>
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

          {/* Smart due date toggle — solo aplica a préstamos amortizados */}
          {loanType === 'amortized' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  id="modal-smart-due-date"
                  checked={smartDueDate}
                  onCheckedChange={setSmartDueDate}
                />
                <Label htmlFor="modal-smart-due-date" className="text-sm cursor-pointer">
                  Primer vencimiento inteligente
                </Label>
              </div>
              {smartDueDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 pl-0.5">
                  <Info className="h-3 w-3 shrink-0" />
                  Las cuotas vencen el 2° día hábil de cada mes
                </p>
              )}
            </div>
          )}

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
