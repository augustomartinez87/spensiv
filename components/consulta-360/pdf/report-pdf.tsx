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
  if (p.length !== 6) return p
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${meses[parseInt(p.slice(4, 6), 10) - 1]} ${p.slice(2, 4)}`
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
}

export function ReportPdf({
  consulta,
  scoreResult,
  payloadBcra,
  payloadHistorico,
  payloadCheques,
  payloadAfip,
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.h1}>Consulta 360° · Informe crediticio</Text>
          <Text style={styles.muted}>
            {consulta.denominacion ?? 'Sin denominación'} · {formatCuitFmt(consulta.cuit)}
          </Text>
          <Text style={styles.faint}>
            Generado el {consultadoEn.toLocaleString('es-AR')}
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

        {/* Bloque B — Situación por entidad */}
        <Text style={styles.h2}>Situación por entidad (período {latestPeriodo?.periodo ?? '—'})</Text>
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
            </>
          )}
        </View>

        {/* Bloque D — Cheques */}
        <Text style={styles.h2}>Cheques rechazados</Text>
        <View style={styles.card}>
          {totalCheques === 0 ? (
            <Text style={[styles.muted, { color: COLORS.green }]}>Sin cheques rechazados.</Text>
          ) : (
            <Text style={styles.muted}>
              {totalCheques} cheque(s) rechazado(s) en el histórico BCRA.
            </Text>
          )}
        </View>

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

        {consulta.observaciones && (
          <>
            <Text style={styles.h2}>Nota privada</Text>
            <View style={styles.card}>
              <Text style={styles.tableCell}>{consulta.observaciones}</Text>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Datos públicos del BCRA (Central de Deudores) y AFIP (Padrón). Período BCRA:{' '}
          {latestPeriodo?.periodo
            ? `${latestPeriodo.periodo.slice(0, 4)}-${latestPeriodo.periodo.slice(4)}`
            : '—'}
          . Información de carácter informativo, no constituye un dictamen crediticio. Generado por Spensiv.
        </Text>
      </Page>
    </Document>
  )
}
