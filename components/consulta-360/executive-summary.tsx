import type {
  BcraDeudasResponse,
  BcraHistoricasResponse,
  BcraChequesResponse,
  AfipPersona,
  RiesgoBanda,
} from '@/lib/consulta-360/types'
import { formatCurrency } from '@/lib/utils'
import { formatPeriodoLargo, formatPeriodoCorto } from '@/lib/consulta-360/periodo'

const SIT_LABEL: Record<number, string> = {
  1: 'normal',
  2: 'riesgo bajo',
  3: 'con problemas',
  4: 'alto riesgo',
  5: 'irrecuperable',
  6: 'irrecuperable por disp. técnica',
}

const RIESGO_VERBO: Record<RiesgoBanda, string> = {
  bajo: 'apto sin reservas',
  medio: 'apto con condiciones',
  alto: 'solo recomendable con garantías',
  critico: 'no recomendado',
}

export function buildExecutiveSummary(args: {
  denominacion: string | null
  riesgo: RiesgoBanda
  score: number
  bcraDeudas: BcraDeudasResponse | null
  bcraHistoricas: BcraHistoricasResponse | null
  bcraCheques: BcraChequesResponse | null
  afip: AfipPersona | null
}): string {
  const { denominacion, riesgo, score, bcraDeudas, bcraHistoricas, bcraCheques, afip } = args
  const partes: string[] = []

  const sujeto = denominacion ?? 'El titular'

  // Período de referencia
  const ultPeriodo = bcraDeudas?.results?.periodos?.[0]?.periodo
  const refPeriodo = ultPeriodo ? ` (datos al ${formatPeriodoLargo(ultPeriodo)})` : ''

  // BCRA actual
  const ents = bcraDeudas?.results?.periodos?.[0]?.entidades ?? []
  const cant = ents.length
  const totalDeuda = ents.reduce((s, e) => s + (Number(e.monto) || 0), 0) * 1000
  const peor = ents.length
    ? ents.reduce((peor, e) => (e.situacion > peor ? e.situacion : peor), 1)
    : null

  if (cant === 0) {
    partes.push(`${sujeto} no registra deudas en el sistema financiero${refPeriodo}.`)
  } else {
    partes.push(
      `${sujeto} registra ${formatCurrency(totalDeuda)} de deuda en ${cant} entidad${cant !== 1 ? 'es' : ''}, peor situación ${peor} (${SIT_LABEL[peor!] ?? '—'})${refPeriodo}.`
    )
  }

  // Histórico
  const periodos = bcraHistoricas?.results?.periodos ?? []
  if (periodos.length > 0) {
    const sorted = [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo))
    const limpios = sorted.filter((p) => p.entidades.every((e) => e.situacion === 1)).length
    const desde = sorted[0].periodo
    partes.push(
      `Histórico de ${sorted.length} mes${sorted.length !== 1 ? 'es' : ''} (desde ${formatPeriodoCorto(desde)}), ${limpios} mes${limpios !== 1 ? 'es' : ''} en situación normal.`
    )

    // Tendencia: ¿la deuda creció o bajó vs hace 6m?
    if (sorted.length >= 6) {
      const ultimo = sorted[sorted.length - 1]
      const hace6 = sorted[sorted.length - 6]
      const ultMonto = ultimo.entidades.reduce((s, e) => s + (Number(e.monto) || 0), 0)
      const oldMonto = hace6.entidades.reduce((s, e) => s + (Number(e.monto) || 0), 0)
      if (oldMonto > 0) {
        const cambio = (ultMonto - oldMonto) / oldMonto
        if (Math.abs(cambio) >= 0.15) {
          partes.push(
            `Deuda ${cambio > 0 ? 'creció' : 'bajó'} ${(Math.abs(cambio) * 100).toFixed(0)}% en los últimos 6 meses.`
          )
        }
      }
    }
  }

  // Cheques
  let pend = 0
  let pag = 0
  for (const c of bcraCheques?.results?.causales ?? []) {
    for (const ent of c.entidades) {
      for (const det of ent.detalle ?? []) {
        if (det.fechaPago) pag += 1
        else pend += 1
      }
    }
  }
  if (pend === 0 && pag === 0) {
    partes.push('Sin cheques rechazados.')
  } else {
    const piezas: string[] = []
    if (pend > 0) piezas.push(`${pend} pendiente${pend !== 1 ? 's' : ''} de pago`)
    if (pag > 0) piezas.push(`${pag} regularizado${pag !== 1 ? 's' : ''}`)
    partes.push(`Cheques rechazados: ${piezas.join(' y ')}.`)
  }

  // AFIP
  if (afip?.estadoClave) {
    const estado = afip.estadoClave.toUpperCase()
    if (estado !== 'ACTIVO') {
      partes.push(`AFIP reporta clave ${estado.toLowerCase()}.`)
    }
  }

  // Conclusión
  partes.push(`Conclusión: score ${score}/1000 — ${RIESGO_VERBO[riesgo]}.`)

  return partes.join(' ')
}

export function ExecutiveSummary({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-4">
      <p className="text-xs uppercase tracking-wide text-violet-300/80 font-semibold mb-1.5">
        Resumen ejecutivo
      </p>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  )
}
