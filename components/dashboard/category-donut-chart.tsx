'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { PrivateAmount } from '@/lib/contexts/privacy-context'

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
    <div className="flex items-center gap-5 flex-1">
      {/* Donut chart */}
      <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={52}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Total</span>
          <PrivateAmount>
            <span className="text-sm font-bold text-foreground tabular-nums">
              {formatHero(total)}
            </span>
          </PrivateAmount>
        </div>
      </div>

      {/* Legend — right side */}
      <div className="flex-1 flex flex-col gap-2">
        {data.map(({ name, value, color }) => {
          const pct = total > 0 ? (value / total) * 100 : 0
          return (
            <div key={name} className="flex items-center justify-between text-xs hover:bg-muted/50 py-0.5 px-1 -mx-1 rounded transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                <span className="text-foreground truncate">{name}</span>
              </div>
              <span className="text-muted-foreground tabular-nums ml-2 shrink-0 font-medium">
                {Math.round(pct)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
