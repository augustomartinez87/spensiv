import { cn } from '@/lib/utils'
import type { RiesgoBanda } from '@/lib/consulta-360/types'

const BANDA_FILL: Record<RiesgoBanda, string> = {
  bajo: 'fill-green-400',
  medio: 'fill-yellow-400',
  alto: 'fill-orange-400',
  critico: 'fill-red-400',
}

type Punto = {
  id: string
  score: number
  riesgo: string
  consultadoEn: Date | string
}

export function ScoreSparkline({
  history,
  currentId,
}: {
  history: Punto[]
  currentId: string
}) {
  if (history.length < 2) return null

  const W = 320
  const H = 70
  const PAD = 8

  const minScore = Math.min(0, ...history.map((p) => p.score))
  const maxScore = Math.max(1000, ...history.map((p) => p.score))
  const range = maxScore - minScore || 1

  const xFor = (i: number) =>
    history.length === 1 ? W / 2 : PAD + (i / (history.length - 1)) * (W - 2 * PAD)
  const yFor = (s: number) => PAD + (1 - (s - minScore) / range) * (H - 2 * PAD)

  const path = history
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(p.score).toFixed(2)}`)
    .join(' ')

  const ultimo = history[history.length - 1]
  const primero = history[0]
  const delta = ultimo.score - primero.score

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Evolución del score
        </p>
        <p className="text-xs">
          <span className="text-muted-foreground">{history.length} consultas · </span>
          <span
            className={cn(
              'tabular-nums font-medium',
              delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-muted-foreground'
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta} pts
          </span>
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full h-[70px]"
        preserveAspectRatio="none"
      >
        {/* línea de referencia banda 800/600/400 */}
        {[800, 600, 400].map((thr) => {
          const y = yFor(thr)
          return (
            <line
              key={thr}
              x1={PAD}
              x2={W - PAD}
              y1={y}
              y2={y}
              className="stroke-white/[0.06]"
              strokeDasharray="2 3"
            />
          )
        })}
        {/* path */}
        <path d={path} className="stroke-violet-400 fill-none" strokeWidth={1.5} />
        {/* puntos */}
        {history.map((p, i) => {
          const isCurrent = p.id === currentId
          return (
            <circle
              key={p.id}
              cx={xFor(i)}
              cy={yFor(p.score)}
              r={isCurrent ? 4 : 2.5}
              className={cn(
                BANDA_FILL[p.riesgo as RiesgoBanda] ?? 'fill-zinc-400',
                isCurrent && 'stroke-white stroke-1'
              )}
            />
          )
        })}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{new Date(primero.consultadoEn).toLocaleDateString('es-AR')}</span>
        <span className="tabular-nums">
          {primero.score} → {ultimo.score}
        </span>
        <span>{new Date(ultimo.consultadoEn).toLocaleDateString('es-AR')}</span>
      </div>
    </div>
  )
}
