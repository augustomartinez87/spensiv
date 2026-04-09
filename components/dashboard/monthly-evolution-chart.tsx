'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'

interface DataPoint {
  period: string
  income: number
  expense: number
  balance: number
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg p-3 text-xs shadow-2xl"
      style={{
        background: 'rgba(10, 10, 15, 0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <p className="font-semibold mb-2 capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: entry.color }} />
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyEvolutionChart({ data }: { data: DataPoint[] }) {
  const chartData = data
    .filter((d) => d.income > 0 || d.expense > 0)
    .map((d) => ({
      ...d,
      label: format(parse(d.period, 'yyyy-MM', new Date()), 'MMM yy', { locale: es }),
    }))

  if (chartData.length < 2) {
    return (
      <div className="px-2 py-8 text-center text-sm text-muted-foreground italic">
        Sin suficientes datos para mostrar la evolución mensual
      </div>
    )
  }

  const maxValue = Math.max(...chartData.map((d) => Math.max(d.income, d.expense)), 1)

  return (
    <div className="px-1 pt-1 pb-2 flex flex-col h-full">
      {/* Title + legend row */}
      <div className="flex items-center justify-between mb-3 px-2">
        <p className="text-sm font-semibold text-foreground">Evolución mensual</p>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 rounded" style={{ background: 'hsl(var(--chart-income))', height: 2 }} />
            Ingresos
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 rounded" style={{ background: 'hsl(var(--chart-expense))', height: 2 }} />
            Egresos
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-income))" stopOpacity={0.15} />
              <stop offset="100%" stopColor="hsl(var(--chart-income))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-expense))" stopOpacity={0.15} />
              <stop offset="100%" stopColor="hsl(var(--chart-expense))" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="0"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#4b5563' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              maxValue >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(1)}M`
                : `$${Math.round(v / 1_000)}k`
            }
            tick={{ fontSize: 10, fill: '#4b5563' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="income"
            name="Ingresos"
            stroke="hsl(var(--chart-income))"
            strokeWidth={1.5}
            fill="url(#incomeGrad)"
            dot={false}
            activeDot={{ r: 3, fill: 'hsl(var(--chart-income))', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Egresos"
            stroke="hsl(var(--chart-expense))"
            strokeWidth={1.5}
            fill="url(#expenseGrad)"
            dot={false}
            activeDot={{ r: 3, fill: 'hsl(var(--chart-expense))', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}
