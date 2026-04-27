'use client'

import { useMemo } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
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

function sitColorHex(sit: number | null): string {
  if (sit === null) return 'rgba(255, 255, 255, 0.04)' // Sin datos
  if (sit === 1) return '#22c55e' // text-green-500
  if (sit === 2) return '#eab308' // text-yellow-500
  if (sit === 3) return '#f97316' // text-orange-500
  if (sit === 4) return '#ef4444' // text-red-500
  return '#71717a' // text-zinc-500 (5 o 6)
}

export function BarChart24({ periodos }: { periodos: BcraPeriodoDeuda[] }) {
  const data = useMemo(() => {
    const ult = [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-24)

    // Formatear la data para recharts
    return ult.map((p) => {
      const sit = peorSit(p)
      const totalDeuda = p.entidades.reduce((acc, e) => acc + (Number(e.monto) || 0) * 1000, 0)
      return {
        periodo: p.periodo,
        label: periodoLabel(p.periodo),
        deuda: totalDeuda,
        peorSituacion: sit,
        color: sitColorHex(sit),
      }
    })
  }, [periodos])

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-muted-foreground">
        Sin histórico disponible.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}k`}`}
              width={50}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload
                  return (
                    <div className="rounded-lg border border-white/[0.06] bg-[#111726] p-3 shadow-xl">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        {d.label}
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {formatCurrency(d.deuda)}
                      </p>
                      {d.peorSituacion && (
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          Sit {d.peorSituacion}
                        </p>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="deuda" radius={[4, 4, 0, 0]} minPointSize={2}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <Legend label="Normal" color="#22c55e" />
        <Legend label="Riesgo bajo" color="#eab308" />
        <Legend label="Problemas" color="#f97316" />
        <Legend label="Alto riesgo" color="#ef4444" />
        <Legend label="Irrecuperable" color="#71717a" />
      </div>
    </div>
  )
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
