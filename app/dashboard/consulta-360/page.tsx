'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/contexts/trpc-client'
import { isValidCuit, normalizeCuit, formatCuit } from '@/lib/cuit'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck, Search, Clock, ArrowRight, AlertCircle, CheckCircle2, FileSpreadsheet, ListFilter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { BcraStatus } from '@/components/consulta-360/bcra-status'
import type { RiesgoBanda } from '@/lib/consulta-360/types'

const BANDA_BADGE: Record<RiesgoBanda, { text: string; bg: string; ring: string; label: string }> = {
  bajo: { text: 'text-green-300', bg: 'bg-green-500/15', ring: 'ring-green-500/30', label: 'Bajo' },
  medio: { text: 'text-yellow-300', bg: 'bg-yellow-500/15', ring: 'ring-yellow-500/30', label: 'Medio' },
  alto: { text: 'text-orange-300', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30', label: 'Alto' },
  critico: { text: 'text-red-300', bg: 'bg-red-500/15', ring: 'ring-red-500/30', label: 'Crítico' },
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 7) return `hace ${d}d`
  return date.toLocaleDateString('es-AR')
}

export default function Consulta360IndexPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [cuitInput, setCuitInput] = useState('')

  const normalized = useMemo(() => normalizeCuit(cuitInput), [cuitInput])
  const valid = useMemo(() => isValidCuit(normalized), [normalized])
  const showValidation = cuitInput.trim().length >= 11

  const { data: recents, isLoading: loadingRecents } = trpc.consulta360.recent.useQuery({ limit: 5 })
  const { data: bcraHealth } = trpc.consulta360.health.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const bcraDown = bcraHealth?.status === 'mantenimiento' || bcraHealth?.status === 'error'

  const consultar = trpc.consulta360.consultar.useMutation({
    onSuccess: (res) => {
      toast({
        title: 'Consulta lista',
        description: `Score ${res.summary.score.score} · ${res.summary.score.bandaLabel}`,
      })
      router.push(`/dashboard/consulta-360/${res.id}`)
    },
    onError: (err) => {
      const isMantenimiento =
        err.data?.code === 'SERVICE_UNAVAILABLE' ||
        err.message.toLowerCase().includes('mantenimiento')
      toast({
        variant: 'destructive',
        title: isMantenimiento ? 'BCRA en mantenimiento' : 'No se pudo consultar',
        description: err.message,
      })
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) {
      toast({ variant: 'destructive', title: 'CUIT inválido', description: 'Verificá el dígito.' })
      return
    }
    consultar.mutate({ cuit: normalized })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-violet-400" />
              Consulta 360°
            </h1>
            <BcraStatus />
          </div>
          <p className="text-muted-foreground mt-1">
            Evaluá la situación crediticia de un CUIT/CUIL/CDI con datos públicos del BCRA y AFIP.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/consulta-360/bulk">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              Consulta masiva
            </Button>
          </Link>
          <Link href="/dashboard/consulta-360/historial">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ListFilter className="h-4 w-4" />
              Historial
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="cuit">CUIT / CUIL / CDI</Label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="cuit"
                    inputMode="numeric"
                    placeholder="20-12345678-9"
                    value={cuitInput}
                    onChange={(e) => setCuitInput(e.target.value)}
                    className={cn(
                      'pr-10 font-mono tracking-tight',
                      showValidation && (valid ? 'border-green-500/40' : 'border-red-500/40')
                    )}
                    maxLength={13}
                  />
                  {showValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {valid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!valid || consultar.isPending || bcraDown}
                  className="gap-2"
                  title={
                    bcraDown
                      ? bcraHealth?.status === 'mantenimiento'
                        ? 'BCRA está en mantenimiento. Probá en unos minutos.'
                        : 'BCRA no responde. Probá en unos minutos.'
                      : undefined
                  }
                >
                  <Search className="h-4 w-4" />
                  {consultar.isPending
                    ? 'Consultando…'
                    : bcraDown
                      ? 'BCRA no disponible'
                      : 'Consultar'}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {showValidation && !valid
                  ? 'Dígito verificador inválido.'
                  : valid
                  ? `Formato: ${formatCuit(normalized)}`
                  : 'Ingresá 11 dígitos. Aceptamos formato libre (con o sin guiones).'}
              </p>
            </div>

            <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground/80 mb-1">Qué se consulta</p>
              <ul className="space-y-0.5">
                <li>• BCRA — Central de Deudores (situación actual + 24m)</li>
                <li>• BCRA — Cheques rechazados</li>
                <li>• AFIP — Padrón (datos fiscales, mejor esfuerzo)</li>
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Las consultas se cachean 24h (BCRA) / 7d (AFIP). Límite: 30 consultas por hora.
                BCRA suele entrar en mantenimiento por la noche (00–06 AR); si pasa eso, vamos
                a avisarte y podés reintentar más tarde.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Últimas consultas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecents ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !recents || recents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Todavía no hiciste consultas.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {recents.map((r) => {
                const banda = r.riesgo as RiesgoBanda
                const cfg = BANDA_BADGE[banda] ?? BANDA_BADGE.medio
                return (
                  <li key={r.id}>
                    <Link
                      href={`/dashboard/consulta-360/${r.id}`}
                      className="flex items-center gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-white/[0.03] transition-colors group"
                    >
                      <div
                        className={cn(
                          'h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold ring-1 ring-inset shrink-0',
                          cfg.bg,
                          cfg.text,
                          cfg.ring
                        )}
                      >
                        {r.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {r.denominacion ?? 'Sin denominación'}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatCuit(r.cuit)} · {cfg.label} · {timeAgo(new Date(r.consultadoEn))}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
