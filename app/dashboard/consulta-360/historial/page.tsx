'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCuit } from '@/lib/cuit'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Search, Filter, X } from 'lucide-react'
import type { RiesgoBanda } from '@/lib/consulta-360/types'

const PAGE_SIZE = 25

const BANDA_BADGE: Record<RiesgoBanda, { text: string; bg: string; ring: string; label: string }> = {
  bajo: { text: 'text-green-300', bg: 'bg-green-500/15', ring: 'ring-green-500/30', label: 'Bajo' },
  medio: { text: 'text-yellow-300', bg: 'bg-yellow-500/15', ring: 'ring-yellow-500/30', label: 'Medio' },
  alto: { text: 'text-orange-300', bg: 'bg-orange-500/15', ring: 'ring-orange-500/30', label: 'Alto' },
  critico: { text: 'text-red-300', bg: 'bg-red-500/15', ring: 'ring-red-500/30', label: 'Crítico' },
}

export default function HistorialPage() {
  const [q, setQ] = useState('')
  const [riesgo, setRiesgo] = useState<RiesgoBanda | 'all'>('all')
  const [minScore, setMinScore] = useState<string>('')
  const [maxScore, setMaxScore] = useState<string>('')
  const [page, setPage] = useState(0)

  const { data, isLoading } = trpc.consulta360.list.useQuery({
    q: q.trim() || undefined,
    riesgo: riesgo === 'all' ? undefined : riesgo,
    minScore: minScore ? Number(minScore) : undefined,
    maxScore: maxScore ? Number(maxScore) : undefined,
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = q || riesgo !== 'all' || minScore || maxScore

  const reset = () => {
    setQ('')
    setRiesgo('all')
    setMinScore('')
    setMaxScore('')
    setPage(0)
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
        <h1 className="text-2xl font-bold tracking-tight">Historial de consultas</h1>
        <p className="text-muted-foreground mt-1">
          Buscá y filtrá entre todas tus consultas guardadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label htmlFor="q" className="text-xs">Buscar</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="q"
                  placeholder="CUIT o denominación"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setPage(0)
                  }}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Riesgo</Label>
              <Select
                value={riesgo}
                onValueChange={(v) => {
                  setRiesgo(v as RiesgoBanda | 'all')
                  setPage(0)
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="bajo">Bajo</SelectItem>
                  <SelectItem value="medio">Medio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="min" className="text-xs">Score mín.</Label>
              <Input
                id="min"
                type="number"
                min={0}
                max={1000}
                placeholder="0"
                value={minScore}
                onChange={(e) => {
                  setMinScore(e.target.value)
                  setPage(0)
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="max" className="text-xs">Score máx.</Label>
              <Input
                id="max"
                type="number"
                min={0}
                max={1000}
                placeholder="1000"
                value={maxScore}
                onChange={(e) => {
                  setMaxScore(e.target.value)
                  setPage(0)
                }}
                className="mt-1"
              />
            </div>
          </div>
          {hasFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs">
                <X className="h-3 w-3" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {total} resultado{total !== 1 ? 's' : ''}
          </CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <span className="tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              {hasFilters ? 'No hay resultados con esos filtros.' : 'Todavía no hay consultas.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Score</th>
                    <th className="px-4 py-2.5 font-medium">Denominación</th>
                    <th className="px-4 py-2.5 font-medium">CUIT</th>
                    <th className="px-4 py-2.5 font-medium text-right">Deuda</th>
                    <th className="px-4 py-2.5 font-medium text-right">Ent.</th>
                    <th className="px-4 py-2.5 font-medium text-right">Cheq.</th>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((it) => {
                    const cfg = BANDA_BADGE[it.riesgo as RiesgoBanda] ?? BANDA_BADGE.medio
                    return (
                      <tr key={it.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/dashboard/consulta-360/${it.id}`}
                            className={cn(
                              'inline-flex h-8 w-12 items-center justify-center rounded-md text-sm font-bold ring-1 ring-inset',
                              cfg.bg,
                              cfg.text,
                              cfg.ring
                            )}
                          >
                            {it.score}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/dashboard/consulta-360/${it.id}`}
                            className="font-medium text-foreground hover:text-violet-300"
                          >
                            {it.denominacion ?? 'Sin denominación'}
                          </Link>
                          {it.person && (
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              · {it.person.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {formatCuit(it.cuit)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatCurrency(Number(it.totalDeudaArs) * 1000)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {it.cantEntidades}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {it.chequesRechazados}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {new Date(it.consultadoEn).toLocaleDateString('es-AR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
