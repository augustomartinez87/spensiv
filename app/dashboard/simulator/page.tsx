'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, formatDateToInput, cn, pluralize } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import {
  Calculator,
  TrendingUp,
  ArrowRightLeft,
  Info,
  Zap,
  Banknote,
  X,
  Share2,
  BarChart3,
  Copy,
  Check,
  ArrowRight,
  Download,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { Shield } from 'lucide-react'
import type { SimulationResult } from '@/lib/loan-calculator'
import { getNextMonths } from '@/lib/periods'

function formatFirstDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const AccrualChart = dynamic(
  () => import('@/components/simulator/accrual-chart').then(m => m.AccrualChart),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse bg-muted rounded-lg" /> }
)

type ViewMode = 'single' | 'compare'

export default function SimulatorPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('compare')
  const [activeTab, setActiveTab] = useState('results')
  const [resultsView, setResultsView] = useState<'analysis' | 'share'>('analysis')
  const resultsRef = useRef<HTMLDivElement>(null)

  // Rate rules & persons
  const { data: borrowerTypes } = trpc.rateRules.listBorrowerTypes.useQuery()
  const { data: durationAdjustments } = trpc.rateRules.listDurationAdjustments.useQuery()
  const { data: persons } = trpc.persons.list.useQuery()
  const [selectedBorrowerTypeId, setSelectedBorrowerTypeId] = useState<string>('')
  const [selectedPersonId, setSelectedPersonId] = useState<string>('')

  function getSuggestedTnaForTerm(term: number): number | null {
    if (!selectedBorrowerTypeId || !borrowerTypes || !durationAdjustments) return null
    const bt = borrowerTypes.find((b) => b.id === selectedBorrowerTypeId)
    if (!bt) return null
    const baseTna = Number(bt.baseTna)
    const adj = [...durationAdjustments].sort((a, b) => b.minMonths - a.minMonths).find((a) => a.minMonths <= term && a.maxMonths >= term)
    return baseTna + (adj ? Number(adj.adjustment) : 0)
  }

  // Form state
  const [capital, setCapital] = useState('1000000')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [termMonths, setTermMonths] = useState('12')
  const [tnaTarget, setTnaTarget] = useState('55')
  const [customInstallment, setCustomInstallment] = useState('')
  const [impliedTna, setImpliedTna] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(formatDateToInput(new Date()))

  // Rounding state
  const [roundEnabled, setRoundEnabled] = useState(true)
  const [roundingMultiple, setRoundingMultiple] = useState<number>(1000)

  // Smart due date state
  const [smartDueDate, setSmartDueDate] = useState(true)

  // First installment month state
  const [firstInstallmentMonth, setFirstInstallmentMonth] = useState<string>('')

  // Compare terms state
  const [compareTermsInput, setCompareTermsInput] = useState('')
  const [compareTerms, setCompareTerms] = useState<number[]>([6, 9, 12])

  // localStorage persistence
  const STORAGE_KEY = 'spensiv_simulator_params'
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const installmentTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (saved.capital) setCapital(saved.capital)
      if (saved.currency) setCurrency(saved.currency)
      if (saved.tnaTarget) setTnaTarget(saved.tnaTarget)
      if (saved.roundEnabled !== undefined) setRoundEnabled(saved.roundEnabled)
      if (saved.roundingMultiple) setRoundingMultiple(saved.roundingMultiple)
      if (saved.smartDueDate !== undefined) setSmartDueDate(saved.smartDueDate)
      if (saved.firstInstallmentMonth) setFirstInstallmentMonth(saved.firstInstallmentMonth)
      if (saved.compareTerms?.length) setCompareTerms(saved.compareTerms)
      if (saved.viewMode) setViewMode(saved.viewMode)
      if (saved.termMonths) setTermMonths(saved.termMonths)
      if (saved.customInstallment) setCustomInstallment(saved.customInstallment)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-apply suggested rate when borrower type, term, or view mode changes
  useEffect(() => {
    if (!selectedBorrowerTypeId || !borrowerTypes || !durationAdjustments) return
    const bt = borrowerTypes.find((b) => b.id === selectedBorrowerTypeId)
    if (!bt) return
    if (viewMode === 'single') {
      const suggested = getSuggestedTnaForTerm(parseInt(termMonths) || 1)
      if (suggested != null) setTnaTarget(suggested.toString())
    } else {
      setTnaTarget(Number(bt.baseTna).toString())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBorrowerTypeId, termMonths, viewMode, borrowerTypes, durationAdjustments])

  // Results
  const [singleResult, setSingleResult] = useState<SimulationResult | null>(null)
  const [compareResults, setCompareResults] = useState<SimulationResult[] | null>(null)

  const simulateMutation = trpc.loans.simulate.useMutation({
    onSuccess: (data) => setSingleResult(data),
  })

  const compareTermsMutation = trpc.loans.compareTerms.useMutation({
    onSuccess: (data) => setCompareResults(data),
  })

  // Ref con el valor vigente de customInstallment para hacer stale-guard
  // en reverseMutation.onSuccess: si el usuario cambió o vació el input entre
  // el dispatch y la respuesta, descartamos el resultado.
  const customInstallmentRef = useRef(customInstallment)
  useEffect(() => { customInstallmentRef.current = customInstallment }, [customInstallment])

  const reverseMutation = trpc.loans.reverseFromInstallment.useMutation({
    onSuccess: (data, variables) => {
      const current = parseFloat(customInstallmentRef.current)
      if (!Number.isFinite(current) || current !== variables.desiredInstallment) return
      if (data.success) {
        const tnaPercent = (data.tna * 100).toFixed(2)
        setImpliedTna(data.tna)
        setTnaTarget(tnaPercent)
      } else {
        setImpliedTna(null)
        setTnaTarget('')
      }
    },
  })

  const isLoading = simulateMutation.isPending || compareTermsMutation.isPending

  // Save to localStorage with debounce whenever params change
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          capital,
          currency,
          tnaTarget,
          roundEnabled,
          roundingMultiple,
          smartDueDate,
          firstInstallmentMonth: firstInstallmentMonth || undefined,
          compareTerms,
          viewMode,
          termMonths,
          customInstallment: customInstallment || undefined,
        }))
      } catch {}
    }, 300)
    return () => clearTimeout(saveTimerRef.current)
  }, [capital, currency, tnaTarget, roundEnabled, roundingMultiple, smartDueDate, firstInstallmentMonth, compareTerms, viewMode, termMonths, customInstallment])

  function handleInstallmentChange(value: string) {
    setCustomInstallment(value)
    setImpliedTna(null)

    clearTimeout(installmentTimerRef.current)
    installmentTimerRef.current = setTimeout(() => {
      const installment = parseFloat(value)
      const cap = parseFloat(capital)
      const term = parseInt(termMonths)

      if (installment > 0 && cap > 0 && term > 0 && installment > cap / term) {
        reverseMutation.mutate({
          capital: cap,
          termMonths: term,
          desiredInstallment: installment,
          smartDueDate,
          startDate,
          firstInstallmentMonth: firstInstallmentMonth || undefined,
        })
      } else if (installment > 0 && cap > 0 && term > 0) {
        // Cuota insuficiente para amortizar: limpiar TNA stale y dejar el
        // botón Simular deshabilitado intencionalmente.
        setTnaTarget('')
      }
    }, 300)
  }

  function retriggerReverseFromInstallment(overrides: {
    capital?: string
    termMonths?: string
    smartDueDate?: boolean
    firstInstallmentMonth?: string
    startDate?: string
  } = {}) {
    if (!customInstallment) return
    const nextCapital = overrides.capital ?? capital
    const nextTerm = overrides.termMonths ?? termMonths
    const nextSmart = overrides.smartDueDate ?? smartDueDate
    const nextFim = overrides.firstInstallmentMonth ?? firstInstallmentMonth
    const nextStart = overrides.startDate ?? startDate

    const installment = parseFloat(customInstallment)
    const cap = parseFloat(nextCapital)
    const term = parseInt(nextTerm)
    setImpliedTna(null)
    if (installment > 0 && cap > 0 && term > 0 && installment > cap / term) {
      reverseMutation.mutate({
        capital: cap,
        termMonths: term,
        desiredInstallment: installment,
        smartDueDate: nextSmart,
        startDate: nextStart,
        firstInstallmentMonth: nextFim || undefined,
      })
    } else if (installment > 0 && cap > 0 && term > 0) {
      setTnaTarget('')
    }
  }

  function handleCapitalChange(value: string) {
    setCapital(value)
    retriggerReverseFromInstallment({ capital: value })
  }

  function handleTermChange(value: string) {
    setTermMonths(value)
    retriggerReverseFromInstallment({ termMonths: value })
  }

  function handleStartDateChange(value: string) {
    setStartDate(value)
    retriggerReverseFromInstallment({ startDate: value })
  }

  function handleSmartDueDateChange(next: boolean) {
    setSmartDueDate(next)
    retriggerReverseFromInstallment({ smartDueDate: next })
  }

  function handleFirstInstallmentMonthChange(value: string) {
    const next = value === '__auto__' ? '' : value
    setFirstInstallmentMonth(next)
    retriggerReverseFromInstallment({ firstInstallmentMonth: next })
  }

  function addCompareTerm() {
    const term = parseInt(compareTermsInput)
    if (term > 0 && term <= 360 && !compareTerms.includes(term) && compareTerms.length < 4) {
      setCompareTerms([...compareTerms, term].sort((a, b) => a - b))
      setCompareTermsInput('')
    }
  }

  function removeCompareTerm(term: number) {
    setCompareTerms(compareTerms.filter((t) => t !== term))
  }

  // Create Loan dialog state
  const [createLoanOpen, setCreateLoanOpen] = useState(false)
  const [createLoanDefaults, setCreateLoanDefaults] = useState<{
    capital: string; tna: string; termMonths: string; startDate: string; currency: 'ARS' | 'USD'; roundingMultiple: number; smartDueDate: boolean; firstInstallmentMonth?: string; firstDueDate?: string
  } | null>(null)
  const [borrowerName, setBorrowerName] = useState('')

  const [isPreApprove, setIsPreApprove] = useState(false)

  const createLoanMutation = trpc.loans.create.useMutation({
    onSuccess: () => {
      setCreateLoanOpen(false)
      setBorrowerName('')
    },
  })

  const preApproveMutation = trpc.loans.createPreApproved.useMutation({
    onSuccess: () => {
      setCreateLoanOpen(false)
      setBorrowerName('')
      setIsPreApprove(false)
    },
  })

  function handleCreateLoan(result: SimulationResult) {
    setIsPreApprove(false)
    setCreateLoanDefaults({
      capital: result.capital.toString(),
      tna: (result.tnaTarget * 100).toFixed(2),
      termMonths: result.termMonths.toString(),
      startDate: startDate,
      currency,
      roundingMultiple: roundEnabled ? roundingMultiple : 0,
      smartDueDate,
      firstInstallmentMonth: firstInstallmentMonth || undefined,
      firstDueDate: result.amortizationTable?.[0]?.date,
    })
    setCreateLoanOpen(true)
  }

  function handlePreApproveLoan(result: SimulationResult) {
    setIsPreApprove(true)
    setCreateLoanDefaults({
      capital: result.capital.toString(),
      tna: (result.tnaTarget * 100).toFixed(2),
      termMonths: result.termMonths.toString(),
      startDate: startDate,
      currency,
      roundingMultiple: roundEnabled ? roundingMultiple : 0,
      smartDueDate,
      firstInstallmentMonth: firstInstallmentMonth || undefined,
      firstDueDate: result.amortizationTable?.[0]?.date,
    })
    setCreateLoanOpen(true)
  }

  function submitCreateLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!createLoanDefaults) return
    const payload = {
      borrowerName,
      capital: parseFloat(createLoanDefaults.capital),
      currency: createLoanDefaults.currency,
      tna: parseFloat(createLoanDefaults.tna) / 100,
      termMonths: parseInt(createLoanDefaults.termMonths),
      startDate: createLoanDefaults.startDate,
      roundingMultiple: createLoanDefaults.roundingMultiple,
      smartDueDate: createLoanDefaults.smartDueDate,
      firstInstallmentMonth: createLoanDefaults.firstInstallmentMonth,
    }
    if (isPreApprove) {
      preApproveMutation.mutate(payload)
    } else {
      createLoanMutation.mutate(payload)
    }
  }

  function handleSimulate() {
    const cap = parseFloat(capital)
    const tna = parseFloat(tnaTarget)
    if (!cap || cap <= 0 || !tna || tna <= 0) return

    if (viewMode === 'compare' && compareTerms.length > 0) {
      const tnaPerTerm: Record<string, number> = {}
      if (selectedBorrowerTypeId) {
        for (const t of compareTerms) {
          const suggested = getSuggestedTnaForTerm(t)
          if (suggested != null) tnaPerTerm[t.toString()] = suggested / 100
        }
      }
      compareTermsMutation.mutate({
        capital: cap,
        tnaTarget: tna / 100,
        accrualType: 'exponential',
        startDate,
        roundingMultiple: roundEnabled ? roundingMultiple : 0,
        smartDueDate,
        firstInstallmentMonth: firstInstallmentMonth || undefined,
        terms: compareTerms,
        ...(Object.keys(tnaPerTerm).length > 0 ? { tnaPerTerm } : {}),
      })
      setSingleResult(null)
    } else if (viewMode === 'single') {
      const term = parseInt(termMonths)
      if (!term || term <= 0) return
      simulateMutation.mutate({
        capital: cap,
        tnaTarget: tna / 100,
        accrualType: 'exponential',
        startDate,
        roundingMultiple: roundEnabled ? roundingMultiple : 0,
        smartDueDate,
        firstInstallmentMonth: firstInstallmentMonth || undefined,
        termMonths: term,
        loanType: 'amortized',
        ...(customInstallment ? { customInstallment: parseFloat(customInstallment) } : {}),
      })
      setCompareResults(null)
    }
    setActiveTab('results')
  }

  const hasResults = singleResult || compareResults

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Simulador de Crédito</h1>
        <p className="text-muted-foreground mt-1">
          Simulá préstamos amortizados y compara distintos plazos
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Parámetros de Simulación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'compare' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('compare')}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Comparar Plazos
            </Button>
            <Button
              variant={viewMode === 'single' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('single')}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Simulación Individual
            </Button>
          </div>

          {/* ── Capital slider ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Capital</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as 'ARS' | 'USD')}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-3xl font-black text-foreground tabular-nums tracking-tight text-center">
              {formatCurrency(parseFloat(capital) || 0, currency)}
            </p>
            <input
              type="range"
              min={currency === 'USD' ? 100 : 50000}
              max={currency === 'USD' ? 50000 : 20000000}
              step={currency === 'USD' ? 100 : 50000}
              value={capital}
              onChange={(e) => handleCapitalChange(e.target.value)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{formatCurrency(currency === 'USD' ? 100 : 50000, currency)}</span>
              <span>{formatCurrency(currency === 'USD' ? 50000 : 20000000, currency)}</span>
            </div>
            {/* Direct input fallback */}
            <Input
              type="number"
              value={capital}
              onChange={(e) => handleCapitalChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="Monto exacto"
              className="h-8 text-sm text-center"
            />
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {viewMode === 'single' && (
              <div className="space-y-2">
                <Label htmlFor="termMonths">Plazo (meses)</Label>
                <Input
                  id="termMonths"
                  type="number"
                  value={termMonths}
                  onChange={(e) => handleTermChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="12"
                  min="1"
                  max="360"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tnaTarget">¿Qué tasa querés cobrar? (TNA %)</Label>
              <Input
                id="tnaTarget"
                type="number"
                value={tnaTarget}
                onChange={(e) => { setTnaTarget(e.target.value); setSelectedBorrowerTypeId('') }}
                onFocus={(e) => e.target.select()}
                placeholder="55"
                step="0.5"
              />
              {borrowerTypes && borrowerTypes.length > 0 && (
                <Select value={selectedBorrowerTypeId || '__none__'} onValueChange={(v) => {
                  setSelectedBorrowerTypeId(v === '__none__' ? '' : v)
                }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Usar regla de tasas..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin regla de tasa</SelectItem>
                    {borrowerTypes.map((bt) => (
                      <SelectItem key={bt.id} value={bt.id}>
                        {bt.name} — base {Number(bt.baseTna)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>

            {viewMode === 'single' && (
              <div className="space-y-2">
                <Label htmlFor="customInstallment">Cuota Deseada (opcional)</Label>
                <Input
                  id="customInstallment"
                  type="number"
                  value={customInstallment}
                  onChange={(e) => handleInstallmentChange(e.target.value)}
                  placeholder="Dejar vacío para calcular"
                />
                {impliedTna !== null && (
                  <p className="text-xs flex items-center gap-1 text-accent-positive">
                    <Zap className="h-3 w-3" />
                    → TNA resultante: {(impliedTna * 100).toFixed(2)}%
                  </p>
                )}
                {reverseMutation.isPending && (
                  <p className="text-xs text-muted-foreground">Calculando TNA...</p>
                )}
                {!reverseMutation.isPending && impliedTna === null && customInstallment !== '' &&
                  parseFloat(customInstallment) > 0 && parseFloat(capital) > 0 && parseInt(termMonths) > 0 &&
                  parseFloat(customInstallment) <= parseFloat(capital) / parseInt(termMonths) && (
                  <p className="text-xs text-red-500">
                    Cuota insuficiente para amortizar. Mínimo para este capital y plazo: {formatCurrency(parseFloat(capital) / parseInt(termMonths), currency)} (TNA 0%).
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Person selector (informational) */}
          {persons && persons.length > 0 && (
            <div className="space-y-2">
              <Label>Persona (opcional)</Label>
              <Select value={selectedPersonId || '__none__'} onValueChange={(v) => setSelectedPersonId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Sin persona" />
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
                const p = persons.find((p) => p.id === selectedPersonId)
                if (!p) return null
                const catColors: Record<string, string> = {
                  bajo: 'bg-green-500/10 text-green-400',
                  medio: 'bg-yellow-500/10 text-yellow-400',
                  alto: 'bg-orange-500/10 text-orange-400',
                  critico: 'bg-red-500/10 text-red-400',
                }
                return (
                  <div className={cn('text-xs px-3 py-2 rounded-lg flex items-center gap-2', catColors[p.category] || '')}>
                    <Shield className="h-3.5 w-3.5" />
                    <span>Riesgo {p.category} · Score: {p.score}/12 · Prob. default: {(p.defaultProbability * 100).toFixed(0)}%</span>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Rounding toggle */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Switch
                id="round-installments"
                checked={roundEnabled}
                onCheckedChange={setRoundEnabled}
              />
              <Label htmlFor="round-installments" className="text-sm cursor-pointer">
                Redondear hacia arriba
              </Label>
            </div>
            {roundEnabled && (
              <Select value={roundingMultiple.toString()} onValueChange={(v) => setRoundingMultiple(parseInt(v))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">Múltiplos de $1.000</SelectItem>
                  <SelectItem value="100">Múltiplos de $100</SelectItem>
                  <SelectItem value="500">Múltiplos de $500</SelectItem>
                  <SelectItem value="5000">Múltiplos de $5.000</SelectItem>
                  <SelectItem value="10000">Múltiplos de $10.000</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Smart due date toggle */}
          <div className={cn("space-y-1.5", firstInstallmentMonth && "opacity-60")}>
            <div className="flex items-center gap-2">
              <Switch
                id="smart-due-date"
                checked={smartDueDate}
                onCheckedChange={handleSmartDueDateChange}
                disabled={!!firstInstallmentMonth}
              />
              <Label htmlFor="smart-due-date" className="text-sm cursor-pointer">
                Primer vencimiento inteligente
              </Label>
            </div>
            {firstInstallmentMonth ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 pl-0.5">
                <Info className="h-3 w-3 shrink-0" />
                Ignorado porque fijaste el mes de primera cuota abajo
              </p>
            ) : smartDueDate ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 pl-0.5">
                <Info className="h-3 w-3 shrink-0" />
                Las cuotas vencen el 2° día hábil de cada mes
              </p>
            ) : null}
          </div>

          {/* First installment month selector */}
          <div className="space-y-2">
            <Label>Mes de primera cuota (opcional)</Label>
            <Select value={firstInstallmentMonth || '__auto__'} onValueChange={handleFirstInstallmentMonthChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">Automático</SelectItem>
                {getNextMonths(8).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Compare terms pill buttons */}
          {viewMode === 'compare' && (
            <div className="space-y-3">
              <Label>¿En cuántas cuotas?</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set([...[3, 6, 9, 12, 18, 24], ...compareTerms])).sort((a, b) => a - b).map((term) => {
                  const isSelected = compareTerms.includes(term)
                  return (
                    <button
                      key={term}
                      onClick={() => {
                        if (isSelected) {
                          removeCompareTerm(term)
                        } else if (compareTerms.length < 4) {
                          setCompareTerms([...compareTerms, term].sort((a, b) => a - b))
                        }
                      }}
                      className={cn(
                        "px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {term} {pluralize(term, 'mes', 'meses')}
                    </button>
                  )
                })}
              </div>
              {/* Custom term input */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={compareTermsInput}
                  onChange={(e) => setCompareTermsInput(e.target.value)}
                  placeholder="Otro plazo..."
                  className="w-32 h-8 text-sm"
                  min="1"
                  max="360"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCompareTerm() } }}
                />
                <Button variant="outline" size="sm" className="h-8" onClick={addCompareTerm} disabled={compareTerms.length >= 4}>
                  Agregar
                </Button>
                {compareTerms.length >= 4 && (
                  <span className="text-xs text-muted-foreground">Máx. 4 plazos</span>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleSimulate}
            disabled={isLoading || !parseFloat(capital) || !parseFloat(tnaTarget)}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                Calculando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Simular
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {hasResults && (
        <div ref={resultsRef}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="results">Resultados</TabsTrigger>
              <TabsTrigger value="table">Tabla de Flujos</TabsTrigger>
            </TabsList>

            {/* ── Results Tab ── */}
            <TabsContent value="results" className="space-y-6 mt-6">
              {/* Sub-toggle: Mi análisis / Para compartir */}
              <div className="flex gap-1 bg-muted rounded-lg p-0.5 w-fit">
                <Button
                  variant={resultsView === 'analysis' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setResultsView('analysis')}
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                  Mi análisis
                </Button>
                <Button
                  variant={resultsView === 'share' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setResultsView('share')}
                >
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Para compartir
                </Button>
              </div>

              {resultsView === 'analysis' && (
                <>
                  {compareResults && <CompareTermsResultCards results={compareResults} onCreateLoan={handleCreateLoan} onPreApprove={handlePreApproveLoan} getSuggestedTna={selectedBorrowerTypeId ? getSuggestedTnaForTerm : undefined} />}
                  {singleResult && <SingleResultCards result={singleResult} onCreateLoan={handleCreateLoan} onPreApprove={handlePreApproveLoan} suggestedTna={selectedBorrowerTypeId ? getSuggestedTnaForTerm(singleResult.termMonths) : undefined} />}
                </>
              )}

              {resultsView === 'share' && (
                <ShareableSimulationView
                  results={compareResults || (singleResult ? [singleResult] : [])}
                  currency={currency}
                  onCreateLoan={handleCreateLoan}
                  onPreApprove={handlePreApproveLoan}
                />
              )}
            </TabsContent>

            {/* ── Table Tab ── */}
            <TabsContent value="table" className="space-y-6 mt-6">
              {compareResults && compareResults.map((r) => (
                <AmortizationTable key={r.termMonths} result={r} title={`${r.termMonths} ${pluralize(r.termMonths, 'mes', 'meses')}`} />
              ))}
              {singleResult && (
                <AmortizationTable result={singleResult} title="Amortizado (Cuotas)" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Create Loan Dialog */}
      <Dialog open={createLoanOpen} onOpenChange={setCreateLoanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isPreApprove ? 'Guardar Préstamo Preaprobado' : 'Crear Préstamo desde Simulación'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreateLoan} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="simBorrower">Nombre del Deudor</Label>
              <Input
                id="simBorrower"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="Ej: Juan Perez"
                required
                autoFocus
              />
            </div>
            {createLoanDefaults && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Capital</p>
                  <p className="font-bold">{formatCurrency(parseFloat(createLoanDefaults.capital))}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">TNA</p>
                  <p className="font-bold">{createLoanDefaults.tna}%</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Plazo</p>
                  <p className="font-bold">{createLoanDefaults.termMonths} {pluralize(Number(createLoanDefaults.termMonths), 'mes', 'meses')}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Inicio</p>
                  <p className="font-bold">{createLoanDefaults.startDate}</p>
                </div>
              </div>
            )}
            {createLoanDefaults && (
              <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {createLoanDefaults.termMonths} {pluralize(Number(createLoanDefaults.termMonths), 'cuota')} — 1er vencimiento:{' '}
                  <span className="font-semibold">
                    {createLoanDefaults.firstDueDate ? formatFirstDueDate(createLoanDefaults.firstDueDate) : '—'}
                  </span>
                </span>
              </div>
            )}
            {isPreApprove && (
              <p className="text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
                El préstamo se guardará como preaprobado. Cuando se transfiera el dinero, confirmalo desde la página de préstamos para activarlo.
              </p>
            )}
            {(createLoanMutation.error || preApproveMutation.error) && (
              <p className="text-sm text-red-500">{(createLoanMutation.error || preApproveMutation.error)?.message}</p>
            )}
            {(createLoanMutation.isSuccess || preApproveMutation.isSuccess) && (
              <p className="text-sm text-accent-positive">
                {isPreApprove ? 'Préstamo preaprobado guardado' : 'Préstamo creado exitosamente'}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={createLoanMutation.isPending || preApproveMutation.isPending || createLoanMutation.isSuccess || preApproveMutation.isSuccess}
            >
              {(createLoanMutation.isPending || preApproveMutation.isPending)
                ? (isPreApprove ? 'Guardando...' : 'Creando...')
                : (createLoanMutation.isSuccess || preApproveMutation.isSuccess)
                  ? (isPreApprove ? 'Guardado' : 'Creado')
                  : (isPreApprove ? 'Guardar Preaprobado' : 'Crear Préstamo')
              }
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Result Cards ────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subvalue,
  variant = 'default',
}: {
  label: string
  value: string
  subvalue?: string
  variant?: 'default' | 'success' | 'danger' | 'warning'
}) {
  const colors = {
    default: 'text-foreground',
    success: 'text-accent-positive',
    danger: 'text-accent-danger',
    warning: 'text-accent-warning',
  }

  return (
    <div className="space-y-1 min-w-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className={cn("text-lg lg:text-xl font-black truncate", colors[variant])}>{value}</p>
      {subvalue && <p className="text-xs text-muted-foreground truncate">{subvalue}</p>}
    </div>
  )
}


function ResultCardContent({ result, title, onCreateLoan, onPreApprove, suggestedTna }: { result: SimulationResult; title: string; onCreateLoan?: (result: SimulationResult) => void; onPreApprove?: (result: SimulationResult) => void; suggestedTna?: number | null }) {
  const currentTna = Math.round(result.tnaTarget * 10000) / 100
  const belowSuggested = suggestedTna != null && currentTna < suggestedTna
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          {title}
        </CardTitle>
        {suggestedTna != null && (
          <p className="text-xs text-muted-foreground">
            TNA recomendada para este plazo: <span className="font-medium text-foreground">{suggestedTna}%</span>
            {belowSuggested && <span className="text-yellow-500 ml-1">(simulando con {currentTna}%)</span>}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="TIR Efectiva (TEA)"
            value={`${(result.tirEffective * 100).toFixed(2)}%`}
          />
          <MetricCard
            label="TIR (TNA equiv.)"
            value={`${(result.tirTNA * 100).toFixed(2)}%`}
          />
          <MetricCard
            label="Cuota Mensual"
            value={formatCurrency(result.installmentAmount!)}
          />
          <MetricCard
            label="Total Cobrado"
            value={formatCurrency(result.totalPaid!)}
            subvalue={`Ganancia: ${formatCurrency(result.totalPaid! - result.capital)}`}
          />
        </div>
        {result.amortizationTable?.[0]?.date && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>1er vencimiento: <span className="font-medium text-foreground">{formatFirstDueDate(result.amortizationTable[0].date)}</span></span>
          </div>
        )}
        {onCreateLoan && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onCreateLoan(result)}
            >
              <Banknote className="h-4 w-4 mr-2" />
              Crear Préstamo
            </Button>
            {onPreApprove && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onPreApprove(result)}
              >
                <Clock className="h-4 w-4 mr-2" />
                Preaprobar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CompareTermsResultCards({ results, onCreateLoan, onPreApprove, getSuggestedTna }: { results: SimulationResult[]; onCreateLoan?: (result: SimulationResult) => void; onPreApprove?: (result: SimulationResult) => void; getSuggestedTna?: (term: number) => number | null }) {
  return (
    <div className={cn(
      "grid gap-6 grid-cols-1",
      results.length === 2 && "lg:grid-cols-2",
      results.length >= 3 && "lg:grid-cols-3",
    )}>
      {results.map((result) => (
        <ResultCardContent
          key={result.termMonths}
          result={result}
          title={`${result.termMonths} ${pluralize(result.termMonths, 'mes', 'meses')}`}
          onCreateLoan={onCreateLoan}
          onPreApprove={onPreApprove}
          suggestedTna={getSuggestedTna?.(result.termMonths)}
        />
      ))}
    </div>
  )
}

function SingleResultCards({ result, onCreateLoan, onPreApprove, suggestedTna }: { result: SimulationResult; onCreateLoan?: (result: SimulationResult) => void; onPreApprove?: (result: SimulationResult) => void; suggestedTna?: number | null }) {
  return <ResultCardContent result={result} title="Amortizado (Cuotas)" onCreateLoan={onCreateLoan} onPreApprove={onPreApprove} suggestedTna={suggestedTna} />
}

// ─── Tables ──────────────────────────────────────────────────────────

function AmortizationTable({ result, title }: { result: SimulationResult; title: string }) {
  if (!result.amortizationTable) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title} - Tabla de Amortización</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Mes</th>
                <th className="text-left py-2 px-3 font-medium">Fecha</th>
                <th className="text-right py-2 px-3 font-medium">Cuota</th>
                <th className="text-right py-2 px-3 font-medium">Interes</th>
                <th className="text-right py-2 px-3 font-medium">Capital</th>
                <th className="text-right py-2 px-3 font-medium">Saldo</th>
                <th className="text-right py-2 px-3 font-medium">Rend. Acum.</th>
              </tr>
            </thead>
            <tbody>
              {result.amortizationTable.map((row) => (
                <tr key={row.month} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium">{row.month}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.date}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(row.installment)}</td>
                  <td className="py-2 px-3 text-right text-accent-blue">{formatCurrency(row.interest)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(row.principal)}</td>
                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(row.balance)}</td>
                  <td className="py-2 px-3 text-right text-accent-positive">{formatCurrency(row.accruedReturn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Shareable Simulation View ───────────────────────────────────────

interface InstallmentPlanCardProps {
  termMonths: number
  installmentAmount: number
  currency: string
  isRecommended: boolean
  isSelected: boolean
  onSelect: () => void
  formatClean: (amount: number) => string
  firstDueDate?: string
}

function InstallmentPlanCard({
  termMonths,
  installmentAmount,
  currency,
  isRecommended,
  isSelected,
  onSelect,
  formatClean,
  firstDueDate,
}: InstallmentPlanCardProps) {
  return (
    <div className="relative">
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge className="text-[10px] px-2.5 py-0.5 shadow-sm">
            Cuota más baja
          </Badge>
        </div>
      )}
      <Card
        className={cn(
          "cursor-pointer transition-all duration-200 hover:border-primary/50",
          isSelected
            ? "border-primary ring-2 ring-primary/20 bg-primary/[0.03]"
            : "hover:shadow-md",
          isRecommended && !isSelected && "border-primary/30"
        )}
        onClick={onSelect}
      >
        <CardContent className="p-5 text-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {termMonths} {pluralize(termMonths, 'cuota')}
          </p>
          <p className="text-2xl font-black text-foreground">
            {formatClean(installmentAmount)}
          </p>
          <p className="text-xs text-muted-foreground">por mes</p>
          {firstDueDate && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Primera cuota: {firstDueDate}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ShareableSimulationView({
  results,
  currency,
  onCreateLoan,
  onPreApprove,
}: {
  results: SimulationResult[]
  currency: string
  onCreateLoan?: (result: SimulationResult) => void
  onPreApprove?: (result: SimulationResult) => void
}) {
  const [copied, setCopied] = useState(false)
  const [imageGenerated, setImageGenerated] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  const maxTermIndex = results.length > 0
    ? results.reduce((maxI, r, i, arr) => r.termMonths > arr[maxI].termMonths ? i : maxI, 0)
    : 0

  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  // Update selected index when results change
  useEffect(() => {
    if (results.length > 0) {
      setSelectedIndex(results.reduce((maxI, r, i, arr) => r.termMonths > arr[maxI].termMonths ? i : maxI, 0))
    }
  }, [results])

  if (results.length === 0) return null

  const capital = results[0].capital
  const selectedResult = results[selectedIndex] ?? null
  const lowestInstallment = results[maxTermIndex]

  // No-decimal currency formatter for clean display
  const fmtClean = useCallback((amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
    , [currency])

  // ─── Clipboard copy ────────────────────────────────────────────────
  const handleCopyText = useCallback(async () => {
    const lines = [
      `💰 *Simulación de préstamo*`,
      ``,
      `Monto: ${fmtClean(capital)}`,
      ``,
      ...results.map(r => {
        const amt = r.roundedInstallmentAmount || r.installmentAmount || r.nominalValue || 0
        const dueDateStr = r.amortizationTable?.[0]?.date ? ` (1ra cuota: ${formatFirstDueDate(r.amortizationTable[0].date)})` : ''
        return r.loanType === 'amortized'
          ? `${r.termMonths} ${pluralize(r.termMonths, 'cuota')} de ${fmtClean(amt)}${dueDateStr}`
          : `${r.termMonths} ${pluralize(r.termMonths, 'mes', 'meses')} → ${fmtClean(amt)}`
      }),
      ``,
      `Elegí la opción que te quede más cómoda.`,
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [results, capital, currency, fmtClean])

  // ─── Canvas image generation (LIGHT THEME) ────────────────────────
  const handleGenerateImage = useCallback(async () => {
    const W = 800
    const H = 520
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Light background
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, W, H)

    // Subtle accent line at top
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0)
    accentGrad.addColorStop(0, 'transparent')
    accentGrad.addColorStop(0.2, '#2563eb')
    accentGrad.addColorStop(0.8, '#2563eb')
    accentGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, 0, W, 3)

    // Title
    ctx.fillStyle = '#6b7280'
    ctx.font = '600 13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SIMULACIÓN DE PRÉSTAMO', W / 2, 55)

    // Amount
    ctx.fillStyle = '#111827'
    ctx.font = '800 38px Inter, system-ui, sans-serif'
    ctx.fillText(`Monto: ${fmtClean(capital)}`, W / 2, 105)

    // Subtitle
    ctx.fillStyle = '#6b7280'
    ctx.font = '400 14px Inter, system-ui, sans-serif'
    ctx.fillText('Elegí la opción que te quede más cómoda.', W / 2, 138)

    // Cards — dynamically sized
    const n = results.length
    const cardW = Math.min(200, (W - 80 - (n - 1) * 16) / n)
    const cardH = 140
    const gap = 16
    const totalW = n * cardW + (n - 1) * gap
    const startX = (W - totalW) / 2
    const cardY = 175

    results.forEach((r, i) => {
      const x = startX + i * (cardW + gap)
      const cx = x + cardW / 2
      const isRec = i === maxTermIndex

      // Card bg
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(x, cardY, cardW, cardH, 12)
      ctx.fill()

      // Card border
      ctx.strokeStyle = isRec ? '#2563eb' : '#e5e7eb'
      ctx.lineWidth = isRec ? 2 : 1
      ctx.beginPath()
      ctx.roundRect(x, cardY, cardW, cardH, 12)
      ctx.stroke()

      // Card shadow (subtle)
      if (!isRec) {
        ctx.shadowColor = 'rgba(0,0,0,0.06)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetY = 2
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.roundRect(x, cardY, cardW, cardH, 12)
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
      }

      // Badge
      if (isRec) {
        const badgeText = 'CUOTA MÁS BAJA'
        const badgeW = 120
        const badgeH = 22
        const badgeX = cx - badgeW / 2
        const badgeY = cardY - 11
        ctx.fillStyle = '#2563eb'
        ctx.beginPath()
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 11)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = '600 10px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(badgeText, cx, badgeY + 15)
      }

      // Term label
      ctx.fillStyle = '#6b7280'
      ctx.font = '600 12px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${r.termMonths} ${pluralize(r.termMonths, 'CUOTA')}`, cx, cardY + 40)

      // Amount
      ctx.fillStyle = '#111827'
      ctx.font = '800 24px Inter, system-ui, sans-serif'
      const amt = r.roundedInstallmentAmount || r.installmentAmount || r.nominalValue || 0
      ctx.fillText(fmtClean(amt), cx, cardY + 82)

      // Per month
      ctx.fillStyle = '#9ca3af'
      ctx.font = '400 12px Inter, system-ui, sans-serif'
      ctx.fillText('por mes', cx, cardY + 108)
    })

    // Footer
    ctx.fillStyle = '#9ca3af'
    ctx.font = '400 13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Cuotas fijas.', W / 2, H - 30)

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `simulacion-prestamo-${formatCurrency(capital, currency).replace(/[^0-9]/g, '')}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setImageGenerated(true)
      setTimeout(() => setImageGenerated(false), 2500)
    }, 'image/png')
  }, [results, capital, currency, maxTermIndex, fmtClean])

  return (
    <div ref={shareRef} className="space-y-8">
      {/* ── Header ── */}
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Resultados de simulación
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-foreground">
          Monto del préstamo: {formatCurrency(capital, currency)}
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Elegí la opción que te quede más cómoda.
        </p>
      </div>

      {/* ── Plan Cards Grid ── */}
      <div className={cn(
        "grid gap-4",
        results.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
      )}>
        {results.map((result, index) => {
          const amt = result.roundedInstallmentAmount || result.installmentAmount || result.nominalValue || 0
          return (
            <InstallmentPlanCard
              key={result.termMonths}
              termMonths={result.termMonths}
              installmentAmount={amt}
              currency={currency}
              isRecommended={index === maxTermIndex}
              isSelected={selectedIndex === index}
              onSelect={() => setSelectedIndex(index)}
              formatClean={fmtClean}
              firstDueDate={result.amortizationTable?.[0]?.date ? formatFirstDueDate(result.amortizationTable[0].date) : undefined}
            />
          )
        })}
      </div>

      {/* ── Selection Summary ── */}
      {selectedResult && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">
                  Plan seleccionado: {selectedResult.termMonths} {pluralize(selectedResult.termMonths, 'cuota')} de{' '}
                  {fmtClean(selectedResult.roundedInstallmentAmount || selectedResult.installmentAmount || selectedResult.nominalValue || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cuotas fijas.{selectedResult.amortizationTable?.[0]?.date && (
                    <> Primera cuota: {formatFirstDueDate(selectedResult.amortizationTable[0].date)}</>
                  )}
                </p>
              </div>
            </div>
            {selectedResult.loanType === 'amortized' && (
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                {onCreateLoan && (
                  <Button
                    onClick={() => onCreateLoan(selectedResult)}
                    className="flex-1 sm:flex-none"
                  >
                    Crear Préstamo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {onPreApprove && (
                  <Button
                    variant="outline"
                    onClick={() => onPreApprove(selectedResult)}
                    className="flex-1 sm:flex-none"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Preaprobar
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Share Actions ── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          variant="outline"
          onClick={handleCopyText}
          className="gap-2"
        >
          {copied ? (
            <><Check className="h-4 w-4 text-green-600" /> Resumen copiado</>
          ) : (
            <><Copy className="h-4 w-4" /> Copiar resumen</>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleGenerateImage}
          className="gap-2"
        >
          {imageGenerated ? (
            <><Check className="h-4 w-4 text-green-600" /> Imagen descargada</>
          ) : (
            <><Download className="h-4 w-4" /> Compartir simulación</>
          )}
        </Button>
      </div>
    </div>
  )
}

