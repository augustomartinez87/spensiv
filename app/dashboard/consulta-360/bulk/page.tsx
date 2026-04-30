'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/contexts/trpc-client'
import { isValidCuit, normalizeCuit, formatCuit } from '@/lib/cuit'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Users,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import type { RiesgoBanda } from '@/lib/consulta-360/types'

type Mode = 'cartera' | 'cuits'

const BANDA: Record<RiesgoBanda, { text: string; bg: string; ring: string }> = {
  bajo: { text: 'text-green-300', bg: 'bg-green-500/15', ring: 'ring-green-500/30' },
  medio: { text: 'text-yellow-300', bg: 'bg-yellow-500/15', ring: 'ring-yellow-500/30' },
  alto: { text: 'text-orange-300', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30' },
  critico: { text: 'text-red-300', bg: 'bg-red-500/15', ring: 'ring-red-500/30' },
}

export default function BulkPage() {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('cartera')
  const [cuitsRaw, setCuitsRaw] = useState('')

  const { data: persons } = trpc.persons.list.useQuery()
  const personasConCuit = useMemo(
    () => (persons ?? []).filter((p) => p.cuit && isValidCuit(p.cuit)),
    [persons]
  )

  const cuitsParsed = useMemo(() => {
    const tokens = cuitsRaw
      .split(/[\s,;\n\t]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const seen = new Set<string>()
    const valid: string[] = []
    const invalid: string[] = []
    for (const t of tokens) {
      const n = normalizeCuit(t)
      if (!isValidCuit(n)) {
        invalid.push(t)
        continue
      }
      if (seen.has(n)) continue
      seen.add(n)
      valid.push(n)
    }
    return { valid, invalid }
  }, [cuitsRaw])

  const bulk = trpc.consulta360.bulk.useMutation({
    onSuccess: (res) => {
      toast({
        title: 'Bulk completado',
        description: `${res.results.filter((r) => r.ok).length} ok, ${res.results.filter((r) => !r.ok).length} con error`,
      })
    },
    onError: (e) =>
      toast({ variant: 'destructive', title: 'Error en bulk', description: e.message }),
  })

  const cuentaACorrer =
    mode === 'cartera' ? personasConCuit.length : cuitsParsed.valid.length
  const puedeCorrer = !bulk.isPending && cuentaACorrer > 0

  const onRun = () => {
    if (mode === 'cartera') {
      bulk.mutate({ target: 'cartera', skipIfWithinHours: 24 })
    } else {
      bulk.mutate({ target: 'cuits', cuits: cuitsParsed.valid, skipIfWithinHours: 24 })
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/consulta-360"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Consulta masiva</h1>
        <p className="text-muted-foreground mt-1">
          Evaluá a varios CUIT a la vez. Los ya consultados en las últimas 24 hs se saltean.
          Cada corrida procesa hasta 10 CUITs (límite por request) y tenés un máximo de 30
          consultas por hora. Si tu lista es más larga, volvé a correr el bulk.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Origen de los CUIT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('cartera')}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                mode === 'cartera'
                  ? 'border-violet-400/40 bg-violet-500/5'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-violet-400" />
                Mi cartera de Personas
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {personasConCuit.length} persona{personasConCuit.length !== 1 ? 's' : ''} con CUIT
                cargado.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('cuits')}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                mode === 'cuits'
                  ? 'border-violet-400/40 bg-violet-500/5'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4 text-violet-400" />
                Pegar lista de CUIT
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Uno por línea o separados por coma. Acepta con o sin guiones.
              </p>
            </button>
          </div>

          {mode === 'cuits' && (
            <div>
              <Label htmlFor="cuits">Lista de CUIT</Label>
              <Textarea
                id="cuits"
                value={cuitsRaw}
                onChange={(e) => setCuitsRaw(e.target.value)}
                rows={6}
                className="mt-1.5 font-mono text-sm"
                placeholder="20-12345678-9&#10;30500010912&#10;..."
              />
              <div className="mt-1.5 flex items-center gap-3 text-xs">
                <span className="text-green-400">{cuitsParsed.valid.length} válidos</span>
                {cuitsParsed.invalid.length > 0 && (
                  <span className="text-red-400">
                    {cuitsParsed.invalid.length} inválidos (se ignoran)
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/[0.04] pt-4">
            <p className="text-sm text-muted-foreground">
              Se procesarán hasta <span className="font-semibold text-foreground">{cuentaACorrer}</span> CUIT.
            </p>
            <Button onClick={onRun} disabled={!puedeCorrer} className="gap-2">
              <Play className="h-4 w-4" />
              {bulk.isPending ? 'Procesando…' : 'Iniciar consulta masiva'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {bulk.isPending && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Consultando BCRA y AFIP en serie. Puede tardar varios segundos por CUIT…
            </p>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      )}

      {bulk.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultados</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {bulk.data.procesados} procesados · {bulk.data.salteadosPorRecientes} salteados
              (consultados &lt; 24 hs) · {bulk.data.salteadosPorCupo} salteados por cupo horario
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                    <th className="px-4 py-2.5 font-medium">CUIT</th>
                    <th className="px-4 py-2.5 font-medium">Denominación</th>
                    <th className="px-4 py-2.5 font-medium text-right">Score</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {bulk.data.results
                    .slice()
                    .sort((a, b) => (a.score ?? 1001) - (b.score ?? 1001))
                    .map((r) => {
                      const cfg = r.riesgo
                        ? BANDA[r.riesgo as RiesgoBanda]
                        : BANDA.medio
                      return (
                        <tr key={r.cuit} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5">
                            {r.ok ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-400" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">{formatCuit(r.cuit)}</td>
                          <td className="px-4 py-2.5">
                            {r.ok ? (
                              r.denominacion ?? <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="text-red-300 text-xs">{r.error}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {r.ok && r.score != null ? (
                              <span
                                className={cn(
                                  'inline-flex h-7 w-12 items-center justify-center rounded-md font-bold text-xs ring-1 ring-inset',
                                  cfg.bg,
                                  cfg.text,
                                  cfg.ring
                                )}
                              >
                                {r.score}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {r.ok && r.id && (
                              <Link
                                href={`/dashboard/consulta-360/${r.id}`}
                                className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
                              >
                                Ver
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            )}
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
    </div>
  )
}
