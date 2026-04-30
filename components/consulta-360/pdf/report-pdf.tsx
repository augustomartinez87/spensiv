import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type {
  BcraDeudasResponse,
  BcraHistoricasResponse,
  BcraChequesResponse,
  AfipPersona,
  ScoreResult,
  RiesgoBanda,
  BcraPeriodoDeuda,
} from '@/lib/consulta-360/types'
import { formatPeriodoCorto, formatPeriodoLargo } from '@/lib/consulta-360/periodo'
import { buildExecutiveSummary } from '@/components/consulta-360/executive-summary'
import {
  evolucionAtrasos,
  serie24m,
  frasePermanencia,
  TRAMOS_LABEL,
} from '@/lib/consulta-360/historico-aux'

const COLORS = {
  bg: '#0a0e1a',
  card: '#111726',
  border: '#1f2937',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textFaint: '#6b7280',
  green: '#10b981',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  zinc: '#71717a',
  violet: '#8b5cf6',
  white05: 'rgba(255,255,255,0.05)',
}

const BANDA_COLOR: Record<RiesgoBanda, string> = {
  bajo: COLORS.green,
  medio: COLORS.yellow,
  alto: COLORS.orange,
  critico: COLORS.red,
}

const BANDA_LABEL: Record<RiesgoBanda, string> = {
  bajo: 'RIESGO BAJO',
  medio: 'RIESGO MEDIO',
  alto: 'RIESGO ALTO',
  critico: 'RIESGO CRÍTICO',
}

const SIT_COLOR: Record<number, string> = {
  1: COLORS.green,
  2: COLORS.yellow,
  3: COLORS.orange,
  4: COLORS.red,
  5: COLORS.zinc,
  6: COLORS.zinc,
}

