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
        <header className="border-b bg-card">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">Simulador de Credito</span>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-[400px] w-full rounded-xl" />
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
              El simulador todavia no fue configurado. Contacta al prestamista para mas info.
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
    <div className="bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Simulador de Credito</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Form */}
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-foreground">
                Simula tu prestamo
              </h1>
              <p className="text-sm text-muted-foreground">
                Elegi el monto y el plazo que mejor te quede
              </p>
            </div>

            {/* Capital slider */}
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">Monto del prestamo</Label>
              <p className="text-3xl font-black text-foreground tabular-nums tracking-tight text-center">
                {formatCurrency(parseFloat(capital) || 0, currency)}
              </p>
              <input
                type="range"
                min={minCapital}
                max={maxCapital}
                step={step}
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{formatCurrency(minCapital, currency)}</span>
                <span>{formatCurrency(maxCapital, currency)}</span>
              </div>
              <Input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Monto exacto"
                className="h-8 text-sm text-center"
              />
            </div>

            {/* Term pills */}
            <div className="space-y-3">
              <Label>Plazos a comparar</Label>
              <div className="flex flex-wrap gap-2">
                {availableTerms.map((term) => {
                  const isSelected = selectedTerms.includes(term)
                  return (
                    <button
                      key={term}
                      onClick={() => toggleTerm(term)}
                      className={cn(
                        "px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {term} {pluralize(term, 'mes', 'meses')}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              onClick={handleSimulate}
              disabled={isLoading || !parseFloat(capital) || selectedTerms.length === 0}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Simular
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
      `Hola! Estuve viendo el simulador de prestamos.`,
      ``,
      `Me interesa:`,
      `- Monto: ${fmtClean(capital)}`,
      `- ${selectedResult.termMonths} ${pluralize(selectedResult.termMonths, 'cuota')} de ${fmtClean(amt)}`,
      selectedResult.amortizationTable?.[0]?.date
        ? `- Primera cuota: ${formatFirstDueDate(selectedResult.amortizationTable[0].date)}`
        : '',
      ``,
      `Me pasas mas info?`,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Tu simulacion
        </p>
        <h2 className="text-3xl font-black text-foreground">
          {formatCurrency(capital, currency)}
        </h2>
        <p className="text-muted-foreground text-sm">
          Elegi la opcion que te quede mas comoda
        </p>
      </div>

      {/* Plan cards */}
      <div className={cn(
        "grid gap-4",
        results.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
      )}>
        {results.map((result, index) => {
          const amt = result.roundedInstallmentAmount || result.installmentAmount || 0
          const isRecommended = index === maxTermIndex
          const isSelected = selectedIndex === index
          return (
            <div key={result.termMonths} className="relative">
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="text-[10px] px-2.5 py-0.5 shadow-sm">
                    Cuota mas baja
                  </Badge>
                </div>
              )}
              <Card
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:border-primary/50",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/[0.03]"
                    : "hover:shadow-md",
                  isRecommended && !isSelected && "border-primary/30"
                )}
                onClick={() => setSelectedIndex(index)}
              >
                <CardContent className="p-5 text-center space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {result.termMonths} {pluralize(result.termMonths, 'cuota')}
                  </p>
                  <p className="text-2xl font-black text-foreground">
                    {fmtClean(amt)}
                  </p>
                  <p className="text-xs text-muted-foreground">por mes</p>
                  {result.amortizationTable?.[0]?.date && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Primera cuota: {formatFirstDueDate(result.amortizationTable[0].date)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      {/* Selection summary + WhatsApp CTA */}
      {selectedResult && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">
                  {selectedResult.termMonths} {pluralize(selectedResult.termMonths, 'cuota')} de{' '}
                  {fmtClean(selectedResult.roundedInstallmentAmount || selectedResult.installmentAmount || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cuotas fijas mensuales.
                  {selectedResult.amortizationTable?.[0]?.date && (
                    <> Primera cuota: {formatFirstDueDate(selectedResult.amortizationTable[0].date)}</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total a pagar: {fmtClean(selectedResult.totalPaid || 0)}
                </p>
              </div>
            </div>

            <Button
              onClick={openWhatsApp}
              size="lg"
              className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              Solicitar por WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Amortization table */}
      {selectedResult?.amortizationTable && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="font-bold text-sm mb-3">
              Detalle de cuotas — {selectedResult.termMonths} {pluralize(selectedResult.termMonths, 'mes', 'meses')}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium text-xs">N</th>
                    <th className="text-left py-2 px-2 font-medium text-xs">Fecha</th>
                    <th className="text-right py-2 px-2 font-medium text-xs">Cuota</th>
                    <th className="text-right py-2 px-2 font-medium text-xs">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResult.amortizationTable.map((row) => (
                    <tr key={row.month} className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-xs">{row.month}</td>
                      <td className="py-1.5 px-2 text-xs text-muted-foreground">{row.date}</td>
                      <td className="py-1.5 px-2 text-right text-xs">{fmtClean(row.installment)}</td>
                      <td className="py-1.5 px-2 text-right text-xs font-medium">{fmtClean(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
