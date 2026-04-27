import { formatCurrency } from '@/lib/utils'
import type { BcraEntidadDeuda } from '@/lib/consulta-360/types'
import { SituacionBadge } from './situacion-badge'

export function EntidadesTable({ entidades }: { entidades: BcraEntidadDeuda[] }) {
  if (!entidades.length) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-muted-foreground">
        No hay deudas registradas en el sistema financiero argentino.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Entidad</th>
            <th className="px-4 py-2.5 font-medium">Situación</th>
            <th className="px-4 py-2.5 font-medium text-right">Monto</th>
            <th className="px-4 py-2.5 font-medium text-right">Días atraso</th>
            <th className="px-4 py-2.5 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {entidades.map((e, i) => {
            const flags: string[] = []
            if (e.refinanciaciones) flags.push('Refinanciada')
            if (e.recategorizacionOblig) flags.push('Recat. oblig.')
            if (e.situacionJuridica) flags.push('Sit. jurídica')
            if (e.irrecDisposicionTecnica) flags.push('Irrec. téc.')
            if (e.enRevision) flags.push('En revisión')
            if (e.procesoJud) flags.push('Proceso jud.')

            return (
              <tr key={`${e.entidad}-${i}`} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-foreground font-medium">{e.entidad}</td>
                <td className="px-4 py-3">
                  <SituacionBadge situacion={e.situacion} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {formatCurrency(Number(e.monto) * 1000)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {e.diasAtraso}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {flags.length ? flags.join(' · ') : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-muted-foreground/70 bg-white/[0.02] border-t border-white/[0.04]">
        BCRA reporta montos en miles de pesos. Mostrado ya convertido.
      </p>
    </div>
  )
}
