import { formatCurrency } from '@/lib/utils'
import type { BcraChequesResponse } from '@/lib/consulta-360/types'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

export function ChequesSection({ data }: { data: BcraChequesResponse | null }) {
  const causales = data?.results?.causales ?? []
  const totalCheques = causales.reduce(
    (s, c) => s + c.entidades.reduce((s2, e) => s2 + (e.detalle?.length ?? 0), 0),
    0
  )

  if (totalCheques === 0) {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/[0.04] p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-300">Sin cheques rechazados</p>
          <p className="text-xs text-muted-foreground">No se encontraron cheques rechazados en BCRA.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-300">
            {totalCheques} cheque{totalCheques !== 1 && 's'} rechazado{totalCheques !== 1 && 's'}
          </p>
          <p className="text-xs text-muted-foreground">Detalle por causal y entidad.</p>
        </div>
      </div>

      <div className="space-y-3">
        {causales.map((c, ci) => (
          <div key={ci} className="rounded-lg border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-2 bg-white/[0.02] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {c.causal}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">N° Cheque</th>
                  <th className="px-4 py-2 font-medium">F. rechazo</th>
                  <th className="px-4 py-2 font-medium text-right">Monto</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {c.entidades.flatMap((e) =>
                  (e.detalle ?? []).map((d, di) => (
                    <tr key={`${ci}-${e.entidad}-${di}`}>
                      <td className="px-4 py-2 tabular-nums text-foreground">{d.numeroCheque}</td>
                      <td className="px-4 py-2 text-muted-foreground">{d.fechaRechazo ?? '—'}</td>
                      <td className="px-4 py-2 tabular-nums text-right text-foreground">
                        {formatCurrency((Number(d.monto) || 0) * 1000)}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {d.fechaPago ? `Pagado ${d.fechaPago}` : 'Pendiente'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
