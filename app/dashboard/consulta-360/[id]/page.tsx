'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { ArrowLeft, ShieldCheck, Link2, Trash2, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ScoreGauge } from '@/components/consulta-360/score-gauge'
import { ScoreBreakdown } from '@/components/consulta-360/score-breakdown'
import { EntidadesTable } from '@/components/consulta-360/entidades-table'
import { Heatmap24 } from '@/components/consulta-360/heatmap-24'
import { ChequesSection } from '@/components/consulta-360/cheques-section'
import { AfipSection } from '@/components/consulta-360/afip-section'
import { ExportPdfButton } from '@/components/consulta-360/pdf/export-button'
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

  const { data: consulta, isLoading } = trpc.consulta360.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  )

  const { data: persons } = trpc.persons.list.useQuery()

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

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total deuda" value={formatCurrency(Number(consulta.totalDeudaArs) * 1000)} />
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

      {/* Bloque B — Situación por entidad */}
      <Card>
        <CardHeader>
          <CardTitle>Situación por entidad</CardTitle>
        </CardHeader>
        <CardContent>
          <EntidadesTable entidades={latestPeriodo?.entidades ?? []} />
        </CardContent>
      </Card>

      {/* Bloque C — Heatmap 24 meses */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico (24 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap24 periodos={periodos} />
        </CardContent>
      </Card>

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
        Datos públicos del BCRA (Central de Deudores) y AFIP (Padrón). Información de carácter informativo,
        no constituye un dictamen crediticio. Período BCRA reportado:{' '}
        {latestPeriodo?.periodo
          ? `${latestPeriodo.periodo.slice(0, 4)}-${latestPeriodo.periodo.slice(4)}`
          : '—'}
        .
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
