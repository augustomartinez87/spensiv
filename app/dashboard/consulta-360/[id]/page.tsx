'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { formatCuit } from '@/lib/cuit'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, ShieldCheck, Link2, Trash2, Save, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ScoreGauge } from '@/components/consulta-360/score-gauge'
import { ScoreBreakdown } from '@/components/consulta-360/score-breakdown'
import { EntidadesTable } from '@/components/consulta-360/entidades-table'
import { BarChart24 } from '@/components/consulta-360/barchart-24'
import { ChequesSection } from '@/components/consulta-360/cheques-section'
import { AfipSection } from '@/components/consulta-360/afip-section'
import { DeudaDistribution } from '@/components/consulta-360/deuda-distribution'
import { EntidadHeatmap } from '@/components/consulta-360/entidad-heatmap'
import { ScoreSparkline } from '@/components/consulta-360/score-sparkline'
import {
  ExecutiveSummary,
  buildExecutiveSummary,
} from '@/components/consulta-360/executive-summary'
import { ExportPdfButton } from '@/components/consulta-360/pdf/export-button'
import {
  formatPeriodoLargo,
  formatPeriodoCorto,
  antiguedadDelPeriodo,
} from '@/lib/consulta-360/periodo'
import { frasePermanencia } from '@/lib/consulta-360/historico-aux'
import {
  parseBcraDeudas,
  parseBcraHistoricas,
  parseBcraCheques,
  parseAfip,
  parseScoreResult,
} from '@/lib/consulta-360/parse'
import type { RiesgoBanda } from '@/lib/consulta-360/types'

