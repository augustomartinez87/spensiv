'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Banknote,
  TrendingUp,
  AlertTriangle,
  ShieldX,
  Target,
  Clock,
  Percent,
} from 'lucide-react'

const PIE_COLORS = [
  '#128DDA', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316',
]

const CATEGORY_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  bajo: { label: 'Bajo', color: 'text-green-400', dotColor: 'bg-green-500' },
  medio: { label: 'Medio', color: 'text-yellow-400', dotColor: 'bg-yellow-500' },
  alto: { label: 'Alto', color: 'text-orange-400', dotColor: 'bg-orange-500' },
  critico: { label: 'Crítico', color: 'text-red-400', dotColor: 'bg-red-500' },
}

export default function PortfolioPage() {
  const { data, isLoading, error } = trpc.portfolio.getFullPortfolio.useQuery()

  const metrics = data?.metrics
  const yieldMetrics = data?.yieldMetrics
  const cashFlow = data?.cashFlow
  const alerts = data?.alerts
  const riskBreakdown = data?.riskBreakdown

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Cartera</h1>
          <p className="text-muted-foreground mt-1">
            Dashboard de inversión crediticia
          </p>
        </div>
        <TooltipProvider>
          <div className="flex items-center gap-3">
            {metrics?.mepRate && (
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm cursor-help">
                    <span className="text-muted-foreground">💱 MEP</span>
                    <span className="font-semibold text-foreground">{formatCurrency(metrics.mepRate)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  <p className="text-xs">Cotización del dólar MEP. Se usa para convertir préstamos en USD/EUR a pesos en las métricas de cartera.</p>
                </TooltipContent>
              </UITooltip>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* Row 1: Yield Hero + Stat Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <Skeleton className="h-48" />
          <div className="grid gap-4 grid-cols-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[88px]" />)}
          </div>
        </div>
      ) : error ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">
                No se pudieron calcular las métricas de rendimiento. Revisá préstamos activos con montos o cuotas inválidas.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : yieldMetrics && metrics ? (
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          {/* Yield Hero Card */}
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rendimiento Efectivo</p>
              </div>

              {/* TEM ponderada — métrica principal */}
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold text-accent-positive">
                    {(yieldMetrics.weightedTEM * 100).toFixed(2)}% <span className="text-lg font-medium text-muted-foreground">TEM</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tasa efectiva mensual ponderada · todos los préstamos</p>
                </div>

                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(yieldMetrics.monthlyIncomeExpected)}</p>
                    <p className="text-xs text-muted-foreground">Ingreso mensual esperado</p>
                  </div>
                  {yieldMetrics.amortizedLoansCount > 0 && (
                    <div className="border-l border-border pl-4">
                      <p className="text-base font-semibold text-accent-blue">
                        {(yieldMetrics.weightedIRR * 100).toFixed(1)}% <span className="text-xs font-normal text-muted-foreground">TIR anual</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Ponderada · {yieldMetrics.amortizedLoansCount} amortizados</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Interés cobrado / proyectado */}
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Interés cobrado / proyectado (acumulado)</span>
                  <span className="font-medium text-foreground">{(yieldMetrics.interestRatio * 100).toFixed(0)}%</span>
                </div>
                <Progress value={yieldMetrics.interestRatio * 100} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(yieldMetrics.interestCollected)}</span>
                  <span>{formatCurrency(yieldMetrics.interestProjected)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stat Cards */}
          <div className="grid gap-4 grid-cols-2">
            <StatCard
              label="Capital Total"
              value={formatCurrency(metrics.totalCapital)}
              icon={Banknote}
              color="text-foreground"
            />
            <StatCard
              label="Capital en Mora"
              value={formatCurrency(metrics.overdueCapital)}
              icon={AlertTriangle}
              color={metrics.overdueCapital > 0 ? 'text-accent-danger' : 'text-foreground'}
            />
            <StatCard
              label="Valor Esperado"
              value={formatCurrency(metrics.totalEV)}
              subtitle={`${metrics.totalEV >= metrics.totalCapital ? '+' : ''}${formatCurrency(metrics.totalEV - metrics.totalCapital)} proyectado`}
              icon={TrendingUp}
              color={metrics.totalEV >= 0 ? 'text-accent-positive' : 'text-accent-danger'}
            />
            <StatCard
              label="Eficiencia de Capital"
              value={`${yieldMetrics.weightedDuration.toFixed(1)} meses`}
              subtitle={`${yieldMetrics.activeLoansCount} préstamos activos`}
              icon={Clock}
              color="text-foreground"
            />
          </div>
        </div>
      ) : null}

      {/* Row 2: Cash Flow Projection */}
      {cashFlow && cashFlow.some((m) => m.total > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flujo Proyectado (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 overflow-x-auto">
              <div className="h-full min-w-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: string) => {
                      const [, m] = v.split('-')
                      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
                      return months[parseInt(m, 10) - 1]
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'principal' ? 'Capital' : 'Interés',
                    ]}
                    labelFormatter={(label: string) => {
                      const [y, m] = label.split('-')
                      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                      return `${months[parseInt(m, 10) - 1]} ${y}`
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    formatter={(value: string) => value === 'principal' ? 'Capital' : 'Interés'}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Bar dataKey="principal" stackId="a" fill="#128DDA" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="interest" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Concentration */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pie: Distribution by person */}
        {metrics && metrics.exposures.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Distribución por deudor</CardTitle>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Top 1:</span>
                    <span className={cn(
                      'font-bold',
                      metrics.top1Percentage > 30 ? 'text-red-400'
                        : metrics.top1Percentage > 20 ? 'text-amber-400'
                          : 'text-foreground'
                    )}>
                      {metrics.top1Percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Top 3:</span>
                    <span className={cn(
                      'font-bold',
                      metrics.top3Percentage > 70 ? 'text-red-400'
                        : metrics.top3Percentage > 50 ? 'text-amber-400'
                          : 'text-foreground'
                    )}>
                      {metrics.top3Percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.exposures.map((e) => ({
                        name: e.name,
                        value: e.capital,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {metrics.exposures.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {metrics.exposures.map((e, i) => (
                  <div key={e.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-foreground">{e.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatCurrency(e.capital)} ({e.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk breakdown */}
        {riskBreakdown && riskBreakdown.persons.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Deudores por riesgo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {riskBreakdown.persons.map((p) => {
                  const cat = CATEGORY_CONFIG[p.category]
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-2.5 h-2.5 rounded-full', cat.dotColor)} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">Score: {p.score} · {cat.label}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(p.capital)}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 4: Alerts */}
      <AlertsPanel alerts={alerts} riskBreakdown={riskBreakdown} />
    </div>
  )
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  subtitle?: string
  icon: typeof Banknote
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
        <p className={cn(
          value.length > 14 ? 'text-base font-bold' : value.length > 10 ? 'text-lg font-bold' : 'text-xl font-bold',
          'mt-1', color
        )}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function AlertsPanel({
  alerts,
  riskBreakdown,
}: {
  alerts: { name: string; percentage: number; capital: number; severity: 'warning' | 'critical' }[] | undefined
  riskBreakdown: { persons: { name: string; score: number; category: string }[] } | undefined
}) {
  const concentrationAlerts = alerts || []
  const criticalPersons = (riskBreakdown?.persons || []).filter((p) => p.score < 4)

  if (concentrationAlerts.length === 0 && criticalPersons.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {concentrationAlerts.map((alert) => (
          <div
            key={alert.name}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg',
              alert.severity === 'critical'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-amber-500/10 text-amber-400'
            )}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm">
              <strong>{alert.name}</strong> concentra {alert.percentage.toFixed(1)}% del capital ({formatCurrency(alert.capital)})
              {alert.severity === 'critical' && ' — Riesgo crítico de concentración'}
            </span>
          </div>
        ))}
        {criticalPersons.map((person) => (
          <div
            key={person.name}
            className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 text-red-400"
          >
            <ShieldX className="h-4 w-4 shrink-0" />
            <span className="text-sm">
              <strong>{person.name}</strong> tiene score crítico ({person.score}) — no se recomienda prestar
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
