'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'

interface DataPoint {
  period: string
  income: number
  expense: number
  balance: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-2 capitalize">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold" style={{ color: entry.color }}>
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyEvolutionChart({ data }: { data: DataPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: format(parse(d.period, 'yyyy-MM', new Date()), "MMM 'yy", { locale: es }),
  }))

  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expense)))

  return (
    <Card className="h-full">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold">Evolución mensual</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-0">
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) =>
                maxValue >= 1_000_000
                  ? `$${(v / 1_000_000).toFixed(1)}M`
                  : `$${Math.round(v / 1_000)}k`
              }
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={54}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="income"
              name="Ingresos"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="Egresos"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#f97316' }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-3 h-0.5 rounded bg-blue-500" />
            Ingresos
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="w-3 h-0.5 rounded bg-orange-500" />
            Egresos
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
