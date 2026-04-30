import { formatCurrency, cn } from '@/lib/utils'
import type { BcraChequesResponse } from '@/lib/consulta-360/types'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

export function ChequesSection({ data }: { data: BcraChequesResponse | null }) {
  const causales = data?.results?.causales ?? []
  let totalCheques = 0
  let totalPendientes = 0
  let montoPendienteArs = 0
  for (const c of causales) {
    for (const ent of c.entidades) {
      for (const det of ent.detalle ?? []) {
        totalCheques += 1
        if (!det.fechaPago) {
          totalPendientes += 1
          montoPendienteArs += Number(det.monto) || 0
        }
      }
    }
  }

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
        <div className="flex-1">
          <p className="text-sm font-medium text-red-300">
            {totalCheques} cheque{totalCheques !== 1 && 's'} rechazado{totalCheques !== 1 && 's'}
            {totalPendientes > 0 && (
              <span className="ml-1 text-red-200/80">
                · {totalPendientes} pendiente{totalPendientes !== 1 && 's'} ({formatCurrency(montoPendienteArs)})
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Detalle por causal y entidad. BCRA reporta monto en pesos.
          </p>
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
                  <th className="px-4 py-2 font-medium">Entidad</th>
                  <th className="px-4 py-2 font-medium">F. rechazo</th>
                  <th className="px-4 py-2 font-medium text-right">Monto</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {c.entidades.flatMap((e) =>
                  (e.detalle ?? []).map((d, di) => {
                    const pagado = !!d.fechaPago
                    return (
                      <tr key={`${ci}-${e.entidad}-${di}`}>
                        <td className="px-4 py-2 tabular-nums text-foreground">{d.numeroCheque}</td>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{e.entidad}</td>
                        <td className="px-4 py-2 text-muted-foreground">{d.fechaRechazo ?? '—'}</td>
                        <td className="px-4 py-2 tabular-nums text-right text-foreground">
                          {formatCurrency(Number(d.monto) || 0)}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 ring-1 ring-inset',
                              pagado
                                ? 'bg-green-500/10 text-green-300 ring-green-500/30'
                                : 'bg-red-500/10 text-red-300 ring-red-500/30'
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                pagado ? 'bg-green-300' : 'bg-red-300'
                              )}
                            />
                            {pagado ? `Pagado ${d.fechaPago}` : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
