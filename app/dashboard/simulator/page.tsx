'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, formatDateToInput, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
} from 'lucide-react'
import type { SimulationResult, ComparisonResult } from '@/lib/loan-calculator'

const ComparisonChart = dynamic(
  () => import('@/components/simulator/comparison-chart').then(m => m.ComparisonChart),
  { ssr: false, loading: () => <div className="h-[350px] w-full animate-pulse bg-muted rounded-lg" /> }
)

const AccrualChart = dynamic(
  () => import('@/components/simulator/accrual-chart').then(m => m.AccrualChart),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse bg-muted rounded-lg" /> }
)

type ViewMode = 'single' | 'compare'

export default function SimulatorPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('compare')
  const [activeTab, setActiveTab] = useState('results')

  // Form state
  const [capital, setCapital] = useState('1000000')
  const [termMonths, setTermMonths] = useState('12')
  const [tnaTarget, setTnaTarget] = useState('55')
  const [hurdleRate, setHurdleRate] = useState('40')
  const [loanType, setLoanType] = useState<'bullet' | 'amortized'>('amortized')
  const [accrualType, setAccrualType] = useState<'linear' | 'exponential'>('exponential')
  const [customInstallment, setCustomInstallment] = useState('')
  const [impliedTna, setImpliedTna] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(formatDateToInput(new Date()))

  // Results
  const [singleResult, setSingleResult] = useState<SimulationResult | null>(null)
  const [compareResult, setCompareResult] = useState<ComparisonResult | null>(null)

  const simulateMutation = trpc.loans.simulate.useMutation({
    onSuccess: (data) => setSingleResult(data),
  })

  const compareMutation = trpc.loans.compare.useMutation({
    onSuccess: (data) => setCompareResult(data),
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

  const isLoading = simulateMutation.isPending || compareMutation.isPending

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

  function handleSimulate() {
    const baseInput = {
      capital: parseFloat(capital),
      termMonths: parseInt(termMonths),
      tnaTarget: parseFloat(tnaTarget) / 100,
      hurdleRate: parseFloat(hurdleRate) / 100,
      accrualType: accrualType as 'linear' | 'exponential',
      startDate,
      ...(customInstallment ? { customInstallment: parseFloat(customInstallment) } : {}),
    }

    if (viewMode === 'compare') {
      compareMutation.mutate(baseInput)
      setSingleResult(null)
    } else {
      simulateMutation.mutate({ ...baseInput, loanType })
      setCompareResult(null)
    }
    setActiveTab('results')
  }

  // Create Loan dialog state
  const [createLoanOpen, setCreateLoanOpen] = useState(false)
  const [createLoanDefaults, setCreateLoanDefaults] = useState<{
    capital: string; tna: string; termMonths: string; startDate: string
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
    })
    setCreateLoanOpen(true)
  }

  function submitCreateLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!createLoanDefaults) return
    createLoanMutation.mutate({
      borrowerName,
      capital: parseFloat(createLoanDefaults.capital),
      tna: parseFloat(createLoanDefaults.tna) / 100,
      termMonths: parseInt(createLoanDefaults.termMonths),
      startDate: createLoanDefaults.startDate,
    })
  }

  const hasResults = singleResult || compareResult

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Simulador de Crédito</h1>
        <p className="text-muted-foreground mt-1">
          Compará rendimiento por descuento (bullet) vs préstamo amortizado (cuotas)
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
              Comparar Ambos
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
              <Label htmlFor="capital">Capital (ARS)</Label>
              <Input
                id="capital"
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="1000000"
              />
            </div>

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

          <Button onClick={handleSimulate} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Calculando...' : 'Simular'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {hasResults && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">Resultados</TabsTrigger>
            <TabsTrigger value="table">Tabla de Flujos</TabsTrigger>
            <TabsTrigger value="chart">Gráficos</TabsTrigger>
          </TabsList>

          {/* ── Results Tab ── */}
          <TabsContent value="results" className="space-y-6 mt-6">
            {compareResult && <CompareResultCards result={compareResult} onCreateLoan={handleCreateLoan} />}
            {singleResult && <SingleResultCards result={singleResult} onCreateLoan={handleCreateLoan} />}
          </TabsContent>

          {/* ── Table Tab ── */}
          <TabsContent value="table" className="space-y-6 mt-6">
            {compareResult && (
              <>
                <AmortizationTable result={compareResult.amortized} title="Amortizado (Cuotas)" />
                <BulletTable result={compareResult.bullet} title="Bullet (Descuento)" />
              </>
            )}
            {singleResult && singleResult.loanType === 'amortized' && (
              <AmortizationTable result={singleResult} title="Amortizado (Cuotas)" />
            )}
            {singleResult && singleResult.loanType === 'bullet' && (
              <BulletTable result={singleResult} title="Bullet (Descuento)" />
            )}
          </TabsContent>

          {/* ── Chart Tab ── */}
          <TabsContent value="chart" className="space-y-6 mt-6">
            {compareResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rendimiento Acumulado Comparativo</CardTitle>
                  <CardDescription>Devengamiento acumulado: amortizado vs bullet</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ComparisonChart
                      amortizedCurve={compareResult.amortized.accruedCurve}
                      bulletCurve={compareResult.bullet.accruedCurve}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            {singleResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Devengamiento Acumulado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <AccrualChart
                      data={singleResult.accruedCurve}
                      color={singleResult.loanType === 'amortized' ? '#3b82f6' : '#f59e0b'}
                      label={singleResult.loanType === 'amortized' ? 'Interés Acumulado' : 'Devengamiento'}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Create Loan Dialog */}
      <Dialog open={createLoanOpen} onOpenChange={setCreateLoanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Prestamo desde Simulacion</DialogTitle>
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
              <p className="text-sm text-green-600 dark:text-green-400">Prestamo creado exitosamente</p>
            )}
            <Button type="submit" className="w-full" disabled={createLoanMutation.isPending || createLoanMutation.isSuccess}>
              {createLoanMutation.isPending ? 'Creando...' : createLoanMutation.isSuccess ? 'Creado' : 'Crear Prestamo'}
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
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className={cn("text-2xl font-black", colors[variant])}>{value}</p>
      {subvalue && <p className="text-xs text-muted-foreground">{subvalue}</p>}
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
        <div className="grid grid-cols-2 gap-4">
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
            Crear Prestamo con estos parametros
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function CompareResultCards({ result, onCreateLoan }: { result: ComparisonResult; onCreateLoan?: (result: SimulationResult) => void }) {
  const recLabel =
    result.recommendation === 'amortized'
      ? 'Amortizado'
      : result.recommendation === 'bullet'
        ? 'Bullet'
        : 'Ninguno'

  return (
    <>
      {/* Recommendation banner */}
      <Card className={cn(
        "border-2",
        result.recommendation === 'neither'
          ? "border-red-500/30 bg-red-500/5"
          : "border-green-500/30 bg-green-500/5"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-bold text-foreground">
                Recomendación: <span className={result.recommendation === 'neither' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>{recLabel}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Diferencia de TIR: {result.tirDifference > 0 ? '+' : ''}{result.tirDifference.toFixed(2)} pp a favor del amortizado
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <ResultCardContent result={result.amortized} title="Amortizado (Cuotas)" onCreateLoan={onCreateLoan} />
        <ResultCardContent result={result.bullet} title="Bullet (Descuento)" />
      </div>
    </>
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
                <th className="text-right py-2 px-3 font-medium">Interés</th>
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
