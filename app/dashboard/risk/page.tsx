'use client'

import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  TrendingDown,
  Zap,
  Users,
  Flame,
} from 'lucide-react'

const CATEGORY_CONFIG = {
  bajo: { label: 'Bajo', color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-500', border: 'border-green-500/30' },
  medio: { label: 'Medio', color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', border: 'border-yellow-500/30' },
  alto: { label: 'Alto', color: 'text-orange-400', bg: 'bg-orange-500/10', dot: 'bg-orange-500', border: 'border-orange-500/30' },
  critico: { label: 'Crítico', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500', border: 'border-red-500/30' },
} as const

const SCENARIO_CONFIG = [
  { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { icon: ShieldAlert, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { icon: ShieldX, color: 'text-red-400', bg: 'bg-red-500/10' },
  { icon: Flame, color: 'text-red-500', bg: 'bg-red-500/15' },
]

export default function RiskPage() {
  const { data, isLoading } = trpc.portfolio.getRiskAnalysis.useQuery()

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Análisis de Riesgo</h1>
          <p className="text-muted-foreground mt-1">Límites, tasas y stress test de tu cartera</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data || data.totalCapital === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Análisis de Riesgo</h1>
          <p className="text-muted-foreground mt-1">Límites, tasas y stress test de tu cartera</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay préstamos activos para analizar.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { riskLimits, stressResults, breakevenByCategory, portfolioHealth } = data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Análisis de Riesgo</h1>
        <p className="text-muted-foreground mt-1">
          Límites de exposición, tasas break-even y stress test · Plazo promedio: {data.avgTermMonths} meses
        </p>
      </div>

      {/* Health summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn(
          'border-2',
          portfolioHealth.overLimitCount > 0 ? 'border-orange-500/30' : 'border-green-500/30'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Personas con Exceso</p>
            </div>
            <p className={cn(
              'text-2xl font-bold',
              portfolioHealth.overLimitCount > 0 ? 'text-orange-400' : 'text-green-400'
            )}>
              {portfolioHealth.overLimitCount} <span className="text-sm font-normal text-muted-foreground">/ {portfolioHealth.totalPersons}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {portfolioHealth.overLimitCount > 0
                ? 'Deudores por encima del límite recomendado'
                : 'Todos dentro del límite'
              }
            </p>
          </CardContent>
        </Card>

        <Card className={cn(
          'border-2',
          portfolioHealth.worstScenarioLoss > 30 ? 'border-red-500/30' : portfolioHealth.worstScenarioLoss > 15 ? 'border-orange-500/30' : 'border-green-500/30'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Peor Escenario</p>
            </div>
            <p className={cn(
              'text-2xl font-bold',
              portfolioHealth.worstScenarioLoss > 30 ? 'text-red-400' : portfolioHealth.worstScenarioLoss > 15 ? 'text-orange-400' : 'text-green-400'
            )}>
              {portfolioHealth.worstScenarioLoss.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Pérdida máxima de cartera en stress test</p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital Total</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(data.totalCapital)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{portfolioHealth.totalPersons} deudores activos</p>
          </CardContent>
        </Card>
      </div>

      {/* Stress Test */}
      {stressResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Stress Test — ¿Qué pasa si defaultean?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {stressResults.map((result, idx) => {
                const config = SCENARIO_CONFIG[idx] ?? SCENARIO_CONFIG[0]
                const Icon = config.icon
                return (
                  <div
                    key={result.scenario.label}
                    className={cn('rounded-xl border p-4 space-y-3', config.bg)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-5 w-5', config.color)} />
                      <div>
                        <p className={cn('text-sm font-semibold', config.color)}>{result.scenario.label}</p>
                        <p className="text-xs text-muted-foreground">{result.scenario.description}</p>
                      </div>
                    </div>

                    {/* Who defaults */}
                    <div className="space-y-1">
                      {result.defaultedPersons.map((p) => (
                        <div key={p.personId ?? p.name} className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{p.name}</span>
                          <span className="text-muted-foreground">{formatCurrency(p.capital)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Impact */}
                    <div className="space-y-1.5 pt-2 border-t border-border/30">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Pérdida</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(result.capitalLost)} ({result.portfolioLostPct.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(result.portfolioLostPct, 100)}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capital restante</span>
                        <span className={cn(
                          'font-semibold',
                          result.survives ? 'text-green-400' : 'text-red-400'
                        )}>
                          {formatCurrency(result.remainingCapital)}
                        </span>
                      </div>
                      {result.monthlyIncomeLost > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Ingreso mensual perdido</span>
                          <span className="text-muted-foreground">{formatCurrency(result.monthlyIncomeLost)}/mes</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Limits per Person */}
      {riskLimits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-blue-500" />
              Límites de Exposición por Persona
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 pr-4 font-medium">Persona</th>
                    <th className="text-left py-2 pr-4 font-medium">Riesgo</th>
                    <th className="text-right py-2 pr-4 font-medium">Exposición</th>
                    <th className="text-right py-2 pr-4 font-medium">Límite</th>
                    <th className="text-center py-2 pr-4 font-medium">Uso</th>
                    <th className="text-right py-2 pr-4 font-medium">TNA Break-even</th>
                    <th className="text-right py-2 font-medium">TNA Sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {riskLimits.map((limit) => {
                    const cat = CATEGORY_CONFIG[limit.category]
                    return (
                      <tr key={limit.personId} className="border-b border-border/30">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {limit.overLimit && <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
                            <span className="font-medium text-foreground">{limit.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-2 h-2 rounded-full', cat.dot)} />
                            <span className={cn('text-xs font-medium', cat.color)}>
                              {cat.label} ({limit.score})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums font-medium">
                          {formatCurrency(limit.currentExposure)}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                          {limit.maxExposure > 0 ? formatCurrency(limit.maxExposure) : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress
                              value={Math.min(limit.usagePct, 100)}
                              className={cn('h-2 flex-1', limit.overLimit && '[&>div]:bg-orange-500')}
                            />
                            <span className={cn(
                              'text-xs tabular-nums font-medium min-w-[36px] text-right',
                              limit.usagePct > 100 ? 'text-orange-400' : 'text-muted-foreground'
                            )}>
                              {limit.usagePct > 999 ? '∞' : `${Math.round(limit.usagePct)}%`}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                          {(limit.breakevenTNA * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 text-right tabular-nums font-medium text-foreground">
                          {(limit.suggestedTNA * 100).toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakeven Rates by Category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Tasa Mínima por Categoría de Riesgo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Para un plazo promedio de {data.avgTermMonths} meses con LGD 100% (pérdida total en default)
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            {breakevenByCategory.map((item) => {
              const cat = CATEGORY_CONFIG[item.category]
              return (
                <div
                  key={item.category}
                  className={cn('rounded-xl border p-4', cat.bg, cat.border)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full', cat.dot)} />
                    <p className={cn('text-sm font-semibold', cat.color)}>{cat.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">PD: {(item.pd * 100).toFixed(0)}%</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Break-even</span>
                      <span className="font-semibold text-foreground">{(item.breakeven * 100).toFixed(1)}% TNA</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Sugerida (+10%)</span>
                      <span className={cn('font-bold', cat.color)}>{(item.suggested * 100).toFixed(1)}% TNA</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
