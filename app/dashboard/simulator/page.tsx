'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, formatDateToInput, cn } from '@/lib/utils'
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
  TrendingDown,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
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
} from 'lucide-react'
import type { SimulationResult } from '@/lib/loan-calculator'

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

  // Form state
  const [capital, setCapital] = useState('1000000')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [termMonths, setTermMonths] = useState('12')
  const [tnaTarget, setTnaTarget] = useState('55')
  const [hurdleRate, setHurdleRate] = useState('40')
  const [loanType, setLoanType] = useState<'bullet' | 'amortized'>('amortized')
  const [accrualType, setAccrualType] = useState<'linear' | 'exponential'>('exponential')
  const [customInstallment, setCustomInstallment] = useState('')
  const [impliedTna, setImpliedTna] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(formatDateToInput(new Date()))

  // Rounding state
  const [roundEnabled, setRoundEnabled] = useState(true)
  const [roundingMultiple, setRoundingMultiple] = useState<number>(1000)

  // Compare terms state
  const [compareTermsInput, setCompareTermsInput] = useState('')
  const [compareTerms, setCompareTerms] = useState<number[]>([6, 9, 12])

  // Results
  const [singleResult, setSingleResult] = useState<SimulationResult | null>(null)
  const [compareResults, setCompareResults] = useState<SimulationResult[] | null>(null)

  const simulateMutation = trpc.loans.simulate.useMutation({
    onSuccess: (data) => {
      setSingleResult(data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    },
  })

  const compareTermsMutation = trpc.loans.compareTerms.useMutation({
    onSuccess: (data) => {
      setCompareResults(data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    },
  })

  const reverseMutation = trpc.loans.reverseFromInstallment.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        const tnaPercent = (data.tna * 100).toFixed(2)
        setImpliedTna(data.tna)
        setTnaTarget(tnaPercent)
      } else {
        setImpliedTna(null)
      }
    },
  })

  const isLoading = simulateMutation.isPending || compareTermsMutation.isPending

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

  function handleSimulate() {
    const baseInput = {
      capital: parseFloat(capital),
      tnaTarget: parseFloat(tnaTarget) / 100,
      hurdleRate: parseFloat(hurdleRate) / 100,
      accrualType: accrualType as 'linear' | 'exponential',
      startDate,
      roundingMultiple: roundEnabled ? roundingMultiple : 0,
    }

    if (viewMode === 'compare') {
      compareTermsMutation.mutate({
        ...baseInput,
        terms: compareTerms,
      })
      setSingleResult(null)
    } else {
      simulateMutation.mutate({
        ...baseInput,
        termMonths: parseInt(termMonths),
        loanType,
        ...(customInstallment ? { customInstallment: parseFloat(customInstallment) } : {}),
      })
      setCompareResults(null)
    }
    setActiveTab('results')
  }

  // Create Loan dialog state
  const [createLoanOpen, setCreateLoanOpen] = useState(false)
  const [createLoanDefaults, setCreateLoanDefaults] = useState<{
    capital: string; tna: string; termMonths: string; startDate: string; currency: 'ARS' | 'USD'; roundingMultiple: number
  } | null>(null)
  const [borrowerName, setBorrowerName] = useState('')

  const createLoanMutation = trpc.loans.create.useMutation({
    onSuccess: () => {
      setCreateLoanOpen(false)
      setBorrowerName('')
    },
  })

  function handleCreateLoan(result: SimulationResult) {
    setCreateLoanDefaults({
      capital: result.capital.toString(),
      tna: (result.tnaTarget * 100).toFixed(2),
      termMonths: result.termMonths.toString(),
      startDate: startDate,
      currency,
      roundingMultiple: roundEnabled ? roundingMultiple : 0,
    })
    setCreateLoanOpen(true)
  }

  function submitCreateLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!createLoanDefaults) return
    createLoanMutation.mutate({
      borrowerName,
      capital: parseFloat(createLoanDefaults.capital),
      currency: createLoanDefaults.currency,
      tna: parseFloat(createLoanDefaults.tna) / 100,
      termMonths: parseInt(createLoanDefaults.termMonths),
      startDate: createLoanDefaults.startDate,
      roundingMultiple: createLoanDefaults.roundingMultiple,
    })
  }

  const hasResults = singleResult || compareResults

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Simulador de Crédito</h1>
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

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="capital">Capital ({currency})</Label>
              <div className="flex gap-2">
                <Input
                  id="capital"
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  placeholder="1000000"
                  className="flex-1"
                />
                <Select value={currency} onValueChange={(v) => setCurrency(v as 'ARS' | 'USD')}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {viewMode === 'single' && (
              <div className="space-y-2">
                <Label htmlFor="termMonths">Plazo (meses)</Label>
                <Input
                  id="termMonths"
                  type="number"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  placeholder="12"
                  min="1"
                  max="360"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tnaTarget">TNA Objetivo (%)</Label>
              <Input
                id="tnaTarget"
                type="number"
                value={tnaTarget}
                onChange={(e) => setTnaTarget(e.target.value)}
                placeholder="55"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hurdleRate">Tasa Libre de Riesgo / Hurdle Rate (%)</Label>
              <Input
                id="hurdleRate"
                type="number"
                value={hurdleRate}
                onChange={(e) => setHurdleRate(e.target.value)}
                placeholder="40"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {viewMode === 'single' && (
              <div className="space-y-2">
                <Label>Tipo de Préstamo</Label>
                <Select value={loanType} onValueChange={(v) => setLoanType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amortized">Amortizado (Cuotas)</SelectItem>
                    <SelectItem value="bullet">Bullet (Descuento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewMode === 'single' && loanType === 'bullet' && (
              <div className="space-y-2">
                <Label>Devengamiento Bullet</Label>
                <Select value={accrualType} onValueChange={(v) => setAccrualType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exponential">Exponencial</SelectItem>
                    <SelectItem value="linear">Lineal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewMode === 'single' && loanType === 'amortized' && (
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
                  <p className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <Zap className="h-3 w-3" />
                    TNA implícita: {(impliedTna * 100).toFixed(2)}% (aplicada arriba)
                  </p>
                )}
                {reverseMutation.isPending && (
                  <p className="text-xs text-muted-foreground">Calculando TNA...</p>
                )}
              </div>
            )}
          </div>

          {/* Rounding toggle */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Switch
                id="round-installments"
                checked={roundEnabled}
                onCheckedChange={setRoundEnabled}
              />
              <Label htmlFor="round-installments" className="text-sm cursor-pointer">
                Redondear cuotas
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

          {/* Compare terms chips */}
          {viewMode === 'compare' && (
            <div className="space-y-2">
              <Label>Plazos a comparar (meses)</Label>
              <div className="flex flex-wrap items-center gap-2">
                {compareTerms.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                  >
                    {term} meses
                    <button onClick={() => removeCompareTerm(term)} className="hover:text-red-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {compareTerms.length < 4 && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={compareTermsInput}
                      onChange={(e) => setCompareTermsInput(e.target.value)}
                      placeholder="Ej: 24"
                      className="w-24 h-8 text-sm"
                      min="1"
                      max="360"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCompareTerm() } }}
                    />
                    <Button variant="outline" size="sm" className="h-8" onClick={addCompareTerm}>
                      Agregar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleSimulate}
            disabled={isLoading || (viewMode === 'compare' && compareTerms.length === 0)}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Calculando...' : 'Simular'}
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
                  {compareResults && <CompareTermsResultCards results={compareResults} onCreateLoan={handleCreateLoan} />}
                  {singleResult && <SingleResultCards result={singleResult} onCreateLoan={handleCreateLoan} />}
                </>
              )}

              {resultsView === 'share' && (
                <ShareableSimulationView
                  results={compareResults || (singleResult ? [singleResult] : [])}
                  currency={currency}
                  onCreateLoan={handleCreateLoan}
                />
              )}
            </TabsContent>

            {/* ── Table Tab ── */}
            <TabsContent value="table" className="space-y-6 mt-6">
              {compareResults && compareResults.map((r) => (
                <AmortizationTable key={r.termMonths} result={r} title={`${r.termMonths} meses`} />
              ))}
              {singleResult && singleResult.loanType === 'amortized' && (
                <AmortizationTable result={singleResult} title="Amortizado (Cuotas)" />
              )}
              {singleResult && singleResult.loanType === 'bullet' && (
                <BulletTable result={singleResult} title="Bullet (Descuento)" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Create Loan Dialog */}
      <Dialog open={createLoanOpen} onOpenChange={setCreateLoanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Préstamo desde Simulación</DialogTitle>
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
                  <p className="font-bold">{createLoanDefaults.termMonths} meses</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Inicio</p>
                  <p className="font-bold">{createLoanDefaults.startDate}</p>
                </div>
              </div>
            )}
            {createLoanMutation.error && (
              <p className="text-sm text-red-500">{createLoanMutation.error.message}</p>
            )}
            {createLoanMutation.isSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">Préstamo creado exitosamente</p>
            )}
            <Button type="submit" className="w-full" disabled={createLoanMutation.isPending || createLoanMutation.isSuccess}>
              {createLoanMutation.isPending ? 'Creando...' : createLoanMutation.isSuccess ? 'Creado' : 'Crear Préstamo'}
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
    success: 'text-green-600 dark:text-green-400',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
  }

  return (
    <div className="space-y-1 min-w-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className={cn("text-lg lg:text-xl font-black truncate", colors[variant])}>{value}</p>
      {subvalue && <p className="text-xs text-muted-foreground truncate">{subvalue}</p>}
    </div>
  )
}

