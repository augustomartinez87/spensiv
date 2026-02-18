'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  ShieldAlert,
  ShieldCheck,
  Shield,
  ShieldX,
  CircleDollarSign,
  HelpCircle,
} from 'lucide-react'

const PIE_COLORS = [
  '#128DDA', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316',
]

const CATEGORY_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  bajo: { label: 'Bajo', color: 'text-green-600 dark:text-green-400', dotColor: 'bg-green-500' },
  medio: { label: 'Medio', color: 'text-yellow-600 dark:text-yellow-400', dotColor: 'bg-yellow-500' },
  alto: { label: 'Alto', color: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500' },
  critico: { label: 'Crítico', color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
}

export default function PortfolioPage() {
  const [fciRate, setFciRate] = useState('40')
  const fciRateDecimal = parseFloat(fciRate || '0') / 100

  const { data: metrics, isLoading: metricsLoading } = trpc.portfolio.getMetrics.useQuery(
    { fciRate: fciRateDecimal },
    { enabled: !isNaN(fciRateDecimal) }
  )
  const { data: alerts } = trpc.portfolio.getConcentrationAlerts.useQuery()
  const { data: riskBreakdown } = trpc.portfolio.getRiskBreakdown.useQuery()
  const { data: evolution } = trpc.portfolio.getEvolutionData.useQuery()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Cartera</h1>
          <p className="text-muted-foreground mt-1">
            Dashboard de riesgo crediticio
            {metrics?.mepRate && (
              <span className="ml-2 text-xs text-muted-foreground/70">· TC MEP: {formatCurrency(metrics.mepRate)}</span>
            )}
          </p>
        </div>
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <Label htmlFor="fciRate" className="text-sm text-muted-foreground">Tasa libre de riesgo (%)</Label>
              <UITooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px]">
                  <p className="text-xs">Rendimiento de referencia sin riesgo (ej: FCI money market o plazo fijo). Se usa para calcular el valor esperado de la cartera.</p>
                </TooltipContent>
              </UITooltip>
            </div>
            <Input
              id="fciRate"
              type="number"
              value={fciRate}
              onChange={(e) => setFciRate(e.target.value)}
              className="w-20 h-9"
              step="1"
              min="0"
            />
          </div>
        </TooltipProvider>
      </div>

      {/* Stat cards */}
      {metricsLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : metrics ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Capital Total"
            value={formatCurrency(metrics.totalCapital)}
            icon={Banknote}
            color="text-foreground"
          />
          <StatCard
            label="Préstamos Activos"
            value={metrics.activeLoansCount.toString()}
            icon={CircleDollarSign}
            color="text-foreground"
          />
          <StatCard
            label="Capital en Mora"
            value={formatCurrency(metrics.overdueCapital)}
            icon={AlertTriangle}
            color={metrics.overdueCapital > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
          />
          <StatCard
            label="Valor Esperado"
            value={formatCurrency(metrics.totalEV)}
            icon={TrendingUp}
            color={metrics.totalEV >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pie: Distribution by person */}
        {metrics && metrics.exposures.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribución por deudor</CardTitle>
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
                        borderRadius: '8px',
                        fontSize: '12px',
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

        {/* Bar: Evolution */}
        {evolution && evolution.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Capital prestado por mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="capital" fill="#128DDA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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

      {/* Alerts panel */}
      <AlertsPanel alerts={alerts} riskBreakdown={riskBreakdown} />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
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
        <p className={cn('text-xl font-bold mt-1', color)}>{value}</p>
      </CardContent>
    </Card>
  )
}

function AlertsPanel({
  alerts,
  riskBreakdown,
}: {
  alerts: { name: string; percentage: number; capital: number }[] | undefined
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
            className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm">
              <strong>{alert.name}</strong> concentra {alert.percentage.toFixed(1)}% del capital ({formatCurrency(alert.capital)})
            </span>
          </div>
        ))}
        {criticalPersons.map((person) => (
          <div
            key={person.name}
            className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400"
          >
            <ShieldX className="h-4 w-4 shrink-0" />
            <span className="text-sm">
              <strong>{person.name}</strong> tiene score critico ({person.score}) — no se recomienda prestar
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
