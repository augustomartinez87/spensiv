'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronUp, CalendarClock, AlertCircle, Sparkles } from 'lucide-react'

/* ─── Color Theme ──────────────────────────────────────────────────────────── */

const THEME = {
  from: '#38bdf8',
  to: '#818cf8',
  accent: 'bg-sky-500/15 border-sky-500/25',
  text: 'text-sky-400',
  glow: 'shadow-sky-500/20',
}

// Keep array structure for the colorIndex API but use same theme for all
const LOAN_COLORS = [THEME]

/* ─── Progress Ring ────────────────────────────────────────────────────────── */

function ProgressRing({
  paid,
  total,
  size = 120,
  strokeWidth = 8,
  colorIndex = 0,
}: {
  paid: number
  total: number
  size?: number
  strokeWidth?: number
  colorIndex?: number
}) {
  const colors = LOAN_COLORS[colorIndex % LOAN_COLORS.length]
  const isNearComplete = total > 0 && paid / total >= 0.8
  const from = isNearComplete ? '#4ade80' : colors.from
  const to = isNearComplete ? '#22c55e' : colors.to
  const gradientId = `progressGradient-${colorIndex}`
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? paid / total : 0
  const offset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/[0.06]"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            stroke: `url(#${gradientId})`,
            filter: paid > 0 ? `drop-shadow(0 0 6px ${from}40)` : undefined,
          }}
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text — absolutely positioned over the ring */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-2xl font-bold text-foreground">{paid}/{total}</span>
        <span className="text-[10px] text-muted-foreground">pagadas</span>
      </div>
    </div>
  )
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

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
            <p className="text-muted-foreground">Sin préstamos activos 🎉</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.loans.map((loan, idx) => (
            <LoanCard key={loan.id} loan={loan} now={now} colorIndex={idx} />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-8">Spensiv</p>
    </Shell>
  )
}

/* ─── Loan Card ────────────────────────────────────────────────────────────── */

function LoanCard({ loan, now, colorIndex = 0 }: { loan: any; now: Date; colorIndex?: number }) {
  const isInterestOnly = loan.loanType === 'interest_only'

  if (isInterestOnly) {
    return <InterestOnlyCard loan={loan} now={now} colorIndex={colorIndex} />
  }

  return <AmortizedCard loan={loan} now={now} colorIndex={colorIndex} />
}

/* ─── Interest-Only Card ───────────────────────────────────────────────────── */

