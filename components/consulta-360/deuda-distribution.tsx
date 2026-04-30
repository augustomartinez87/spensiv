import { formatCurrency, cn } from '@/lib/utils'
import type { BcraEntidadDeuda } from '@/lib/consulta-360/types'

const SIT_BG: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-zinc-500',
  6: 'bg-zinc-500',
}

const SIT_LABEL: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Con problemas',
  4: 'Alto riesgo',
  5: 'Irrecuperable',
  6: 'Irrec. téc.',
}

export function DeudaDistribution({ entidades }: { entidades: BcraEntidadDeuda[] }) {
  if (!entidades.length) return null

  const buckets = new Map<number, { monto: number; cant: number }>()
  let total = 0
  for (const e of entidades) {
    const m = (Number(e.monto) || 0) * 1000 // BCRA en miles → pesos
    total += m
    const b = buckets.get(e.situacion) ?? { monto: 0, cant: 0 }
    b.monto += m
    b.cant += 1
    buckets.set(e.situacion, b)
  }

  if (total === 0) return null

  const ordenado = [...buckets.entries()].sort((a, b) => a[0] - b[0])

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-inset ring-white/[0.06]">
        {ordenado.map(([sit, b]) => (
          <div
            key={sit}
            className={cn(SIT_BG[sit] ?? 'bg-zinc-500')}
            style={{ width: `${(b.monto / total) * 100}%` }}
            title={`Sit ${sit}: ${formatCurrency(b.monto)}`}
          />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ordenado.map(([sit, b]) => {
          const pct = (b.monto / total) * 100
          return (
            <div key={sit} className="flex items-center gap-2 text-xs">
              <span className={cn('h-2 w-2 rounded-full shrink-0', SIT_BG[sit] ?? 'bg-zinc-500')} />
              <span className="text-muted-foreground">
                Sit {sit} ({SIT_LABEL[sit] ?? '—'})
              </span>
              <span className="ml-auto tabular-nums text-foreground">
                {formatCurrency(b.monto)}{' '}
                <span className="text-muted-foreground">· {pct.toFixed(0)}%</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
