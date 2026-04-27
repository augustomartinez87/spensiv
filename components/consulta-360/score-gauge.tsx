import { cn } from '@/lib/utils'
import type { RiesgoBanda } from '@/lib/consulta-360/types'

const BANDA_COLORS: Record<RiesgoBanda, { stroke: string; text: string; bg: string }> = {
  bajo: { stroke: 'stroke-green-400', text: 'text-green-400', bg: 'bg-green-500/10' },
  medio: { stroke: 'stroke-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  alto: { stroke: 'stroke-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/10' },
  critico: { stroke: 'stroke-red-400', text: 'text-red-400', bg: 'bg-red-500/10' },
}

const BANDA_LABEL: Record<RiesgoBanda, string> = {
  bajo: 'Riesgo bajo',
  medio: 'Riesgo medio',
  alto: 'Riesgo alto',
  critico: 'Riesgo crítico',
}

export function ScoreGauge({
  score,
  banda,
  size = 220,
}: {
  score: number
  banda: RiesgoBanda
  size?: number
}) {
  const pct = Math.max(0, Math.min(1, score / 1000))
  const radius = (size - 24) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct * 0.75) // 75% del círculo
  const rotation = -225 // empezar en abajo-izquierda

  const cfg = BANDA_COLORS[banda]

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-white/[0.06] fill-none"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={cn('fill-none transition-all duration-700', cfg.stroke)}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-5xl font-bold tracking-tight', cfg.text)}>{score}</span>
          <span className="text-xs text-muted-foreground mt-1">/ 1000</span>
        </div>
      </div>
      <div className={cn('mt-2 px-3 py-1 rounded-full text-sm font-semibold', cfg.bg, cfg.text)}>
        {BANDA_LABEL[banda]}
      </div>
    </div>
  )
}
