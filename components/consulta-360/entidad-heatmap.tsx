import { cn } from '@/lib/utils'
import type { BcraPeriodoDeuda } from '@/lib/consulta-360/types'
import { formatPeriodoCorto } from '@/lib/consulta-360/periodo'

const SIT_BG: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-zinc-500',
  6: 'bg-zinc-700',
}

const SIT_LABEL: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Con problemas',
  4: 'Alto riesgo',
  5: 'Irrecuperable',
  6: 'Irrec. téc.',
}

export function EntidadHeatmap({ periodos }: { periodos: BcraPeriodoDeuda[] }) {
  if (periodos.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-muted-foreground">
        Sin histórico disponible.
      </div>
    )
  }

  // Ordenar períodos asc, tomar últimos 24
  const sorted = [...periodos]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .slice(-24)

  // Recolectar todas las entidades que aparecen en el histórico
  const entidadesUnicas = new Map<string, { situaciones: Map<string, number> }>()
  for (const p of sorted) {
    for (const e of p.entidades) {
      if (!entidadesUnicas.has(e.entidad)) {
        entidadesUnicas.set(e.entidad, { situaciones: new Map() })
      }
      entidadesUnicas.get(e.entidad)!.situaciones.set(p.periodo, e.situacion)
    }
  }

  // Ordenar entidades por la peor situación que registraron (peor primero)
  const entidadesOrdenadas = [...entidadesUnicas.entries()].sort((a, b) => {
    const peorA = Math.max(...a[1].situaciones.values())
    const peorB = Math.max(...b[1].situaciones.values())
    return peorB - peorA
  })

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#0a0e1a] px-2 py-1 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                Entidad
              </th>
              {sorted.map((p) => (
                <th
                  key={p.periodo}
                  className="px-0.5 py-1 text-[9px] text-muted-foreground font-normal"
                  style={{ minWidth: 22 }}
                >
                  <div className="rotate-[-60deg] origin-bottom-left whitespace-nowrap">
                    {formatPeriodoCorto(p.periodo)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entidadesOrdenadas.map(([nombre, info]) => (
              <tr key={nombre}>
                <td className="sticky left-0 z-10 bg-[#0a0e1a] px-2 py-1 text-xs text-foreground/90 truncate max-w-[180px]">
                  {nombre}
                </td>
                {sorted.map((p) => {
                  const sit = info.situaciones.get(p.periodo)
                  return (
                    <td
                      key={p.periodo}
                      className="px-0.5 py-0.5"
                      title={
                        sit ? `${formatPeriodoCorto(p.periodo)} · Sit ${sit}` : 'Sin reporte'
                      }
                    >
                      <div
                        className={cn(
                          'h-5 w-5 rounded-sm',
                          sit ? SIT_BG[sit] : 'bg-white/[0.04]'
                        )}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-sm', SIT_BG[s])} />
            Sit {s} · {SIT_LABEL[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-white/[0.04]" />
          Sin reporte
        </span>
      </div>
    </div>
  )
}
