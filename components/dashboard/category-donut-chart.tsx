'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { PrivateAmount } from '@/lib/privacy-context'

interface DonutItem {
  name: string
  value: number
  color: string
}

interface CategoryDonutChartProps {
  data: DonutItem[]
  total: number
  formatHero: (value: number) => string
}

export function CategoryDonutChart({ data, total, formatHero }: CategoryDonutChartProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full" style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <PrivateAmount>
            <span className="text-base font-bold text-foreground tabular-nums">
              {formatHero(total)}
            </span>
          </PrivateAmount>
        </div>
      </div>
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map(({ name, value, color }) => {
          const pct = total > 0 ? (value / total) * 100 : 0
          return (
            <div key={name} className="flex items-center gap-1.5 text-xs min-w-0">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
              <span className="text-foreground truncate">{name}</span>
              <span className="text-muted-foreground tabular-nums ml-auto shrink-0">
                {Math.round(pct)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
