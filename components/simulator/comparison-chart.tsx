'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface ComparisonChartProps {
  amortizedCurve: Array<{ month: number; value: number }>
  bulletCurve: Array<{ month: number; value: number }>
}

export function ComparisonChart({ amortizedCurve, bulletCurve }: ComparisonChartProps) {
  // Merge both curves by month
  const maxMonths = Math.max(
    amortizedCurve[amortizedCurve.length - 1]?.month ?? 0,
    bulletCurve[bulletCurve.length - 1]?.month ?? 0,
  )

  const data = []
  for (let m = 0; m <= maxMonths; m++) {
    data.push({
      month: `Mes ${m}`,
      Amortizado: amortizedCurve.find(p => p.month === m)?.value ?? null,
      Bullet: bulletCurve.find(p => p.month === m)?.value ?? null,
    })
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            color: 'hsl(var(--foreground))',
          }}
          itemStyle={{ color: 'hsl(var(--foreground))' }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(val: number) => [formatCurrency(val), '']}
        />
        <Legend iconType="circle" />
        <Line
          type="monotone"
          dataKey="Amortizado"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="Bullet"
          stroke="#f59e0b"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