const SIT_LABEL: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Con problemas',
  4: 'Alto riesgo',
  5: 'Irrecuperable',
  6: 'Irrec. téc.',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    padding: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  h1: { fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 2 },
  h2: { fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 6, marginTop: 14 },
  muted: { color: COLORS.textMuted, fontSize: 9 },
  faint: { color: COLORS.textFaint, fontSize: 8 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    border: `1pt solid ${COLORS.border}`,
    padding: 12,
    marginBottom: 8,
  },
  row: { flexDirection: 'row' },
  scoreRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  scoreBox: {
    width: 110,
    height: 110,
    backgroundColor: COLORS.card,
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { fontSize: 36, fontWeight: 700 },
  scoreUnit: { fontSize: 8, color: COLORS.textMuted, marginTop: -4 },
  bandaPill: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.bg,
    borderRadius: 4,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stat: {
    flexBasis: '23%',
    backgroundColor: COLORS.card,
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 6,
    padding: 8,
  },
  statLabel: { fontSize: 7, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 13, fontWeight: 700, color: COLORS.text, marginTop: 2 },
  table: { borderRadius: 6, overflow: 'hidden', border: `1pt solid ${COLORS.border}` },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.white05,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableHeaderCell: { fontSize: 8, color: COLORS.textMuted, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderTop: `0.5pt solid ${COLORS.border}`,
  },
  tableCell: { fontSize: 9, color: COLORS.text },
  pill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.bg,
  },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: 18, height: 18, borderRadius: 2 },
  legendDot: { width: 6, height: 6, borderRadius: 1, marginRight: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  barTrack: {
    height: 4,
    backgroundColor: COLORS.white05,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  barFill: { height: 4, borderRadius: 2 },
  footer: {
    marginTop: 14,
    paddingTop: 8,
    borderTop: `0.5pt solid ${COLORS.border}`,
    fontSize: 7,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
})

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatCuitFmt(cuit: string): string {
  if (cuit.length !== 11) return cuit
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
}

function periodoToShort(p: string): string {
  return formatPeriodoCorto(p)
}

function colorForRaw(raw: number): string {
  if (raw >= 800) return COLORS.green
  if (raw >= 600) return COLORS.yellow
  if (raw >= 400) return COLORS.orange
  return COLORS.red
}

export type ReportPdfProps = {
  consulta: {
    cuit: string
    denominacion: string | null
    consultadoEn: Date | string
    score: number
    riesgo: RiesgoBanda
    peorSituacion: number | null
    totalDeudaArs: number
    cantEntidades: number
    chequesRechazados: number
    bcraStatus: 'ok' | 'not_found' | 'error'
    afipStatus: 'ok' | 'unavailable' | 'error'
    observaciones: string | null
  }
  scoreResult: ScoreResult
  payloadBcra: BcraDeudasResponse | null
  payloadHistorico: BcraHistoricasResponse | null
  payloadCheques: BcraChequesResponse | null
  payloadAfip: AfipPersona | null
  /** "ALYCBUR SA" — solicitante. Se imprime en el header. */
  solicitante?: string | null
  /** Conteo de consultas internas por mes para "Consultas y seguimientos". */
  consultasPorMes?: { periodo: string; cantidad: number }[]
}

export function ReportPdf({
  consulta,
  scoreResult,
  payloadBcra,
  payloadHistorico,
  payloadCheques,
  payloadAfip,
  solicitante,
  consultasPorMes,
}: ReportPdfProps) {
  const latestPeriodo = payloadBcra?.results?.periodos?.[0]
  const entidades = latestPeriodo?.entidades ?? []
  const periodos = payloadHistorico?.results?.periodos ?? []
  const ult24 = [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-24)

  const totalCheques = (payloadCheques?.results?.causales ?? []).reduce(
    (s, c) => s + c.entidades.reduce((s2, e) => s2 + (e.detalle?.length ?? 0), 0),
    0
  )

  const consultadoEn = new Date(consulta.consultadoEn)
  const bandaColor = BANDA_COLOR[consulta.riesgo]
  const periodoLargo = formatPeriodoLargo(latestPeriodo?.periodo)

  const resumen = buildExecutiveSummary({
    denominacion: consulta.denominacion,
    riesgo: consulta.riesgo,
    score: consulta.score,
    bcraDeudas: payloadBcra,
    bcraHistoricas: payloadHistorico,
    bcraCheques: payloadCheques,
    afip: payloadAfip,
  })

  const narrativaPermanencia = frasePermanencia(payloadHistorico, payloadBcra)
  const serieAntecedentes = serie24m(payloadHistorico)
  const atrasos = evolucionAtrasos(payloadHistorico)
  const tramoTieneMonto = (() => {
    const cols = ['normal', 't31_90', 't91_180', 't181_365', 'tMayor365', 'sit6'] as const
    const has: Record<string, boolean> = {}
    for (const c of cols) has[c] = atrasos.some((a) => a.tramos[c] > 0)
    return has
  })()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header tipo Nosis: solicitante + fecha + disclaimer */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            borderBottom: `0.5pt solid ${COLORS.border}`,
            paddingBottom: 4,
            marginBottom: 8,
          }}
        >
          <Text style={styles.faint}>
            Solicitado por: {solicitante ?? 'Spensiv'}
          </Text>
          <Text style={styles.faint}>Fecha: {consultadoEn.toLocaleString('es-AR')}</Text>
        </View>
        <Text
          style={[
            styles.faint,
            { textAlign: 'center', marginBottom: 2, fontStyle: 'italic' },
          ]}
        >
          Información confidencial. Se prohíbe su exhibición o divulgación.
        </Text>
        <Text style={[styles.faint, { textAlign: 'center', marginBottom: 10 }]}>
          No implica juicio de valor sobre las personas citadas ni sobre su solvencia.
        </Text>

        <Text style={styles.h1}>
          Informe Individual ·{' '}
          <Text style={{ color: COLORS.textMuted }}>{formatCuitFmt(consulta.cuit)}</Text>
          {consulta.denominacion ? ` | ${consulta.denominacion}` : ''}
        </Text>
        <View
          style={{
            marginTop: 4,
            paddingHorizontal: 6,
            paddingVertical: 3,
            backgroundColor: 'rgba(139,92,246,0.12)',
            border: `0.5pt solid ${COLORS.violet}`,
            borderRadius: 4,
            alignSelf: 'flex-start',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 8, color: COLORS.violet, fontWeight: 700 }}>
            DATOS BCRA AL PERÍODO {periodoLargo.toUpperCase()}
          </Text>
        </View>

        {/* Bloque A — Score + stats */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNumber, { color: bandaColor }]}>{consulta.score}</Text>
            <Text style={styles.scoreUnit}>/ 1000</Text>
            <View style={[styles.bandaPill, { backgroundColor: bandaColor }]}>
              <Text>{BANDA_LABEL[consulta.riesgo]}</Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.statsGrid}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Total deuda</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(Number(consulta.totalDeudaArs) * 1000)}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Entidades</Text>
                <Text style={styles.statValue}>{consulta.cantEntidades}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Peor situación</Text>
                <Text style={styles.statValue}>
                  {consulta.peorSituacion ? `Sit ${consulta.peorSituacion}` : '—'}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Cheques rech. (12m)</Text>
                <Text style={styles.statValue}>{consulta.chequesRechazados}</Text>
              </View>
            </View>
            {scoreResult.flags.length > 0 && (
              <Text style={styles.faint}>
                Flags: {scoreResult.flags.map((f) => f.replace(/_/g, ' ')).join(' · ')}
              </Text>
            )}
          </View>
        </View>

        {/* Resumen ejecutivo */}
        <View
          style={{
            backgroundColor: 'rgba(139,92,246,0.06)',
            border: `0.5pt solid rgba(139,92,246,0.4)`,
            borderRadius: 6,
            padding: 8,
            marginTop: 4,
            marginBottom: 4,
          }}
        >
          <Text style={[styles.faint, { color: COLORS.violet, marginBottom: 3 }]}>
            RESUMEN EJECUTIVO
          </Text>
          <Text style={[styles.tableCell, { lineHeight: 1.4 }]}>{resumen}</Text>
        </View>

        {/* Bloque B — Situación por entidad */}
        <Text style={styles.h2}>Situación por entidad ({periodoLargo})</Text>
        {entidades.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No hay deudas registradas en BCRA.</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Entidad</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Situación</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Monto</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Atraso</Text>
            </View>
            {entidades.map((e, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{e.entidad}</Text>
                <View style={{ flex: 2 }}>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: SIT_COLOR[e.situacion] ?? COLORS.zinc, alignSelf: 'flex-start' },
                    ]}
                  >
                    <Text>
                      {e.situacion} · {SIT_LABEL[e.situacion] ?? '—'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right' }]}>
                  {formatCurrency(Number(e.monto) * 1000)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{e.diasAtraso}d</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bloque C — Heatmap 24m */}
        <Text style={styles.h2}>Histórico (24 meses)</Text>
        <View style={styles.card}>
          {ult24.length === 0 ? (
            <Text style={styles.muted}>Sin histórico disponible.</Text>
          ) : (
            <>
              <View style={styles.heatmap}>
                {ult24.map((p: BcraPeriodoDeuda, i) => {
                  const peor = p.entidades.length
                    ? p.entidades.reduce((peor, e) => (e.situacion > peor ? e.situacion : peor), 1)
                    : null
                  return (
                    <View
                      key={i}
                      style={[
                        styles.heatCell,
                        { backgroundColor: peor ? SIT_COLOR[peor] : COLORS.white05 },
                      ]}
                    />
                  )
                })}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={styles.faint}>{periodoToShort(ult24[0].periodo)}</Text>
                <View style={[styles.row, { gap: 0 }]}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <View key={s} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: SIT_COLOR[s] }]} />
                      <Text style={styles.faint}>Sit {s}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.faint}>{periodoToShort(ult24[ult24.length - 1].periodo)}</Text>
              </View>
              {narrativaPermanencia && (
                <Text style={[styles.faint, { marginTop: 6, fontStyle: 'italic' }]}>
                  {narrativaPermanencia}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Bloque C1.5 — Grid 24m: período × peor sit × cant entidades × deuda */}
        {serieAntecedentes.length > 0 && (
          <>
            <Text style={styles.h2}>Antecedentes crediticios — 24 meses</Text>
            <View style={[styles.card, { padding: 6 }]}>
              <Text style={[styles.faint, { marginBottom: 4 }]}>
                Importes en miles de pesos (BCRA).
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 80 }}>
                  <Text
                    style={[styles.tableHeaderCell, { paddingVertical: 2, paddingLeft: 2 }]}
                  >
                    Período
                  </Text>
                  <Text
                    style={[styles.tableHeaderCell, { paddingVertical: 2, paddingLeft: 2 }]}
                  >
                    Sit. peor
                  </Text>
                  <Text
                    style={[styles.tableHeaderCell, { paddingVertical: 2, paddingLeft: 2 }]}
                  >
                    Bancos
                  </Text>
                  <Text
                    style={[styles.tableHeaderCell, { paddingVertical: 2, paddingLeft: 2 }]}
                  >
                    Deuda (k)
                  </Text>
                </View>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  {serieAntecedentes.map((row) => (
                    <View
                      key={row.periodo}
                      style={{ flex: 1, alignItems: 'center', paddingHorizontal: 0.5 }}
                    >
                      <Text style={[styles.faint, { fontSize: 6 }]}>
                        {periodoToShort(row.periodo)}
                      </Text>
                      <View
                        style={{
                          width: '100%',
                          height: 10,
                          backgroundColor:
                            row.peor !== null ? SIT_COLOR[row.peor] : COLORS.white05,
                          marginVertical: 1,
                        }}
                      />
                      <Text style={[styles.tableCell, { fontSize: 7 }]}>
                        {row.cantEntidades || '-'}
                      </Text>
                      <Text style={[styles.tableCell, { fontSize: 6 }]}>
                        {row.deudaArs > 0
                          ? Math.round(row.deudaArs / 1000).toLocaleString('es-AR')
                          : '-'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        {/* Bloque C1.6 — Evolución de atrasos por tramo */}
        {atrasos.length > 0 && atrasos.some((a) => a.total > 0) && (
          <>
            <Text style={styles.h2}>Evolución de atrasos (12 meses)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Período</Text>
                {tramoTieneMonto.normal && (
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                    {TRAMOS_LABEL.normal}
                  </Text>
                )}
                {tramoTieneMonto.t31_90 && (
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                    {TRAMOS_LABEL.t31_90}
                  </Text>
                )}
                {tramoTieneMonto.t91_180 && (
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                    {TRAMOS_LABEL.t91_180}
                  </Text>
                )}
                {tramoTieneMonto.t181_365 && (
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                    {TRAMOS_LABEL.t181_365}
                  </Text>
                )}
                {tramoTieneMonto.tMayor365 && (
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                    {TRAMOS_LABEL.tMayor365}
                  </Text>
                )}
                {tramoTieneMonto.sit6 && (
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                    {TRAMOS_LABEL.sit6}
                  </Text>
                )}
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { flex: 1, textAlign: 'right', fontWeight: 700 },
                  ]}
                >
                  Total
                </Text>
              </View>
              {atrasos.map((a) => (
                <View key={a.periodo} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.2 }]}>
                    {periodoToShort(a.periodo)}
                  </Text>
                  {tramoTieneMonto.normal && (
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {a.tramos.normal > 0 ? formatCurrency(a.tramos.normal) : '—'}
                    </Text>
                  )}
                  {tramoTieneMonto.t31_90 && (
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {a.tramos.t31_90 > 0 ? formatCurrency(a.tramos.t31_90) : '—'}
                    </Text>
                  )}
                  {tramoTieneMonto.t91_180 && (
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {a.tramos.t91_180 > 0 ? formatCurrency(a.tramos.t91_180) : '—'}
                    </Text>
                  )}
                  {tramoTieneMonto.t181_365 && (
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {a.tramos.t181_365 > 0 ? formatCurrency(a.tramos.t181_365) : '—'}
                    </Text>
                  )}
                  {tramoTieneMonto.tMayor365 && (
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {a.tramos.tMayor365 > 0 ? formatCurrency(a.tramos.tMayor365) : '—'}
                    </Text>
                  )}
                  {tramoTieneMonto.sit6 && (
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {a.tramos.sit6 > 0 ? formatCurrency(a.tramos.sit6) : '—'}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.tableCell,
                      { flex: 1, textAlign: 'right', fontWeight: 700 },
                    ]}
                  >
                    {formatCurrency(a.total)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Bloque C2 — Distribución por situación */}
        {entidades.length > 1 && (() => {
          const buckets = new Map<number, { monto: number; cant: number }>()
          let total = 0
          for (const e of entidades) {
            const m = (Number(e.monto) || 0) * 1000
            total += m
            const b = buckets.get(e.situacion) ?? { monto: 0, cant: 0 }
            b.monto += m
            b.cant += 1
            buckets.set(e.situacion, b)
          }
          if (total === 0) return null
          const ordenado = [...buckets.entries()].sort((a, b) => a[0] - b[0])
          return (
            <>
              <Text style={styles.h2}>Distribución de la deuda</Text>
              <View style={styles.card}>
                <View
                  style={{
                    flexDirection: 'row',
                    height: 8,
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginBottom: 6,
                  }}
                >
                  {ordenado.map(([sit, b]) => (
                    <View
                      key={sit}
                      style={{
                        flex: b.monto,
                        backgroundColor: SIT_COLOR[sit] ?? COLORS.zinc,
                      }}
                    />
                  ))}
                </View>
                {ordenado.map(([sit, b]) => (
                  <View
                    key={sit}
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
                  >
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: SIT_COLOR[sit] ?? COLORS.zinc },
                      ]}
                    />
                    <Text style={styles.tableCell}>
                      Sit {sit} ({SIT_LABEL[sit] ?? '—'}):{' '}
                      {formatCurrency(b.monto)} · {((b.monto / total) * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )
        })()}

        {/* Bloque D — Cheques con detalle */}
        <Text style={styles.h2}>Cheques rechazados</Text>
        {totalCheques === 0 ? (
          <View style={styles.card}>
            <Text style={[styles.muted, { color: COLORS.green }]}>Sin cheques rechazados.</Text>
          </View>
        ) : (
          (() => {
            const filas: {
              causal: string
              entidad: number
              numero: number
              fechaRechazo: string
              monto: number
              pagado: boolean
              fechaPago?: string
            }[] = []
            for (const c of payloadCheques?.results?.causales ?? []) {
              for (const ent of c.entidades) {
                for (const det of ent.detalle ?? []) {
                  filas.push({
                    causal: c.causal,
                    entidad: ent.entidad,
                    numero: det.numeroCheque,
                    fechaRechazo: det.fechaRechazo ?? '—',
                    monto: Number(det.monto) || 0,
                    pagado: !!det.fechaPago,
                    fechaPago: det.fechaPago,
                  })
                }
              }
            }
            const pendientes = filas.filter((f) => !f.pagado).length
            return (
              <>
                <View style={styles.card}>
                  <Text style={styles.muted}>
                    {totalCheques} cheque(s) rechazado(s){' '}
                    {pendientes > 0
                      ? `· ${pendientes} pendiente(s) de pago`
                      : '· todos regularizados'}
                    .
                  </Text>
                </View>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>N°</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Ent.</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>F. rechazo</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>
                      Monto
                    </Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Estado</Text>
                  </View>
                  {filas.map((f, i) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 1.5 }]}>{f.numero}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{f.entidad}</Text>
                      <Text style={[styles.tableCell, { flex: 1.5 }]}>{f.fechaRechazo}</Text>
                      <Text style={[styles.tableCell, { flex: 2, textAlign: 'right' }]}>
                        {formatCurrency(f.monto)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            flex: 2,
                            color: f.pagado ? COLORS.green : COLORS.red,
                          },
                        ]}
                      >
                        {f.pagado ? `Pagado ${f.fechaPago ?? ''}` : 'Pendiente'}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )
          })()
        )}

        {/* Bloque E — AFIP */}
        <Text style={styles.h2}>Datos fiscales (AFIP)</Text>
        <View style={styles.card}>
          {!payloadAfip || consulta.afipStatus !== 'ok' ? (
            <Text style={styles.muted}>
              Datos AFIP no disponibles ({consulta.afipStatus}). El informe se calcula con BCRA.
            </Text>
          ) : (
            <View style={{ gap: 3 }}>
              <Text style={styles.tableCell}>
                <Text style={styles.muted}>Nombre: </Text>
                {payloadAfip.razonSocial ||
                  [payloadAfip.apellido, payloadAfip.nombre].filter(Boolean).join(', ') ||
                  '—'}
              </Text>
              <Text style={styles.tableCell}>
                <Text style={styles.muted}>Tipo / Estado: </Text>
                {payloadAfip.tipoPersona ?? '—'} · {payloadAfip.estadoClave ?? '—'}
              </Text>
              {payloadAfip.domicilioFiscal && (
                <Text style={styles.tableCell}>
                  <Text style={styles.muted}>Domicilio: </Text>
                  {[
                    payloadAfip.domicilioFiscal.direccion,
                    payloadAfip.domicilioFiscal.localidad,
                    payloadAfip.domicilioFiscal.descripcionProvincia,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Text>
              )}
              {payloadAfip.actividad?.[0] && (
                <Text style={styles.tableCell}>
                  <Text style={styles.muted}>Actividad: </Text>
                  {payloadAfip.actividad[0].idActividad ?? '—'} ·{' '}
                  {payloadAfip.actividad[0].descripcionActividad ?? '—'}
                </Text>
              )}
              {payloadAfip.monotributo?.categoriaMonotributo && (
                <Text style={styles.tableCell}>
                  <Text style={styles.muted}>Monotributo: </Text>
                  Categoría {payloadAfip.monotributo.categoriaMonotributo}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Bloque F — Desglose del score */}
        <Text style={styles.h2}>Desglose del score</Text>
        <View style={styles.card}>
          <View style={{ gap: 6 }}>
            {scoreResult.components.map((c) => (
              <View key={c.key}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.tableCell}>
                    {c.label} <Text style={styles.faint}>· peso {Math.round(c.weight * 100)}%</Text>
                    {c.neutral && <Text style={styles.faint}> · neutro</Text>}
                  </Text>
                  <Text style={styles.tableCell}>{Math.round(c.raw)} / 1000</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { backgroundColor: colorForRaw(c.raw), width: `${(c.raw / 1000) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.faint}>{c.detail}</Text>
              </View>
            ))}
          </View>
          {scoreResult.overrides.length > 0 && (
            <View style={{ marginTop: 8, padding: 6, border: `1pt solid ${COLORS.red}`, borderRadius: 4 }}>
              <Text style={[styles.faint, { color: COLORS.red, marginBottom: 2 }]}>
                OVERRIDES APLICADOS
              </Text>
              {scoreResult.overrides.map((o, i) => (
                <Text key={i} style={[styles.tableCell, { color: COLORS.red }]}>
                  {o.reason} → cap {o.capAt}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Consultas y seguimientos — cuántas veces este CUIT fue consultado por el usuario */}
        {consultasPorMes && consultasPorMes.length > 0 && (
          <>
            <Text style={styles.h2}>Consultas y seguimientos</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Período</Text>
                {consultasPorMes.map((c) => (
                  <Text
                    key={c.periodo}
                    style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}
                  >
                    {periodoToShort(c.periodo)}
                  </Text>
                ))}
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                  Total
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Consultas internas</Text>
                {consultasPorMes.map((c) => (
                  <Text
                    key={c.periodo}
                    style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}
                  >
                    {c.cantidad || '-'}
                  </Text>
                ))}
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 1, textAlign: 'right', fontWeight: 700 },
                  ]}
                >
                  {consultasPorMes.reduce((s, c) => s + c.cantidad, 0)}
                </Text>
              </View>
            </View>
          </>
        )}

        {consulta.observaciones && (
          <>
            <Text style={styles.h2}>Nota privada</Text>
            <View style={styles.card}>
              <Text style={styles.tableCell}>{consulta.observaciones}</Text>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Datos públicos del BCRA (Central de Deudores) y AFIP (Padrón). Período BCRA: {periodoLargo}.
          Información de carácter informativo, no constituye un dictamen crediticio. Generado por
          Spensiv.
        </Text>
      </Page>
    </Document>
  )
}
