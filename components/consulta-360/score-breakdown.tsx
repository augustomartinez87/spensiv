import { cn } from '@/lib/utils'
import type { ScoreResult } from '@/lib/consulta-360/types'
import { AlertTriangle } from 'lucide-react'

function colorForRaw(raw: number): string {
  if (raw >= 800) return 'bg-green-500'
  if (raw >= 600) return 'bg-yellow-500'
  if (raw >= 400) return 'bg-orange-500'
  return 'bg-red-500'
}

export function ScoreBreakdown({ score }: { score: ScoreResult }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {score.components.map((c) => {
          const pctRaw = (c.raw / 1000) * 100
          const weightPct = Math.round(c.weight * 100)
          return (
            <div key={c.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{c.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">peso {weightPct}%</span>
                  {c.neutral && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 shrink-0">
                      neutro
                    </span>
                  )}
                </div>
                <span className="text-sm tabular-nums text-foreground shrink-0">
                  {Math.round(c.raw)} <span className="text-muted-foreground">/ 1000</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', colorForRaw(c.raw))}
                  style={{ width: `${pctRaw}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
            </div>
          )
        })}
      </div>

      {score.overrides.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.05] p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Overrides aplicados</span>
          </div>
          {score.overrides.map((o, i) => (
            <p key={i} className="text-xs text-red-200/90">
              {o.reason} → score limitado a {o.capAt}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
