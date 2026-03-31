'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Plus,
  ArrowLeft,
  Users,
  Trash2,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  Banknote,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Link2,
  Search,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const RELATIONSHIP_LABELS: Record<string, string> = {
  amigo: 'Amigo',
  amigo_de_amigo: 'Amigo de amigo',
  conocido: 'Conocido',
}

const INCOME_TYPE_LABELS: Record<string, string> = {
  en_blanco: 'En blanco',
  monotributo: 'Monotributo',
  informal: 'Informal',
}

function copyPersonShareLink(personId: string, toast: (opts: { description: string }) => void) {
  const url = `${window.location.origin}/share/${personId}`
  navigator.clipboard.writeText(url).then(() => {
    toast({ description: 'Link de estado de cuenta copiado' })
  })
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  bajo: { label: 'Riesgo Bajo', color: 'text-green-400 bg-green-500/10', icon: ShieldCheck },
  medio: { label: 'Riesgo Medio', color: 'text-yellow-400 bg-yellow-500/10', icon: Shield },
  alto: { label: 'Riesgo Alto', color: 'text-orange-400 bg-orange-500/10', icon: ShieldAlert },
  critico: { label: 'Riesgo Crítico', color: 'text-red-400 bg-red-500/10', icon: ShieldX },
}

export default function PersonsPage() {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [sheetPersonId, setSheetPersonId] = useState<string | null>(null)
  const searchParams = useSearchParams()

  // Open person sheet when navigated from another page (e.g., loan detail)
  useEffect(() => {
    const personId = searchParams.get('person')
    if (personId) setSheetPersonId(personId)
  }, [searchParams])

  // Full-page detail for deep drill-down
  if (selectedPersonId) {
    return <PersonDetail personId={selectedPersonId} onBack={() => setSelectedPersonId(null)} />
  }

  return (
    <div className="space-y-8">
      <PersonsHeader />
      <PersonsList onSelect={setSheetPersonId} />
      <Sheet open={!!sheetPersonId} onOpenChange={(open) => !open && setSheetPersonId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {sheetPersonId && (
            <PersonDrawerContent
              personId={sheetPersonId}
              onViewFull={() => {
                setSelectedPersonId(sheetPersonId)
                setSheetPersonId(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PersonsHeader() {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Personas</h1>
        <p className="text-muted-foreground mt-1">Gestiona tus deudores y su perfil de riesgo</p>
      </div>
      <PersonFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function PersonsList({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: persons, isLoading } = trpc.persons.list.useQuery()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const { toast } = useToast()


  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!persons || persons.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">Sin personas</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Crea tu primer deudor para asignar préstamos
          </p>
          <PersonFormDialog open={createOpen} onOpenChange={setCreateOpen} />
        </CardContent>
      </Card>
    )
  }

  const filtered = persons.filter((p) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.alias && p.alias.toLowerCase().includes(search.toLowerCase()))
    const matchesRisk = riskFilter === 'all' || p.category === riskFilter
    return matchesSearch && matchesRisk
  })

  return (
    <div className="space-y-4">
      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5 w-fit">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'bajo', label: 'Bajo' },
            { value: 'medio', label: 'Medio' },
            { value: 'alto', label: 'Alto' },
            { value: 'critico', label: 'Crítico' },
          ].map((opt) => (
            <button
              key={opt.value}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                riskFilter === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setRiskFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {filtered.map((person) => {
        const cat = CATEGORY_CONFIG[person.category]
        const Icon = cat.icon

        return (
          <Card
            key={person.id}
            className="cursor-pointer hover:border-primary/50 transition-all duration-200"
            onClick={() => onSelect(person.id)}
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    {person.name}
                    {person.alias && (
                      <span className="text-sm text-muted-foreground font-normal ml-2">({person.alias})</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {RELATIONSHIP_LABELS[person.relationship] || person.relationship}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {INCOME_TYPE_LABELS[person.incomeType] || person.incomeType}
                    </Badge>
                  </div>
                </div>
                <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold', cat.color)}>
                  {(() => {
                    const pct = (person.score / 12) * 100
                    const r = 14
                    const circ = 2 * Math.PI * r
                    const offset = circ - (pct / 100) * circ
                    const ringColor = person.score >= 9 ? '#22c55e' : person.score >= 6 ? '#eab308' : person.score >= 4 ? '#f97316' : '#ef4444'
                    return (
                      <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0">
                        <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeWidth="3" opacity="0.15" />
                        <circle cx="17" cy="17" r={r} fill="none" stroke={ringColor} strokeWidth="3" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 17 17)" />
                      </svg>
                    )
                  })()}
                  {person.score}<span className="text-xs font-normal opacity-70">/12</span>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {person.loanCount} préstamo{person.loanCount !== 1 ? 's' : ''} activo{person.loanCount !== 1 ? 's' : ''}
                </span>
                <span className="font-medium text-foreground">
                  {formatCurrency(person.totalCapital)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className={cn('flex items-center gap-2 text-xs px-3 py-2 rounded-lg flex-1', cat.color)}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{cat.label} · Spread ref.: {person.category === 'critico' ? 'BLOQUEADO' : `+${(person.minTnaSpread * 100).toFixed(0)}pp`}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); copyPersonShareLink(person.id, toast) }}
                  className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Copiar link de cobro"
                >
                  <Link2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        )
      })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No se encontraron personas con esos filtros.</p>
      )}
    </div>
  )
}

// ─── Person Drawer Content ──────────────────────────────────────────

function PersonDrawerContent({ personId, onViewFull }: { personId: string; onViewFull: () => void }) {
  const { data: person, isLoading } = trpc.persons.getById.useQuery({ id: personId })
  const { toast } = useToast()

  if (isLoading) {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (!person) {
    return <p className="text-muted-foreground pt-6">Persona no encontrada</p>
  }

  const cat = CATEGORY_CONFIG[person.category]
  const Icon = cat.icon
  const activeLoans = person.loans.filter((l) => l.status === 'active')
  const score = person.score
  const pct = (score / 12) * 100
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const ringColor = score >= 9 ? '#22c55e' : score >= 6 ? '#eab308' : score >= 4 ? '#f97316' : '#ef4444'

  return (
    <div className="space-y-5 pt-2">
      <SheetHeader>
        <SheetTitle className="text-xl">{person.name}</SheetTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {RELATIONSHIP_LABELS[person.relationship] || person.relationship}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {INCOME_TYPE_LABELS[person.incomeType] || person.incomeType}
          </Badge>
        </div>
      </SheetHeader>

      {/* Score ring */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
        <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
          <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="4" opacity="0.1" />
          <circle cx="34" cy="34" r={r} fill="none" stroke={ringColor} strokeWidth="4" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 34 34)" />
          <text x="34" y="34" textAnchor="middle" dominantBaseline="central" fill={ringColor} fontSize="16" fontWeight="bold">
            {score.toFixed(1)}
          </text>
        </svg>
        <div>
          <p className={cn('text-sm font-semibold', cat.color.split(' ')[0])}>{cat.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Spread ref.: {person.category === 'critico' ? 'BLOQUEADO' : `+${(person.minTnaSpread * 100).toFixed(0)}pp (informativo)`}
          </p>
          <p className="text-xs text-muted-foreground">
            Prob. default: {(person.defaultProbability * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Risk flags */}
      <div className="flex flex-wrap gap-1.5">
        {person.previousDebts && <Badge variant="destructive" className="text-[10px]">Deudas previas</Badge>}
        {person.recentJobChanges && <Badge variant="destructive" className="text-[10px]">Cambio laboral</Badge>}
        {person.hasChildren && person.livesAlone && <Badge variant="destructive" className="text-[10px]">Hijos + vive solo</Badge>}
        {!person.previousDebts && !person.recentJobChanges && (
          <Badge variant="secondary" className="text-[10px]">Sin flags de riesgo</Badge>
        )}
      </div>

      {/* Active loans */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Préstamos activos ({activeLoans.length})
        </p>
        {activeLoans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin préstamos activos</p>
        ) : (
          activeLoans.map((loan) => {
            const paid = loan.loanInstallments.filter((i) => i.isPaid).length
            const total = loan.loanInstallments.length
            const progress = total > 0 ? (paid / total) * 100 : 0
            return (
              <div key={loan.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{loan.borrowerName}</p>
                  <span className="text-sm font-semibold">{formatCurrency(Number(loan.capital), loan.currency)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{paid}/{total}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button className="w-full" onClick={() => copyPersonShareLink(personId, toast)}>
          <Link2 className="h-4 w-4 mr-2" />
          Copiar link de cobro
        </Button>
        <Button className="w-full" variant="outline" onClick={onViewFull}>
          Ver detalle completo
        </Button>
      </div>
    </div>
  )
}

// ─── Person Detail ──────────────────────────────────────────────────

function PersonDetail({ personId, onBack }: { personId: string; onBack: () => void }) {
  const utils = trpc.useUtils()
  const { data: person, isLoading } = trpc.persons.getById.useQuery({ id: personId })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const { toast } = useToast()

  const deleteMutation = trpc.persons.delete.useMutation({
    onSuccess: () => {
      utils.persons.list.invalidate()
      onBack()
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

  if (!person) {
    return <p className="text-muted-foreground">Persona no encontrada</p>
  }

  const cat = CATEGORY_CONFIG[person.category]
  const Icon = cat.icon
  const activeLoans = person.loans.filter((l) => l.status === 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{person.name}</h1>
              {person.alias && (
                <span className="text-lg text-muted-foreground">({person.alias})</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{RELATIONSHIP_LABELS[person.relationship]}</Badge>
              <Badge variant="outline">{INCOME_TYPE_LABELS[person.incomeType]}</Badge>
              {person.referrer && <Badge variant="outline">Ref: {person.referrer}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => copyPersonShareLink(personId, toast)}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-500 font-medium">Eliminar?</span>
              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate({ id: personId })} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Eliminando...' : 'Si'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>No</Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="text-muted-foreground hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {deleteMutation.error && (
        <div className="bg-red-500/10 text-red-400 rounded-lg px-3 py-2 text-sm">
          {deleteMutation.error.message}
        </div>
      )}

      {/* Score card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Score de Riesgo</p>
              <div className={cn('flex items-center gap-2 text-2xl font-bold', cat.color.split(' ')[0])}>
                <Icon className="h-7 w-7" />
                {person.score} / 12
              </div>
              <p className={cn('text-sm mt-1', cat.color.split(' ')[0])}>{cat.label}</p>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs text-muted-foreground">
                Spread ref.: <span className="font-semibold">{person.category === 'critico' ? 'BLOQUEADO' : `+${(person.minTnaSpread * 100).toFixed(0)}pp`}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Prob. default: <span className="font-semibold">{(person.defaultProbability * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score breakdown */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <ScoreCard label="Puntualidad" value={person.punctualityScore} />
        <ScoreCard label="Comunicación" value={person.communicationScore} />
        <ScoreCard label="Actitud deuda" value={person.debtAttitudeScore} />
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Antigüedad</p>
            <p className="text-xl font-bold mt-1">{person.tenureMonths ?? '-'}m</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Ingreso est.</p>
            <p className="text-xl font-bold mt-1">
              {person.estimatedIncome ? formatCurrency(Number(person.estimatedIncome)) : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk flags */}
      <div className="flex flex-wrap gap-2">
        {person.previousDebts && <Badge variant="destructive">Deudas previas</Badge>}
        {person.recentJobChanges && <Badge variant="destructive">Cambio laboral reciente</Badge>}
        {person.hasChildren && person.livesAlone && <Badge variant="destructive">Hijos + vive solo</Badge>}
        {!person.previousDebts && !person.recentJobChanges && (
          <Badge variant="secondary">Sin flags de riesgo</Badge>
        )}
      </div>

      {/* Loans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Prestamos asignados ({activeLoans.length} activos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {person.loans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin préstamos asignados</p>
          ) : (
            <div className="space-y-2">
              {person.loans.map((loan) => {
                const paid = loan.loanInstallments.filter((i) => i.isPaid).length
                const total = loan.loanInstallments.length
                return (
                  <div key={loan.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{loan.borrowerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(Number(loan.capital), loan.currency)} · {paid}/{total} cuotas
                      </p>
                    </div>
                    <Badge variant={loan.status === 'active' ? 'default' : loan.status === 'completed' ? 'secondary' : 'destructive'}>
                      {loan.status === 'active' ? 'Activo' : loan.status === 'completed' ? 'Completado' : 'Moroso'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History Timeline */}
      <PaymentHistory loans={person.loans} />

      <PersonFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editPerson={person}
      />
    </div>
  )
}

// ─── Payment History Timeline ───────────────────────────────────────

function PaymentHistory({ loans }: { loans: any[] }) {
  // Flatten all installments across loans with loan context
  const allInstallments = loans.flatMap((loan) =>
    loan.loanInstallments.map((inst: any) => ({
      ...inst,
      amount: Number(inst.amount),
      dueDate: new Date(inst.dueDate),
      paidAt: inst.paidAt ? new Date(inst.paidAt) : null,
      loanName: loan.borrowerName,
      currency: loan.currency,
      loanId: loan.id,
    }))
  )

  if (allInstallments.length === 0) return null

  // Sort by dueDate descending (most recent first)
  const sorted = [...allInstallments].sort(
    (a, b) => b.dueDate.getTime() - a.dueDate.getTime()
  )

  const now = new Date()

  // Stats
  const paid = sorted.filter((i) => i.isPaid)
  const totalPaid = paid.length
  const onTime = paid.filter((i) => {
    if (!i.paidAt) return true
    return differenceInDays(i.paidAt, i.dueDate) <= 0
  }).length
  const late = paid.filter((i) => {
    if (!i.paidAt) return false
    return differenceInDays(i.paidAt, i.dueDate) > 0
  }).length
  const overdue = sorted.filter((i) => !i.isPaid && i.dueDate < now).length
  const punctualityRate = totalPaid > 0 ? Math.round((onTime / totalPaid) * 100) : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historial de Pagos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pagadas</p>
            <p className="text-lg font-bold text-foreground">{totalPaid}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">A tiempo</p>
            <p className="text-lg font-bold text-green-400">{onTime}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Con demora</p>
            <p className="text-lg font-bold text-amber-400">{late}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencidas</p>
            <p className="text-lg font-bold text-red-400">{overdue}</p>
          </div>
        </div>

        {/* Punctuality indicator */}
        {punctualityRate !== null && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
            punctualityRate >= 80
              ? 'bg-green-500/10 text-green-400'
              : punctualityRate >= 50
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-red-500/10 text-red-400'
          )}>
            {punctualityRate >= 80 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>Puntualidad real: <strong>{punctualityRate}%</strong> ({onTime}/{totalPaid} a tiempo)</span>
          </div>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {sorted.slice(0, 20).map((inst) => {
              const isOverdue = !inst.isPaid && inst.dueDate < now
              const isPaid = inst.isPaid
              const isPending = !inst.isPaid && !isOverdue
              const daysLate = isPaid && inst.paidAt
                ? differenceInDays(inst.paidAt, inst.dueDate)
                : isOverdue
                  ? differenceInDays(now, inst.dueDate)
                  : 0

              return (
                <div key={inst.id} className="relative flex items-start gap-3 py-2.5 pl-0">
                  {/* Dot */}
                  <div className={cn(
                    'relative z-10 flex items-center justify-center w-[31px] h-[31px] shrink-0',
                  )}>
                    {isPaid ? (
                      <CheckCircle2 className={cn(
                        'h-5 w-5',
                        daysLate > 0
                          ? 'text-amber-500'
                          : 'text-green-500'
                      )} />
                    ) : isOverdue ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        isOverdue ? 'text-red-400' : 'text-foreground'
                      )}>
                        Cuota {inst.number} · {inst.loanName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {format(inst.dueDate, "d MMM yyyy", { locale: es })}
                        {isPaid && inst.paidAt && (
                          <span className={cn(
                            'ml-1',
                            daysLate > 0 ? 'text-amber-400' : 'text-green-400'
                          )}>
                            · Pagada {format(inst.paidAt, "d MMM", { locale: es })}
                            {daysLate > 0 && ` (+${daysLate}d)`}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-red-500 ml-1 font-medium">
                            · {daysLate}d vencida
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={cn(
                      'text-sm font-semibold shrink-0',
                      isPaid ? 'text-foreground' : isOverdue ? 'text-red-400' : 'text-muted-foreground'
                    )}>
                      {formatCurrency(inst.amount, inst.currency)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {sorted.length > 20 && (
            <p className="text-xs text-muted-foreground text-center mt-2 pl-10">
              +{sorted.length - 20} cuotas más
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 4 ? 'text-green-400' : value >= 3 ? 'text-yellow-400' : 'text-red-400'
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn('text-xl font-bold mt-1', color)}>{value}/5</p>
      </CardContent>
    </Card>
  )
}

// ─── Person Form Dialog ─────────────────────────────────────────────

function PersonFormDialog({
  open,
  onOpenChange,
  editPerson,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editPerson?: any
}) {
  const utils = trpc.useUtils()
  const isEdit = !!editPerson

  const [name, setName] = useState(editPerson?.name || '')
  const [alias, setAlias] = useState(editPerson?.alias || '')
  const [relationship, setRelationship] = useState(editPerson?.relationship || 'conocido')
  const [referrer, setReferrer] = useState(editPerson?.referrer || '')
  const [incomeType, setIncomeType] = useState(editPerson?.incomeType || 'informal')
  const [sector, setSector] = useState(editPerson?.sector || '')
  const [tenureMonths, setTenureMonths] = useState(editPerson?.tenureMonths?.toString() || '')
  const [estimatedIncome, setEstimatedIncome] = useState(editPerson?.estimatedIncome ? Number(editPerson.estimatedIncome).toString() : '')
  const [livesAlone, setLivesAlone] = useState(editPerson?.livesAlone || false)
  const [hasChildren, setHasChildren] = useState(editPerson?.hasChildren || false)
  const [recentJobChanges, setRecentJobChanges] = useState(editPerson?.recentJobChanges || false)
  const [previousDebts, setPreviousDebts] = useState(editPerson?.previousDebts || false)
  const [punctualityScore, setPunctualityScore] = useState(editPerson?.punctualityScore?.toString() || '3')
  const [communicationScore, setCommunicationScore] = useState(editPerson?.communicationScore?.toString() || '3')
  const [debtAttitudeScore, setDebtAttitudeScore] = useState(editPerson?.debtAttitudeScore?.toString() || '3')

  const createMutation = trpc.persons.create.useMutation({
    onSuccess: () => {
      utils.persons.list.invalidate()
      onOpenChange(false)
      resetForm()
    },
  })

  const updateMutation = trpc.persons.update.useMutation({
    onSuccess: () => {
      utils.persons.list.invalidate()
      utils.persons.getById.invalidate({ id: editPerson?.id })
      onOpenChange(false)
    },
  })

  function resetForm() {
    setName(''); setAlias(''); setRelationship('conocido'); setReferrer('')
    setIncomeType('informal'); setSector(''); setTenureMonths(''); setEstimatedIncome('')
    setLivesAlone(false); setHasChildren(false); setRecentJobChanges(false); setPreviousDebts(false)
    setPunctualityScore('3'); setCommunicationScore('3'); setDebtAttitudeScore('3')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      name,
      alias: alias || undefined,
      relationship: relationship as 'amigo' | 'amigo_de_amigo' | 'conocido',
      referrer: referrer || undefined,
      incomeType: incomeType as 'en_blanco' | 'monotributo' | 'informal',
      sector: sector || undefined,
      tenureMonths: tenureMonths ? parseInt(tenureMonths) : undefined,
      estimatedIncome: estimatedIncome ? parseFloat(estimatedIncome) : undefined,
      livesAlone,
      hasChildren,
      recentJobChanges,
      previousDebts,
      punctualityScore: parseInt(punctualityScore),
      communicationScore: parseInt(communicationScore),
      debtAttitudeScore: parseInt(debtAttitudeScore),
    }

    if (isEdit) {
      updateMutation.mutate({ id: editPerson.id, ...data })
    } else {
      createMutation.mutate(data)
    }
  }

  const mutation = isEdit ? updateMutation : createMutation

  const dialogContent = (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Editar Persona' : 'Nueva Persona'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identificación */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificación</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="personName">Nombre *</Label>
              <Input id="personName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Perez" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personAlias">Alias</Label>
              <Input id="personAlias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Juancho" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Relación</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amigo">Amigo</SelectItem>
                  <SelectItem value="amigo_de_amigo">Amigo de amigo</SelectItem>
                  <SelectItem value="conocido">Conocido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personReferrer">Quien lo refiere</Label>
              <Input id="personReferrer" value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="Nombre" />
            </div>
          </div>
        </div>

        {/* Perfil económico */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfil económico</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de ingreso</Label>
              <Select value={incomeType} onValueChange={setIncomeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_blanco">En blanco</SelectItem>
                  <SelectItem value="monotributo">Monotributo</SelectItem>
                  <SelectItem value="informal">Informal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personSector">Sector</Label>
              <Input id="personSector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Tecnologia, comercio..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="personTenure">Antigüedad (meses)</Label>
              <Input id="personTenure" type="number" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} placeholder="24" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personIncome">Ingreso estimado</Label>
              <Input id="personIncome" type="number" value={estimatedIncome} onChange={(e) => setEstimatedIncome(e.target.value)} placeholder="500000" min="0" />
            </div>
          </div>
        </div>

        {/* Estabilidad */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estabilidad</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <Label>Vive solo</Label>
              <Switch checked={livesAlone} onCheckedChange={setLivesAlone} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Tiene hijos</Label>
              <Switch checked={hasChildren} onCheckedChange={setHasChildren} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Cambio laboral reciente</Label>
              <Switch checked={recentJobChanges} onCheckedChange={setRecentJobChanges} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Deudas previas</Label>
              <Switch checked={previousDebts} onCheckedChange={setPreviousDebts} />
            </div>
          </div>
        </div>

        {/* Comportamiento */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comportamiento (1-5)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Puntualidad</Label>
              <Select value={punctualityScore} onValueChange={setPunctualityScore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((v) => <SelectItem key={v} value={v.toString()}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Comunicación</Label>
              <Select value={communicationScore} onValueChange={setCommunicationScore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((v) => <SelectItem key={v} value={v.toString()}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Actitud deuda</Label>
              <Select value={debtAttitudeScore} onValueChange={setDebtAttitudeScore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((v) => <SelectItem key={v} value={v.toString()}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {mutation.error && (
          <p className="text-sm text-red-500">{mutation.error.message}</p>
        )}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? (isEdit ? 'Guardando...' : 'Creando...') : (isEdit ? 'Guardar Cambios' : 'Crear Persona')}
        </Button>
      </form>
    </DialogContent>
  )

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {dialogContent}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Persona
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  )
}