function ConvenienceIndicator({ isConvenient, spread }: { isConvenient: boolean; spread: number }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-3 rounded-xl border",
      isConvenient
        ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
        : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
    )}>
      {isConvenient ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
      <div>
        <p className="font-bold text-sm">
          {isConvenient ? 'CONVIENE' : 'NO CONVIENE'}
        </p>
        <p className="text-xs opacity-80">
          Spread: {spread > 0 ? '+' : ''}{spread.toFixed(2)} pp vs hurdle rate
        </p>
      </div>
    </div>
  )
}

function ResultCardContent({ result, title, onCreateLoan }: { result: SimulationResult; title: string; onCreateLoan?: (result: SimulationResult) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {result.loanType === 'amortized'
            ? <TrendingUp className="h-5 w-5 text-blue-500" />
            : <TrendingDown className="h-5 w-5 text-amber-500" />
          }
          {title}
        </CardTitle>
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
            variant={result.isConvenient ? 'success' : 'danger'}
          />
          {result.loanType === 'amortized' && (
            <>
              <MetricCard
                label="Cuota Mensual"
                value={formatCurrency(result.installmentAmount!)}
              />
              <MetricCard
                label="Total Cobrado"
                value={formatCurrency(result.totalPaid!)}
                subvalue={`Ganancia: ${formatCurrency(result.totalPaid! - result.capital)}`}
              />
            </>
          )}
          {result.loanType === 'bullet' && (
            <>
              <MetricCard
                label="Precio Hoy (Descuento)"
                value={formatCurrency(result.discountPrice!)}
              />
              <MetricCard
                label="Valor Nominal al Vto."
                value={formatCurrency(result.nominalValue!)}
                subvalue={`Ganancia: ${formatCurrency(result.nominalValue! - result.discountPrice!)}`}
              />
            </>
          )}
        </div>
        <ConvenienceIndicator isConvenient={result.isConvenient} spread={result.spread} />
        {result.loanType === 'amortized' && onCreateLoan && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onCreateLoan(result)}
          >
            <Banknote className="h-4 w-4 mr-2" />
            Crear Préstamo con estos parámetros
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function CompareTermsResultCards({ results, onCreateLoan }: { results: SimulationResult[]; onCreateLoan?: (result: SimulationResult) => void }) {
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
          title={`${result.termMonths} meses`}
          onCreateLoan={onCreateLoan}
        />
      ))}
    </div>
  )
}