function InterestOnlyCard({ loan, now, colorIndex = 0 }: { loan: any; now: Date; colorIndex?: number }) {
  const [showPaid, setShowPaid] = useState(false)
  const colors = LOAN_COLORS[colorIndex % LOAN_COLORS.length]

  const isZeroRate = (loan.monthlyRate ?? 0) === 0
  const monthlyInterest = loan.capital * (loan.monthlyRate ?? 0)
  const paidInstallments = loan.installments.filter((i: any) => i.isPaid)
  const unpaidInstallments = loan.installments.filter((i: any) => !i.isPaid)

  const nextInst = unpaidInstallments.find(
    (i: any) => new Date(i.dueDate) >= now,
  ) ?? unpaidInstallments[0]

  const overdueInstallments = unpaidInstallments.filter(
    (i: any) => new Date(i.dueDate) < now,
  )

  const loanLabel = loan.borrowerName

  return (
    <Card className="overflow-hidden relative">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${colors.from}, ${colors.to})` }}
      />
      <CardContent className="pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{loanLabel}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isZeroRate ? 'Préstamo sin intereses' : 'Pago de intereses mensuales'}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">{loan.currency}</Badge>
        </div>

        {/* === Zero-rate: simple capital view === */}
        {isZeroRate ? (
          <>
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Capital pendiente</p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(loan.capital, loan.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Sin intereses · devolvés solo el capital
              </p>
            </div>

            <div className={cn('rounded-lg border p-3 text-center', colors.accent)}>
              <p className="text-sm text-foreground">
                ✨ Sin cuotas mensuales — arreglás la devolución directamente
              </p>
            </div>
          </>
        ) : (
          <>

            {/* Monthly interest payment — hero */}
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Interés mensual</p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(monthlyInterest, loan.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                sobre capital de {formatCurrency(loan.capital, loan.currency)}
              </p>
            </div>

            {/* Overdue alert */}
            {overdueInstallments.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-sm text-amber-300">
                  {overdueInstallments.length === 1
                    ? 'Tenés 1 pago de interés vencido'
                    : `Tenés ${overdueInstallments.length} pagos de interés vencidos`}
                </span>
              </div>
            )}

            {/* Next interest payment */}
            {nextInst && (
              <div className={cn('rounded-lg border p-3', colors.accent)}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Próximo pago de interés
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">
                    {format(new Date(nextInst.dueDate), "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(monthlyInterest, loan.currency)}
                  </span>
                </div>
              </div>
            )}

            {/* Pending interest payments */}
            {unpaidInstallments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-2">
                  {unpaidInstallments.length === 1
                    ? '1 pago pendiente'
                    : `${unpaidInstallments.length} pagos pendientes`}
                </p>
                {unpaidInstallments.map((inst: any) => {
                  const due = new Date(inst.dueDate)
                  const isOverdue = due < now
                  const isNext = nextInst?.id === inst.id

                  return (
                    <div
                      key={inst.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                        isNext && 'bg-primary/10 border border-primary/20',
                        isOverdue && !isNext && 'bg-amber-500/[0.07]',
                      )}
                    >
                      <span className="text-muted-foreground w-7 shrink-0 text-xs">#{inst.number}</span>
                      <span className={cn(
                        'flex-1',
                        isOverdue ? 'text-amber-300' : 'text-foreground',
                      )}>
                        {format(due, "d MMM yyyy", { locale: es })}
                      </span>
                      <span className={cn(
                        'font-medium shrink-0',
                        isOverdue ? 'text-amber-300' : 'text-foreground',
                      )}>
                        {formatCurrency(monthlyInterest, loan.currency)}
                      </span>
                      {isOverdue && (
                        <Badge className="text-[10px] shrink-0 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border-0">
                          Vencido
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Paid interest payments - collapsible */}
            {paidInstallments.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPaid(!showPaid)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {showPaid ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showPaid ? 'Ocultar' : 'Ver'} pagos realizados ({paidInstallments.length})
                </button>
                {showPaid && (
                  <div className="space-y-1 mt-2">
                    {paidInstallments.map((inst: any) => (
                      <div
                        key={inst.id}
                        className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm opacity-50"
                      >
                        <span className="text-muted-foreground w-7 shrink-0 text-xs">#{inst.number}</span>
                        <span className="flex-1 text-muted-foreground">
                          {format(new Date(inst.dueDate), "d MMM yyyy", { locale: es })}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {formatCurrency(monthlyInterest, loan.currency)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">✓</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All paid celebration */}
            {unpaidInstallments.length === 0 && paidInstallments.length > 0 && (
              <div className="text-center py-4">
                <p className="text-lg">🎉</p>
                <p className="text-sm text-green-400 font-medium">¡Todo al día!</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Amortized Card (original) ────────────────────────────────────────────── */

function AmortizedCard({ loan, now, colorIndex = 0 }: { loan: any; now: Date; colorIndex?: number }) {
  const [showPaid, setShowPaid] = useState(false)
  const colors = LOAN_COLORS[colorIndex % LOAN_COLORS.length]

  const paidInstallments = loan.installments.filter((i: any) => i.isPaid)
  const unpaidInstallments = loan.installments.filter((i: any) => !i.isPaid)
  const paidCount = paidInstallments.length
  const totalCount = loan.installments.length

  // Find the next upcoming installment
  const nextInst = unpaidInstallments.find(
    (i: any) => new Date(i.dueDate) >= now,
  ) ?? unpaidInstallments[0]

  // Overdue installments (unpaid and dueDate before now)
  const overdueInstallments = unpaidInstallments.filter(
    (i: any) => new Date(i.dueDate) < now,
  )

  // Friendly loan label — strip borrower name if it matches the person name
  const loanLabel = loan.borrowerName

  return (
    <Card className="overflow-hidden relative">
      {/* Top color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${colors.from}, ${colors.to})` }}
      />
      <CardContent className="pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{loanLabel}</h2>
          <Badge variant="outline" className="text-xs">{loan.currency}</Badge>
        </div>

        {/* Progress ring */}
        <div className="flex justify-center relative">
          <ProgressRing paid={paidCount} total={totalCount} colorIndex={colorIndex} />
        </div>

        {/* Overdue alert */}
        {overdueInstallments.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-sm text-amber-300">
              {overdueInstallments.length === 1
                ? 'Tenés 1 cuota vencida'
                : `Tenés ${overdueInstallments.length} cuotas vencidas`}
            </span>
          </div>
        )}

        {/* Next installment highlight */}
        {nextInst && (
          <div className={cn('rounded-lg border p-3', colors.accent)}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Próximo vencimiento
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {format(new Date(nextInst.dueDate), "d 'de' MMMM yyyy", { locale: es })}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {(() => {
                  const paid = nextInst.paidAmount ?? 0
                  const remaining = Math.max(nextInst.amount - paid, 0)
                  return formatCurrency(remaining, loan.currency)
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Remaining installments */}
        {unpaidInstallments.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              {unpaidInstallments.length === 1
                ? 'Cuota restante'
                : `${unpaidInstallments.length} cuotas restantes`}
            </p>
            {unpaidInstallments.map((inst: any) => {
              const due = new Date(inst.dueDate)
              const isOverdue = due < now
              const isNext = nextInst?.id === inst.id
              const paidAmt = inst.paidAmount ?? 0
              const remaining = Math.max(inst.amount - paidAmt, 0)
              const isPartial = paidAmt > 0

              return (
                <div
                  key={inst.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                    isNext && 'bg-primary/10 border border-primary/20',
                    isOverdue && !isNext && 'bg-amber-500/[0.07]',
                  )}
                >
                  <span className="text-muted-foreground w-7 shrink-0 text-xs">#{inst.number}</span>
                  <span className={cn(
                    'flex-1',
                    isOverdue ? 'text-amber-300' : 'text-foreground',
                  )}>
                    {format(due, "d MMM yyyy", { locale: es })}
                  </span>
                  <span className={cn(
                    'font-medium shrink-0',
                    isOverdue ? 'text-amber-300' : 'text-foreground',
                  )}>
                    {formatCurrency(remaining, loan.currency)}
                  </span>
                  {isOverdue && (
                    <Badge className="text-[10px] shrink-0 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border-0">
                      Vencida
                    </Badge>
                  )}
                  {isPartial && !isOverdue && (
                    <Badge className="text-[10px] shrink-0 bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border-0">
                      Parcial
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Collapsible paid installments */}
        {paidCount > 0 && (
          <div>
            <button
              onClick={() => setShowPaid(!showPaid)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showPaid ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showPaid ? 'Ocultar' : 'Ver'} cuotas pagadas ({paidCount})
            </button>
            {showPaid && (
              <div className="space-y-1 mt-2">
                {paidInstallments.map((inst: any) => (
                  <div
                    key={inst.id}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm opacity-50"
                  >
                    <span className="text-muted-foreground w-7 shrink-0 text-xs">#{inst.number}</span>
                    <span className="flex-1 text-muted-foreground">
                      {format(new Date(inst.dueDate), "d MMM yyyy", { locale: es })}
                    </span>
                    <span className="text-muted-foreground line-through shrink-0">
                      {formatCurrency(inst.amount, loan.currency)}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">✓</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All paid celebration */}
        {unpaidInstallments.length === 0 && paidCount > 0 && (
          <div className="text-center py-4">
            <p className="text-lg">🎉</p>
            <p className="text-sm text-green-400 font-medium">¡Todo al día!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Shell ─────────────────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {children}
      </div>
    </div>
  )
}