export default function ConsultaDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const { user } = useUser()
  const solicitante = user?.fullName || user?.primaryEmailAddress?.emailAddress || null

  const { data: consulta, isLoading } = trpc.consulta360.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  )

  const { data: persons } = trpc.persons.list.useQuery()
  const { data: previa } = trpc.consulta360.comparativa.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  )

  const cuitForHistory = consulta?.cuit
  const { data: scoreHistory } = trpc.consulta360.scoreHistory.useQuery(
    { cuit: cuitForHistory ?? '' },
    { enabled: !!cuitForHistory }
  )
  const { data: consultasPorMes } = trpc.consulta360.consultasPorMes.useQuery(
    { cuit: cuitForHistory ?? '', meses: 6 },
    { enabled: !!cuitForHistory }
  )

  const reConsultar = trpc.consulta360.reConsultar.useMutation({
    onSuccess: (res) => {
      utils.consulta360.getById.invalidate({ id: params.id })
      utils.consulta360.comparativa.invalidate({ id: params.id })
      utils.consulta360.recent.invalidate()
      toast({
        title: 'Consulta actualizada',
        description: `Score ${res.summary.score.score} · ${res.summary.score.bandaLabel}`,
      })
    },
    onError: (e) =>
      toast({ variant: 'destructive', title: 'No se pudo actualizar', description: e.message }),
  })

  const linkPersona = trpc.consulta360.linkPersona.useMutation({
    onSuccess: () => {
      utils.consulta360.getById.invalidate({ id: params.id })
      toast({ title: 'Vinculación actualizada' })
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  })

  const updateObs = trpc.consulta360.updateObservaciones.useMutation({
    onSuccess: () => {
      utils.consulta360.getById.invalidate({ id: params.id })
      toast({ title: 'Nota guardada' })
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  })

  const deleteMut = trpc.consulta360.delete.useMutation({
    onSuccess: () => {
      toast({ title: 'Consulta eliminada' })
      router.push('/dashboard/consulta-360')
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  })

  const [obs, setObs] = useState<string | null>(null)
  const obsValue = obs ?? consulta?.observaciones ?? ''

  const score = useMemo(
    () => parseScoreResult(consulta?.scoreBreakdown ?? null),
    [consulta]
  )
  const bcraDeudas = useMemo(
    () => parseBcraDeudas(consulta?.payloadBcra ?? null),
    [consulta]
  )
  const bcraHist = useMemo(
    () => parseBcraHistoricas(consulta?.payloadHistorico ?? null),
    [consulta]
  )
  const bcraCheques = useMemo(
    () => parseBcraCheques(consulta?.payloadCheques ?? null),
    [consulta]
  )
  const afipData = useMemo(
    () => parseAfip(consulta?.payloadAfip ?? null),
    [consulta]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-1" />
          <Skeleton className="h-64 md:col-span-2" />
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (!consulta || !score) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/consulta-360"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Consulta no encontrada.
          </CardContent>
        </Card>
      </div>
    )
  }

  const latestPeriodo = bcraDeudas?.results?.periodos?.[0]
  const periodos = bcraHist?.results?.periodos ?? []
  const banda = consulta.riesgo as RiesgoBanda

  const periodoCorto = formatPeriodoCorto(latestPeriodo?.periodo)
  const periodoLargo = formatPeriodoLargo(latestPeriodo?.periodo)
  const mesesDelPeriodo = antiguedadDelPeriodo(latestPeriodo?.periodo)

  const narrativaPermanencia = frasePermanencia(bcraHist, bcraDeudas)

  // Resumen ejecutivo
  const resumen = buildExecutiveSummary({
    denominacion: consulta.denominacion,
    riesgo: banda,
    score: consulta.score,
    bcraDeudas,
    bcraHistoricas: bcraHist,
    bcraCheques,
    afip: afipData,
  })

  // Helper para alertas críticas
  const criticalFlags = new Set<string>()
  latestPeriodo?.entidades.forEach((e) => {
    if (e.situacionJuridica) criticalFlags.add('Situación Jurídica')
    if (e.irrecDisposicionTecnica) criticalFlags.add('Irrecuperable por Disp. Técnica')
    if (e.procesoJud) criticalFlags.add('Proceso Judicial')
    if (e.enRevision) criticalFlags.add('En Revisión')
  })

  const onPersonaChange = (value: string) => {
    linkPersona.mutate({ id: consulta.id, personaId: value === 'none' ? null : value })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard/consulta-360"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a consultas
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reConsultar.mutate({ id: consulta.id })}
            disabled={reConsultar.isPending}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', reConsultar.isPending && 'animate-spin')} />
            {reConsultar.isPending ? 'Actualizando…' : 'Re-consultar'}
          </Button>
          <ExportPdfButton
            consulta={{
              cuit: consulta.cuit,
              denominacion: consulta.denominacion,
              consultadoEn: consulta.consultadoEn,
              score: consulta.score,
              riesgo: banda,
              peorSituacion: consulta.peorSituacion,
              totalDeudaArs: Number(consulta.totalDeudaArs),
              cantEntidades: consulta.cantEntidades,
              chequesRechazados: consulta.chequesRechazados,
              bcraStatus: consulta.bcraStatus as 'ok' | 'not_found' | 'error',
              afipStatus: consulta.afipStatus as 'ok' | 'unavailable' | 'error',
              observaciones: consulta.observaciones,
            }}
            scoreResult={score}
            payloadBcra={bcraDeudas}
            payloadHistorico={bcraHist}
            payloadCheques={bcraCheques}
            payloadAfip={afipData}
            solicitante={solicitante}
            consultasPorMes={consultasPorMes}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('¿Eliminar esta consulta? El cache no se borra.')) {
                deleteMut.mutate({ id: consulta.id })
              }
            }}
            className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Bloque A — Header + Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <ScoreGauge score={score.score} banda={banda} />
            <div className="flex-1 space-y-4 w-full">
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-violet-400" />
                  {consulta.denominacion ?? 'Sin denominación'}
                </h1>
                <p className="text-muted-foreground font-mono text-sm mt-0.5">
                  {formatCuit(consulta.cuit)} ·{' '}
                  <span className="text-xs">
                    Consultado el {new Date(consulta.consultadoEn).toLocaleString('es-AR')}
                  </span>
                </p>
              </div>

              {latestPeriodo?.periodo && (
                <div className="flex items-center gap-2 rounded-md bg-violet-500/10 border border-violet-500/20 px-3 py-2">
                  <span className="text-[10px] uppercase tracking-wide text-violet-300/70 font-semibold">
                    Datos al período
                  </span>
                  <span className="text-sm font-semibold text-violet-200">{periodoLargo}</span>
                  {mesesDelPeriodo !== null && mesesDelPeriodo > 1 && (
                    <span className="text-[11px] text-violet-300/60 ml-auto">
                      hace {mesesDelPeriodo} mes{mesesDelPeriodo !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
              )}

              {mesesDelPeriodo !== null && mesesDelPeriodo >= 2 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs">
                  <span className="text-amber-300">
                    BCRA está reportando datos de hace {mesesDelPeriodo} meses. Si necesitás
                    información más fresca, consultá directamente en el banco. Podés{' '}
                    <button
                      type="button"
                      onClick={() => reConsultar.mutate({ id: consulta.id })}
                      disabled={reConsultar.isPending}
                      className="underline underline-offset-2 hover:text-amber-200 disabled:opacity-50"
                    >
                      re-consultar
                    </button>{' '}
                    para verificar si BCRA ya publicó un período más reciente.
                  </span>
                </div>
              )}

              {criticalFlags.size > 0 && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-3 mt-2">
                  <ShieldCheck className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-400 uppercase tracking-wide">
                      Atención: Banderas Críticas en BCRA
                    </p>
                    <p className="text-sm text-red-200 mt-0.5">
                      {Array.from(criticalFlags).join(' · ')}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label={`Total deuda (${periodoCorto})`} value={formatCurrency(Number(consulta.totalDeudaArs) * 1000)} />
                <Stat label="Entidades" value={String(consulta.cantEntidades)} />
                <Stat
                  label="Peor situación"
                  value={consulta.peorSituacion ? `Sit ${consulta.peorSituacion}` : '—'}
                />
                <Stat
                  label="Cheques rech. (12m)"
                  value={String(consulta.chequesRechazados)}
                />
              </div>

              {score.flags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {score.flags.map((f) => (
                    <span
                      key={f}
                      className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-md bg-white/[0.04] text-muted-foreground ring-1 ring-inset ring-white/[0.06]"
                    >
                      {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {(consulta.bcraStatus !== 'ok' || consulta.afipStatus !== 'ok') && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {consulta.bcraStatus === 'not_found' && (
                    <p>BCRA: sin antecedentes (no necesariamente malo).</p>
                  )}
                  {consulta.bcraStatus === 'error' && <p>BCRA: error al consultar.</p>}
                  {consulta.afipStatus !== 'ok' && <p>AFIP: datos fiscales no disponibles.</p>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ExecutiveSummary text={resumen} />

      {scoreHistory && scoreHistory.length >= 2 && (
        <ScoreSparkline history={scoreHistory} currentId={consulta.id} />
      )}

      {previa && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              Comparativa vs consulta anterior
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Última consulta: {new Date(previa.consultadoEn).toLocaleString('es-AR')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Delta
                label="Score"
                actual={consulta.score}
                anterior={previa.score}
                inverted={false}
              />
              <Delta
                label="Peor situación"
                actual={consulta.peorSituacion ?? 0}
                anterior={previa.peorSituacion ?? 0}
                inverted
                format={(v) => (v === 0 ? '—' : `Sit ${v}`)}
              />
              <Delta
                label="Total deuda"
                actual={Number(consulta.totalDeudaArs)}
                anterior={Number(previa.totalDeudaArs)}
                inverted
                format={(v) => formatCurrency(v * 1000)}
              />
              <Delta
                label="Cheques rech."
                actual={consulta.chequesRechazados}
                anterior={previa.chequesRechazados}
                inverted
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bloque B — Situación por entidad */}
      <Card>
        <CardHeader>
          <CardTitle>Situación por entidad</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Período {periodoLargo}. BCRA reporta montos en miles de pesos (acá ya convertidos).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <EntidadesTable entidades={latestPeriodo?.entidades ?? []} />
          {latestPeriodo?.entidades && latestPeriodo.entidades.length > 1 && (
            <div className="border-t border-white/[0.04] pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
                Distribución de la deuda
              </p>
              <DeudaDistribution entidades={latestPeriodo.entidades} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloque C — Histórico 24 meses */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico (24 meses)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Evolución del monto total de deuda reportada al BCRA
            {periodos.length > 0 && (
              <>
                {' '}· desde{' '}
                <span className="text-foreground/80">
                  {formatPeriodoCorto(
                    [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo))[0]?.periodo
                  )}
                </span>{' '}
                hasta <span className="text-foreground/80">{periodoCorto}</span>
              </>
            )}
            .
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <BarChart24 periodos={periodos} />
          {narrativaPermanencia && (
            <p className="text-xs text-muted-foreground italic border-t border-white/[0.04] pt-3">
              {narrativaPermanencia}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bloque C2 — Heatmap entidad × mes */}
      {periodos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico por entidad</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Cada fila es una entidad financiera; cada columna, un mes. El color indica la
              situación reportada.
            </p>
          </CardHeader>
          <CardContent>
            <EntidadHeatmap periodos={periodos} />
          </CardContent>
        </Card>
      )}

      {/* Bloque D — Cheques */}
      <Card>
        <CardHeader>
          <CardTitle>Cheques rechazados</CardTitle>
        </CardHeader>
        <CardContent>
          <ChequesSection data={bcraCheques} />
        </CardContent>
      </Card>

      {/* Bloque E — AFIP */}
      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales (AFIP)</CardTitle>
        </CardHeader>
        <CardContent>
          <AfipSection data={afipData} status={consulta.afipStatus as 'ok' | 'unavailable' | 'error'} />
        </CardContent>
      </Card>

      {/* Bloque F — Desglose del score */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose del score</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Cómo se compone tu {score.score}/1000. Cada componente pondera al puntaje final.
          </p>
        </CardHeader>
        <CardContent>
          <ScoreBreakdown score={score} />
        </CardContent>
      </Card>

      {/* Bloque G — Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Vincular a Persona
              </label>
              <Select
                value={consulta.personId ?? 'none'}
                onValueChange={onPersonaChange}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Sin vincular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin vincular —</SelectItem>
                  {persons?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.alias ? ` (${p.alias})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Si la persona no tiene CUIT cargado, se autocompleta con el de esta consulta.
              </p>
            </div>

            <div className="flex items-end">
              <Link
                href={
                  consulta.personId
                    ? `/dashboard/simulator?personId=${consulta.personId}`
                    : '/dashboard/simulator'
                }
                className="w-full"
              >
                <Button variant="outline" className="w-full gap-2">
                  Crear préstamo con esta evaluación
                </Button>
              </Link>
            </div>
            {!consulta.personId && (
              <p className="text-[11px] text-muted-foreground/70 md:col-span-2 -mt-2">
                Vinculá la consulta a una persona para precargar el simulador con sus datos.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Nota privada
            </label>
            <Textarea
              value={obsValue}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Contexto, comentarios, próximos pasos…"
              rows={3}
              className="mt-1.5"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={obs === null || obs === (consulta.observaciones ?? '') || updateObs.isPending}
                onClick={() => updateObs.mutate({ id: consulta.id, observaciones: obsValue })}
                className="gap-2"
              >
                <Save className="h-3.5 w-3.5" />
                {updateObs.isPending ? 'Guardando…' : 'Guardar nota'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground/70 text-center">
        Datos públicos del BCRA (Central de Deudores) y AFIP (Padrón). Información de carácter
        informativo, no constituye un dictamen crediticio. Período BCRA reportado: {periodoLargo}.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function Delta({
  label,
  actual,
  anterior,
  inverted,
  format,
}: {
  label: string
  actual: number
  anterior: number
  /** Si true: subir es malo (deuda, situación, cheques). */
  inverted: boolean
  format?: (v: number) => string
}) {
  const fmt = format ?? ((v: number) => String(v))
  const diff = actual - anterior
  const isUp = diff > 0
  const isDown = diff < 0
  // Color según si el cambio es bueno o malo
  const positivo = inverted ? isDown : isUp
  const negativo = inverted ? isUp : isDown
  const color = positivo
    ? 'text-green-400'
    : negativo
      ? 'text-red-400'
      : 'text-muted-foreground'
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-2">
        <p className="text-lg font-bold text-foreground tabular-nums">{fmt(actual)}</p>
        <span className="text-xs text-muted-foreground">← {fmt(anterior)}</span>
      </div>
      <div className={cn('mt-1 flex items-center gap-1 text-xs tabular-nums', color)}>
        <Icon className="h-3 w-3" />
        {diff === 0 ? 'Sin cambios' : `${isUp ? '+' : '−'}${fmt(Math.abs(diff))}`}
      </div>
    </div>
  )
}
