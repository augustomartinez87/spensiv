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
} from 'lucide-react'

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

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  bajo: { label: 'Riesgo Bajo', color: 'text-green-600 dark:text-green-400 bg-green-500/10', icon: ShieldCheck },
  medio: { label: 'Riesgo Medio', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10', icon: Shield },
  alto: { label: 'Riesgo Alto', color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10', icon: ShieldAlert },
  critico: { label: 'Riesgo Critico', color: 'text-red-600 dark:text-red-400 bg-red-500/10', icon: ShieldX },
}

export default function PersonsPage() {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  if (selectedPersonId) {
    return <PersonDetail personId={selectedPersonId} onBack={() => setSelectedPersonId(null)} />
  }

  return (
    <div className="space-y-8">
      <PersonsHeader />
      <PersonsList onSelect={setSelectedPersonId} />
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
            Crea tu primer deudor para asignar prestamos
          </p>
          <PersonFormDialog open={createOpen} onOpenChange={setCreateOpen} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {persons.map((person) => {
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
                  <Icon className="h-4 w-4" />
                  {person.score}
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {person.loanCount} prestamo{person.loanCount !== 1 ? 's' : ''} activo{person.loanCount !== 1 ? 's' : ''}
                </span>
                <span className="font-medium text-foreground">
                  {formatCurrency(person.totalCapital)}
                </span>
              </div>

              <div className={cn('flex items-center gap-2 text-xs px-3 py-2 rounded-lg', cat.color)}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{cat.label} · Spread minimo: {person.category === 'critico' ? 'BLOQUEADO' : `+${(person.minTnaSpread * 100).toFixed(0)}pp`}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Person Detail ──────────────────────────────────────────────────

function PersonDetail({ personId, onBack }: { personId: string; onBack: () => void }) {
  const utils = trpc.useUtils()
  const { data: person, isLoading } = trpc.persons.getById.useQuery({ id: personId })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

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
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg px-3 py-2 text-sm">
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
                Spread minimo: <span className="font-semibold">{person.category === 'critico' ? 'BLOQUEADO' : `+${(person.minTnaSpread * 100).toFixed(0)}pp`}</span>
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
        <ScoreCard label="Comunicacion" value={person.communicationScore} />
        <ScoreCard label="Actitud deuda" value={person.debtAttitudeScore} />
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Antiguedad</p>
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
            <p className="text-sm text-muted-foreground py-4 text-center">Sin prestamos asignados</p>
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
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{onTime}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Con demora</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{late}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencidas</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{overdue}</p>
          </div>
        </div>

        {/* Punctuality indicator */}
        {punctualityRate !== null && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
            punctualityRate >= 80
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : punctualityRate >= 50
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
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
                        isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                      )}>
                        Cuota {inst.number} · {inst.loanName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {format(inst.dueDate, "d MMM yyyy", { locale: es })}
                        {isPaid && inst.paidAt && (
                          <span className={cn(
                            'ml-1',
                            daysLate > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
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
                      isPaid ? 'text-foreground' : isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
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
              +{sorted.length - 20} cuotas mas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 4 ? 'text-green-600 dark:text-green-400' : value >= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificacion</p>
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
              <Label>Relacion</Label>
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfil economico</p>
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
              <Label htmlFor="personTenure">Antiguedad (meses)</Label>
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
              <Label>Comunicacion</Label>
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