function SingleResultCards({ result, onCreateLoan }: { result: SimulationResult; onCreateLoan?: (result: SimulationResult) => void }) {
  const title = result.loanType === 'amortized' ? 'Amortizado (Cuotas)' : 'Bullet (Descuento)'
  return <ResultCardContent result={result} title={title} onCreateLoan={onCreateLoan} />
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
                  <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">{formatCurrency(row.interest)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(row.principal)}</td>
                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(row.balance)}</td>
                  <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">{formatCurrency(row.accruedReturn)}</td>
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
}

function InstallmentPlanCard({
  termMonths,
  installmentAmount,
  currency,
  isRecommended,
  isSelected,
  onSelect,
  formatClean,
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
            {termMonths} cuotas
          </p>
          <p className="text-2xl font-black text-foreground">
            {formatClean(installmentAmount)}
          </p>
          <p className="text-xs text-muted-foreground">por mes</p>
        </CardContent>
      </Card>
    </div>
  )
}

function ShareableSimulationView({
  results,
  currency,
  onCreateLoan,
}: {
  results: SimulationResult[]
  currency: string
  onCreateLoan?: (result: SimulationResult) => void
}) {
  const [copied, setCopied] = useState(false)
  const [imageGenerated, setImageGenerated] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  if (results.length === 0) return null

  const capital = results[0].capital
  const maxTermIndex = results.reduce((maxI, r, i, arr) =>
    r.termMonths > arr[maxI].termMonths ? i : maxI, 0
  )
  const [selectedIndex, setSelectedIndex] = useState<number>(maxTermIndex)
  const selectedResult = results[selectedIndex] ?? null
  const lowestInstallment = results[maxTermIndex]

  // No-decimal currency formatter for clean display
  const fmtClean = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

  // ─── Clipboard copy ────────────────────────────────────────────────
  const handleCopyText = useCallback(async () => {
    const lines = [
      `💰 *Simulación de préstamo*`,
      ``,
      `Monto: ${fmtClean(capital)}`,
      ``,
      ...results.map(r => {
        const amt = r.roundedInstallmentAmount || r.installmentAmount || r.nominalValue || 0
        return r.loanType === 'amortized'
          ? `${r.termMonths} cuotas de ${fmtClean(amt)}`
          : `${r.termMonths} meses → ${fmtClean(amt)}`
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
      ctx.fillText(`${r.termMonths} CUOTAS`, cx, cardY + 40)

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
                  Plan seleccionado: {selectedResult.termMonths} cuotas de{' '}
                  {fmtClean(selectedResult.roundedInstallmentAmount || selectedResult.installmentAmount || selectedResult.nominalValue || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cuotas fijas.
                </p>
              </div>
            </div>
            {onCreateLoan && selectedResult.loanType === 'amortized' && (
              <Button
                onClick={() => onCreateLoan(selectedResult)}
                className="w-full sm:w-auto shrink-0"
              >
                Continuar con este plan
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
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

function BulletTable({ result, title }: { result: SimulationResult; title: string }) {
  if (!result.bulletMonthlySummary) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title} - Devengamiento Mensual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Mes</th>
                <th className="text-left py-2 px-3 font-medium">Fecha</th>
                <th className="text-right py-2 px-3 font-medium">Valor Contable</th>
                <th className="text-right py-2 px-3 font-medium">Deveng. Mensual</th>
                <th className="text-right py-2 px-3 font-medium">Rend. Acum.</th>
              </tr>
            </thead>
            <tbody>
              {result.bulletMonthlySummary.map((row) => (
                <tr key={row.month} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium">{row.month}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.date}</td>
                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(row.accruedValue)}</td>
                  <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">{formatCurrency(row.monthlyAccrual)}</td>
                  <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">{formatCurrency(row.accruedReturn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
