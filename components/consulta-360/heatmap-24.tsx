'use client'

import { cn } from '@/lib/utils'
import { situacionColor } from './situacion-badge'
import type { BcraPeriodoDeuda } from '@/lib/consulta-360/types'

function periodoLabel(p: string): string {
  // "YYYYMM" → "MMM YY"
  if (p.length !== 6) return p
  const y = p.slice(0, 4)
  const m = parseInt(p.slice(4, 6), 10)
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${meses[m - 1] ?? '?'} ${y.slice(2)}`
}

function peorSit(p: BcraPeriodoDeuda): number | null {
  if (!p.entidades?.length) return null
  return p.entidades.reduce((peor, e) => (e.situacion > peor ? e.situacion : peor), 1)
}

export function Heatmap24({ periodos }: { periodos: BcraPeriodoDeuda[] }) {
  // Mostramos los últimos 24 ordenados de más viejo (izq) a más nuevo (der).
  const ult = [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-24)

  // Si hay menos de 24, padeamos con celdas vacías al inicio.
  const padCount = Math.max(0, 24 - ult.length)
  const cells: (BcraPeriodoDeuda | null)[] = [...Array(padCount).fill(null), ...ult]

  if (ult.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-muted-foreground">
        Sin histórico disponible.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-1.5">
        {cells.map((p, i) => {
          const sit = p ? peorSit(p) : null
          const color = p ? situacionColor(sit) : 'bg-white/[0.04]'
          const tooltip = p
            ? `${periodoLabel(p.periodo)} · sit ${sit ?? '—'}`
            : 'Sin datos'
          return (
            <div
              key={i}
              title={tooltip}
              className={cn(
                'aspect-square rounded-md transition-transform hover:scale-110',
                color,
                p ? 'ring-1 ring-white/[0.06]' : ''
              )}
            />
          )
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
        <span>{ult[0] ? periodoLabel(ult[0].periodo) : '—'}</span>
        <div className="flex items-center gap-3">
          <Legend label="Normal" color="bg-green-500" />
          <Legend label="Riesgo" color="bg-yellow-500" />
          <Legend label="Problemas" color="bg-orange-500" />
          <Legend label="Alto" color="bg-red-500" />
          <Legend label="Irrec." color="bg-zinc-500" />
        </div>
        <span>{ult[ult.length - 1] ? periodoLabel(ult[ult.length - 1].periodo) : '—'}</span>
      </div>
    </div>
  )
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('h-2 w-2 rounded-sm', color)} />
      {label}
    </span>
  )
}
