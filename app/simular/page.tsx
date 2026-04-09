'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn, pluralize } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Calculator,
  CheckCircle,
  MessageCircle,
} from 'lucide-react'
import type { SimulationResult } from '@/lib/loan-calculator'

function formatFirstDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PublicSimulatorPage() {
  const { data: config, isLoading: configLoading, error: configError } = trpc.publicSimulator.getConfig.useQuery()

  if (configLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calculator className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold text-lg">Simulador de Crédito</span>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </main>
      </div>
    )
  }

  if (configError || !config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-lg font-bold text-foreground">Simulador no disponible</p>
            <p className="text-sm text-muted-foreground">
              El simulador todavía no fue configurado. Contactá al prestamista para más info.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <SimulatorForm config={config} />
}

// ─── Simulator Form ──────────────────────────────────────────────────

interface SimulatorConfig {
  tna: number
  currency: string
  terms: number[]
  whatsapp: string
  minCapital: number
  maxCapital: number
}

function SimulatorForm({ config }: { config: SimulatorConfig }) {
  const currency = config.currency as 'ARS' | 'USD'
  const availableTerms = config.terms

  const minCapital = config.minCapital
  const maxCapital = config.maxCapital
  const step = currency === 'USD' ? 100 : 10000

  const defaultCapital = Math.round((minCapital + maxCapital) / 2 / (currency === 'USD' ? 100 : 10000)) * (currency === 'USD' ? 100 : 10000)
  const [capital, setCapital] = useState(String(defaultCapital))
  const [selectedTerms, setSelectedTerms] = useState<number[]>(availableTerms.slice(0, 3))
  const [results, setResults] = useState<SimulationResult[] | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [shouldScroll, setShouldScroll] = useState(false)

  useEffect(() => {
    if (shouldScroll && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' })
      setShouldScroll(false)
    }
  }, [shouldScroll, results])

  const simulateMutation = trpc.publicSimulator.simulate.useMutation({
    onSuccess: (data) => {
      setResults(data)
      setShouldScroll(true)
    },
  })

  function handleSimulate() {
    const cap = parseFloat(capital)
    if (!cap || cap <= 0 || selectedTerms.length === 0) return
    simulateMutation.mutate({ capital: cap, terms: selectedTerms })
  }

  function toggleTerm(term: number) {
    if (selectedTerms.includes(term)) {
      if (selectedTerms.length > 1) {
        setSelectedTerms(selectedTerms.filter(t => t !== term))
      }
    } else if (selectedTerms.length < 4) {
      setSelectedTerms([...selectedTerms, term].sort((a, b) => a - b))
    }
  }

  const isLoading = simulateMutation.isPending

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-lg">Simulador de Crédito</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-10 relative z-10">
        {/* Form */}
        <Card className="max-w-xl mx-auto border-border/50">
          <CardContent className="p-6 sm:p-10 space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Simulá tu préstamo
              </h1>
              <p className="text-sm text-muted-foreground">
                Elegí el monto y el plazo que mejor te quede
              </p>
            </div>

            {/* Capital slider */}
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Monto a solicitar</span>
                <p className="text-4xl sm:text-5xl font-extrabold text-foreground tabular-nums tracking-tighter text-center">
                  {formatCurrency(parseFloat(capital) || 0, currency)}
                </p>
              </div>
              <input
                type="range"
                min={minCapital}
                max={maxCapital}
                step={step}
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full slider-premium"
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-semibold text-muted-foreground/60 bg-muted px-2 py-1 rounded-md border border-border tabular-nums">
                  {formatCurrency(minCapital, currency)}
                </span>
                <Input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Monto exacto"
                  className="h-8 w-28 text-sm text-center tabular-nums"
                />
                <span className="text-[10px] font-semibold text-muted-foreground/60 bg-muted px-2 py-1 rounded-md border border-border tabular-nums">
                  {formatCurrency(maxCapital, currency)}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Term pills */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <Label>Plazos a comparar</Label>
                <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  Hasta 4
                </span>
              </div>
              <div className={cn(
                "grid gap-2",
                availableTerms.length <= 4 ? `grid-cols-${availableTerms.length}` : "grid-cols-4"
              )}>
                {availableTerms.map((term) => {
                  const isSelected = selectedTerms.includes(term)
                  return (
                    <button
                      key={term}
                      onClick={() => toggleTerm(term)}
                      className={cn(
                        "h-12 rounded-xl border text-lg font-bold transition-all duration-200",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]"
                          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                      )}
                    >
                      {term}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                {selectedTerms.length} {pluralize(selectedTerms.length, 'plazo seleccionado', 'plazos seleccionados')}
              </p>
            </div>

            <Button
              onClick={handleSimulate}
              disabled={isLoading || !parseFloat(capital) || selectedTerms.length === 0}
              className="w-full h-14 text-lg font-bold rounded-xl shadow-[0_0_30px_-10px_rgba(59,130,246,0.4)]"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="h-5 w-5 mr-2" />
                  Simular Opciones
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results && results.length > 0 && (
          <div ref={resultsRef}>
            <PublicResults results={results} currency={currency} whatsapp={config.whatsapp} />
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Results Display ─────────────────────────────────────────────────

function PublicResults({ results, currency, whatsapp }: { results: SimulationResult[]; currency: string; whatsapp: string }) {
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    results.reduce((maxI, r, i, arr) => r.termMonths > arr[maxI].termMonths ? i : maxI, 0)
  )

  useEffect(() => {
    setSelectedIndex(results.reduce((maxI, r, i, arr) => r.termMonths > arr[maxI].termMonths ? i : maxI, 0))
  }, [results])

  const capital = results[0].capital
  const selectedResult = results[selectedIndex] ?? null
  const maxTermIndex = results.reduce((maxI, r, i, arr) => r.termMonths > arr[maxI].termMonths ? i : maxI, 0)

  const fmtClean = useCallback((amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
  , [currency])

  function openWhatsApp() {
    if (!selectedResult) return
    const amt = selectedResult.roundedInstallmentAmount || selectedResult.installmentAmount || 0
    const message = [
      `Hola! Estuve viendo el simulador de préstamos.`,
      ``,
      `Me interesa:`,
      `- Monto: ${fmtClean(capital)}`,
      `- ${selectedResult.termMonths} ${pluralize(selectedResult.termMonths, 'cuota')} de ${fmtClean(amt)}`,
      selectedResult.amortizationTable?.[0]?.date
        ? `- Primera cuota: ${formatFirstDueDate(selectedResult.amortizationTable[0].date)}`
        : '',
      ``,
      `Me pasás más info?`,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <CheckCircle className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Tu simulación lista</h2>
          <p className="text-sm text-muted-foreground">
            Capital solicitado: <strong className="text-foreground">{formatCurrency(capital, currency)}</strong>
          </p>
        </div>
      </div>

      {/* Plan cards */}
      <div className={cn(
        "grid gap-4",
        results.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
      )}>
        {results.map((result, index) => {
          const amt = result.roundedInstallmentAmount || result.installmentAmount || 0
          const isRecommended = index === maxTermIndex
          const isSelected = selectedIndex === index
          return (
            <button
              key={result.termMonths}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "relative rounded-2xl p-5 text-left transition-all duration-200 outline-none",
                isSelected
                  ? "bg-primary/[0.08] border-2 border-primary ring-2 ring-primary/20"
                  : "bg-card border border-border hover:bg-muted/50 hover:shadow-md"
              )}
            >
              {isSelected && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-primary/30 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Elegido
                </div>
              )}
              {isRecommended && !isSelected && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge variant="success" className="text-[10px] px-2.5 py-0.5 shadow-sm">
                    Cuota más baja
                  </Badge>
                </div>
              )}
              <div className={cn("mb-3", isSelected && "mt-1")}>
                <span className={cn(
                  "text-sm font-semibold uppercase tracking-wider",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}>
                  {result.termMonths} {pluralize(result.termMonths, 'cuota')}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className={cn(
                  "font-extrabold tracking-tight tabular-nums",
                  isSelected ? "text-3xl text-primary" : "text-2xl text-foreground"
                )}>
                  {fmtClean(amt)}
                </span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded w-max border",
                  isSelected
                    ? "text-primary/80 bg-primary/10 border-primary/20"
                    : "text-muted-foreground bg-muted/50 border-border"
                )}>
                  por mes
                </span>
              </div>
              {result.amortizationTable?.[0]?.date && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  1ra cuota: {formatFirstDueDate(result.amortizationTable[0].date)}
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground flex justify-between">
                  <span>Total:</span>
                  <span className={cn("font-semibold", isSelected ? "text-foreground" : "text-muted-foreground")}>
                    {fmtClean(result.totalPaid || 0)}
                  </span>
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Selection summary + WhatsApp CTA */}
      {selectedResult && (
        <div className="relative overflow-hidden bg-gradient-to-r from-card to-card/80 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border border-border/50 shadow-lg">
          {/* BG Decoration */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-[#25D366]/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="flex-1 space-y-2 w-full text-center sm:text-left relative z-10">
            <h4 className="text-lg font-bold text-foreground">
              Plan seleccionado: <span className="text-primary">{selectedResult.termMonths} {pluralize(selectedResult.termMonths, 'cuota')}</span>
            </h4>
            <p className="text-sm text-muted-foreground">
              {fmtClean(selectedResult.roundedInstallmentAmount || selectedResult.installmentAmount || 0)} por mes.
              {selectedResult.amortizationTable?.[0]?.date && (
                <> Primera cuota: <strong className="text-foreground">{formatFirstDueDate(selectedResult.amortizationTable[0].date)}</strong></>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Total a pagar: {fmtClean(selectedResult.totalPaid || 0)}
            </p>
          </div>

          <Button
            onClick={openWhatsApp}
            size="lg"
            className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 font-bold shadow-[0_0_30px_-10px_rgba(37,211,102,0.4)] relative z-10"
          >
            <MessageCircle className="h-5 w-5" />
            Solicitar por WhatsApp
          </Button>
        </div>
      )}

      {/* Amortization table */}
      {selectedResult?.amortizationTable && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider pl-1">
            Tabla de Amortización — {selectedResult.termMonths} {pluralize(selectedResult.termMonths, 'mes', 'meses')}
          </h4>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      <th className="p-3 sm:p-4 w-16 text-center">N</th>
                      <th className="p-3 sm:p-4 text-left">Vencimiento</th>
                      <th className="p-3 sm:p-4 text-right">Cuota</th>
                      <th className="p-3 sm:p-4 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedResult.amortizationTable.map((row, i) => (
                      <tr
                        key={row.month}
                        className={cn(
                          "border-b border-border/30 hover:bg-muted/30 transition-colors",
                          i % 2 === 1 && "bg-muted/10"
                        )}
                      >
                        <td className="p-3 sm:p-4 text-center text-muted-foreground font-medium tabular-nums">{row.month}</td>
                        <td className="p-3 sm:p-4 text-foreground font-medium">{row.date}</td>
                        <td className="p-3 sm:p-4 text-right font-bold text-primary tabular-nums">{fmtClean(row.installment)}</td>
                        <td className={cn(
                          "p-3 sm:p-4 text-right tabular-nums font-medium",
                          row.balance === 0 ? "text-accent-positive font-bold" : "text-muted-foreground"
                        )}>
                          {fmtClean(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
