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
  Zap,
} from 'lucide-react'

const PIE_COLORS = [
  'hsl(var(--chart-income))', 'hsl(var(--chart-green))', '#f59e0b', 'hsl(var(--accent-danger))', '#8b5cf6',
  '#ec4899', 'hsl(var(--accent-cyan))', '#f97316',
]

const CATEGORY_CONFIG: Record<string, { label: string; color: string; dotColor: string; dotGlow: string }> = {
  bajo: { label: 'Bajo', color: 'text-emerald-400', dotColor: 'bg-emerald-500', dotGlow: 'shadow-[0_0_6px_rgba(16,185,129,0.5)]' },
  medio: { label: 'Medio', color: 'text-yellow-400', dotColor: 'bg-yellow-500', dotGlow: 'shadow-[0_0_6px_rgba(234,179,8,0.5)]' },
  alto: { label: 'Alto', color: 'text-orange-400', dotColor: 'bg-orange-500', dotGlow: 'shadow-[0_0_6px_rgba(249,115,22,0.5)]' },
  critico: { label: 'Crítico', color: 'text-accent-danger', dotColor: 'bg-red-500', dotGlow: 'shadow-[0_0_8px_rgba(239,68,68,0.8)]' },
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
          <h1 className="text-2xl font-bold tracking-tight">Cartera</h1>
          <p className="text-muted-foreground mt-1">
            Dashboard de inversión crediticia
          </p>
        </div>
        <TooltipProvider>
          <div className="flex items-center gap-3">
            {metrics?.mepRate && (
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border shadow-sm cursor-help">
                    <div className="flex flex-col">
                      <span className="uppercase text-[10px] font-semibold text-muted-foreground tracking-widest leading-none mb-0.5">Dólar MEP</span>
                      <span className="text-sm font-medium text-foreground tabular-nums leading-none">{formatCurrency(metrics.mepRate)}</span>
                    </div>
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
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-64 lg:col-span-5" />
          <div className="lg:col-span-7 grid gap-4 grid-cols-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      ) : error ? (
        <Card className="border-accent-danger/30 bg-accent-danger/5">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-accent-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">
                No se pudieron calcular las métricas de rendimiento. Revisá préstamos activos con montos o cuotas inválidas.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : yieldMetrics && metrics ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Yield Hero Card */}
          <Card className="lg:col-span-5 border-2 relative overflow-hidden group">
            {/* Decorative gradient blob */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[60px] pointer-events-none transition-opacity group-hover:opacity-100 opacity-70" />

            <CardContent className="p-6 relative">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Rendimiento Efectivo</p>
              </div>

              {/* TEM ponderada — métrica principal */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-accent-positive tabular-nums tracking-tighter">
                      {(yieldMetrics.weightedTEM * 100).toFixed(2)}%
                    </span>
                    <span className="text-lg font-medium text-primary">TEM</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Tasa efectiva mensual ponderada · todos los préstamos</p>
                </div>

                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(yieldMetrics.monthlyIncomeExpected)}</p>
                    <p className="text-xs text-muted-foreground">Ingreso mensual esperado</p>
                  </div>
                  {yieldMetrics.amortizedLoansCount > 0 && (
                    <div className="border-l border-border pl-4">
                      <p className="text-base font-semibold text-accent-blue tabular-nums">
                        {(yieldMetrics.weightedIRR * 100).toFixed(1)}% <span className="text-xs font-normal text-muted-foreground">TIR anual</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Ponderada · {yieldMetrics.amortizedLoansCount} amortizados</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Interés cobrado / proyectado */}
              <div className="mt-6 pt-6 border-t border-border/50">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Interés cobrado / proyectado</span>
                  <span className="font-medium text-foreground tabular-nums">{(yieldMetrics.interestRatio * 100).toFixed(0)}%</span>
                </div>
                <Progress value={yieldMetrics.interestRatio * 100} className="h-2.5" />
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground tabular-nums">
                  <span>{formatCurrency(yieldMetrics.interestCollected)}</span>
                  <span>{formatCurrency(yieldMetrics.interestProjected)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stat Cards */}
          <div className="lg:col-span-7 grid gap-4 sm:gap-6 grid-cols-2">
            <PortfolioStatCard
              label="Capital Total"
              value={formatCurrency(metrics.totalCapital)}
              icon={Banknote}
              color="text-foreground"
              iconBg="bg-muted"
            />
            <PortfolioStatCard
              label="Capital en Mora"
              value={formatCurrency(metrics.overdueCapital)}
              icon={AlertTriangle}
              color={metrics.overdueCapital > 0 ? 'text-accent-danger' : 'text-foreground'}
              iconBg={metrics.overdueCapital > 0 ? 'bg-accent-danger/10' : 'bg-muted'}
              iconColor={metrics.overdueCapital > 0 ? 'text-accent-danger' : undefined}
            />
            <PortfolioStatCard
              label="Valor Esperado"
              value={formatCurrency(metrics.totalEV)}
              subtitle={`${metrics.totalEV >= metrics.totalCapital ? '+' : ''}${formatCurrency(metrics.totalEV - metrics.totalCapital)} proyectado`}
              icon={TrendingUp}
              color={metrics.totalEV >= 0 ? 'text-accent-positive' : 'text-accent-danger'}
              iconBg="bg-accent-positive/10"
              iconColor="text-accent-positive"
            />
            <PortfolioStatCard
              label="Eficiencia de Capital"
              value={`${yieldMetrics.weightedDuration.toFixed(1)} meses`}
              subtitle={`${yieldMetrics.activeLoansCount} préstamos activos`}
              icon={Clock}
              color="text-foreground"
              iconBg="bg-purple-500/10"
              iconColor="text-purple-400"
            />
          </div>
        </div>
      ) : null}

      {/* Row 2: Cash Flow Projection */}
      {cashFlow && cashFlow.some((m) => m.total > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base">Flujo Proyectado (12 meses)</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Amortización de capital vs intereses</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(var(--chart-income))' }} />
                  <span className="text-muted-foreground">Capital</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'hsl(var(--chart-green))' }} />
                  <span className="text-muted-foreground">Interés</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 overflow-x-auto">
              <div className="h-full min-w-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => {
                      const [, m] = v.split('-')
                      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
                      return months[parseInt(m, 10) - 1]
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
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
                      backgroundColor: 'rgba(10, 10, 15, 0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                    }}
                  />
                  <Legend
                    formatter={(value: string) => value === 'principal' ? 'Capital' : 'Interés'}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Bar dataKey="principal" stackId="a" fill="hsl(var(--chart-income))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="interest" stackId="a" fill="hsl(var(--chart-green))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Concentration + Risk */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Pie: Distribution by person */}
        {metrics && metrics.exposures.length > 0 && (
          <Card className="lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribución por deudor</CardTitle>
              <div className="flex items-center gap-3 mt-2 text-xs tabular-nums font-medium bg-muted/50 p-2 rounded-lg w-fit">
                <div className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Top 1:</span>
                  <span className={cn(
                    'font-bold',
                    metrics.top1Percentage > 30 ? 'text-accent-danger'
                      : metrics.top1Percentage > 20 ? 'text-accent-warning'
                        : 'text-foreground'
                  )}>
                    {metrics.top1Percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Top 3:</span>
                  <span className={cn(
                    'font-bold',
                    metrics.top3Percentage > 70 ? 'text-accent-danger'
                      : metrics.top3Percentage > 50 ? 'text-accent-warning'
                        : 'text-foreground'
                  )}>
                    {metrics.top3Percentage.toFixed(1)}%
                  </span>
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
                      stroke="none"
                    >
                      {metrics.exposures.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(10, 10, 15, 0.95)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {metrics.exposures.map((e, i) => (
                  <div key={e.name} className="flex items-center justify-between text-sm hover:bg-muted/50 p-1 -mx-1 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-foreground font-medium truncate max-w-[140px]">{e.name}</span>
                    </div>
                    <span className="text-muted-foreground tabular-nums">
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
          <Card className={cn(
            metrics && metrics.exposures.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Deudores por riesgo</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 pb-2 border-b border-border text-xs uppercase text-muted-foreground font-semibold tracking-wider px-2">
                <div className="col-span-1 text-center">STS</div>
                <div className="col-span-5">Nombre</div>
                <div className="col-span-2 text-center">Score</div>
                <div className="col-span-4 text-right">Capital</div>
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {riskBreakdown.persons.map((p) => {
                  const cat = CATEGORY_CONFIG[p.category] || CATEGORY_CONFIG.bajo
                  const isCritical = p.category === 'critico'
                  return (
                    <div key={p.id} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-border/30 hover:bg-muted/50 px-2 rounded transition-colors cursor-default">
                      <div className="col-span-1 flex justify-center">
                        <div className={cn('w-2.5 h-2.5 rounded-full', cat.dotColor, cat.dotGlow)} />
                      </div>
                      <div className="col-span-5">
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{cat.label}</p>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-semibold tabular-nums border',
                          isCritical
                            ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/20'
                            : p.category === 'alto'
                              ? 'bg-accent-warning/10 text-accent-warning border-accent-warning/20'
                              : p.category === 'medio'
                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                : 'bg-accent-positive/10 text-accent-positive border-accent-positive/20'
                        )}>
                          {p.score}
                        </span>
                      </div>
                      <div className="col-span-4 text-right">
                        <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(p.capital)}</p>
                      </div>
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

function PortfolioStatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  iconBg = 'bg-muted',
  iconColor = 'text-muted-foreground',
}: {
  label: string
  value: string
  subtitle?: string
  icon: typeof Banknote
  color: string
  iconBg?: string
  iconColor?: string
}) {
  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', iconBg)}>
            <Icon className={cn('h-4 w-4', iconColor)} />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className={cn(
          value.length > 14 ? 'text-base font-bold' : value.length > 10 ? 'text-lg font-bold' : 'text-2xl font-bold',
          'tabular-nums', color
        )}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {concentrationAlerts.map((alert) => (
        <div
          key={alert.name}
          className={cn(
            'relative overflow-hidden p-4 rounded-xl border-l-4 flex gap-4 items-start',
            alert.severity === 'critical'
              ? 'bg-accent-danger/5 border border-accent-danger/20 border-l-accent-danger'
              : 'bg-accent-warning/5 border border-accent-warning/20 border-l-accent-warning'
          )}
        >
          {/* Gradient overlay */}
          <div className={cn(
            'absolute inset-0 pointer-events-none',
            alert.severity === 'critical'
              ? 'bg-gradient-to-r from-accent-danger/10 to-transparent'
              : 'bg-gradient-to-r from-accent-warning/10 to-transparent'
          )} />
          <AlertTriangle className={cn(
            'h-5 w-5 shrink-0 mt-0.5 relative z-10',
            alert.severity === 'critical' ? 'text-accent-danger' : 'text-accent-warning'
          )} />
          <span className={cn(
            'text-sm relative z-10',
            alert.severity === 'critical' ? 'text-red-200' : 'text-orange-200'
          )}>
            <strong>{alert.name}</strong> concentra {alert.percentage.toFixed(1)}% del capital ({formatCurrency(alert.capital)})
            {alert.severity === 'critical' && ' — Riesgo crítico de concentración'}
          </span>
        </div>
      ))}
      {criticalPersons.map((person) => (
        <div
          key={person.name}
          className="relative overflow-hidden p-4 rounded-xl border-l-4 border border-accent-danger/20 border-l-accent-danger bg-accent-danger/5 flex gap-4 items-start"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-accent-danger/10 to-transparent pointer-events-none" />
          <ShieldX className="h-5 w-5 shrink-0 mt-0.5 text-accent-danger relative z-10" />
          <span className="text-sm text-red-200 relative z-10">
            <strong>{person.name}</strong> tiene score crítico ({person.score}) — no se recomienda prestar
          </span>
        </div>
      ))}
    </div>
  )
}
