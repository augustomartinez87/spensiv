'use client'

import { useState, useEffect } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn, formatDateToInput, pluralize } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, Zap, Shield, ShieldX, Info, Clock, AlertTriangle, ChevronDown, TrendingDown } from 'lucide-react'
import { CollectorSelector } from './collector-selector'
import { tnaToMonthlyRate } from '@/lib/loan-calculator'
import { getSmartFirstDueDate } from '@/lib/business-days'
import { getNextMonths } from '@/lib/periods'

export function CreateLoanDialog({
    open,
    onOpenChange,
    defaultValues,
    direction = 'lender',
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultValues?: {
        capital?: string
        tna?: string
        termMonths?: string
        startDate?: string
    }
    direction?: 'lender' | 'borrower'
}) {
    const utils = trpc.useUtils()
    const [borrowerName, setBorrowerName] = useState('')
    const [capital, setCapital] = useState(defaultValues?.capital || '')
    const [currency, setCurrency] = useState<'ARS' | 'USD' | 'EUR'>('ARS')
    const [loanType, setLoanType] = useState<'amortized' | 'interest_only'>('amortized')
    const [tna, setTna] = useState(defaultValues?.tna || '')
    const [monthlyRate, setMonthlyRate] = useState('')
    const [termMonths, setTermMonths] = useState(defaultValues?.termMonths || '')
    const [startDate, setStartDate] = useState(defaultValues?.startDate || formatDateToInput(new Date()))
    const [customInstallment, setCustomInstallment] = useState('')
    const [impliedTna, setImpliedTna] = useState<number | null>(null)
    const [selectedPersonId, setSelectedPersonId] = useState<string>('')
    const [creditorName, setCreditorName] = useState('')
    const [selectedBorrowerTypeId, setSelectedBorrowerTypeId] = useState<string>('')
    const [smartDueDate, setSmartDueDate] = useState(true)
    const [roundEnabled, setRoundEnabled] = useState(false)
    const [roundingMultiple, setRoundingMultiple] = useState<number>(1000)
    const [firstInstallmentMonth, setFirstInstallmentMonth] = useState<string>('')
    const [noInterest, setNoInterest] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [selectedCollectorId, setSelectedCollectorId] = useState<string>('')

    const { data: persons } = trpc.persons.list.useQuery()
    const { data: borrowerTypes } = trpc.rateRules.listBorrowerTypes.useQuery()
    const { data: durationAdjustments } = trpc.rateRules.listDurationAdjustments.useQuery()

    // Risk check for selected person
    const { data: riskCheck } = trpc.portfolio.getPersonRiskCheck.useQuery(
        { personId: selectedPersonId },
        { enabled: !!selectedPersonId && direction === 'lender' },
    )

    // Calculate suggested rate from borrower type + term
    const suggestedRate = (() => {
        if (!selectedBorrowerTypeId || !borrowerTypes || !durationAdjustments) return null
        const bt = borrowerTypes.find((b) => b.id === selectedBorrowerTypeId)
        if (!bt) return null
        const baseTna = Number(bt.baseTna)
        const term = parseInt(termMonths)
        if (!term || term <= 0) return { baseTna, adjustment: 0, total: baseTna, borrowerName: bt.name }
        const adj = durationAdjustments.find((a) => a.minMonths < term && a.maxMonths >= term)
        const adjustment = adj ? Number(adj.adjustment) : 0
        return { baseTna, adjustment, total: baseTna + adjustment, borrowerName: bt.name }
    })()

    // Auto-apply suggested rate when borrower type or term changes
    useEffect(() => {
        if (!suggestedRate) return
        setTna(suggestedRate.total.toString())
        setCustomInstallment('')
        setImpliedTna(null)
        const monthlyFromTna = (Math.pow(1 + suggestedRate.total / 100, 1 / 12) - 1) * 100
        setMonthlyRate(Math.round(monthlyFromTna * 10) / 10 + '')
    }, [selectedBorrowerTypeId, termMonths, borrowerTypes, durationAdjustments])

    const reverseMutation = trpc.loans.reverseFromInstallment.useMutation({
        onSuccess: (data) => {
            if (data.success) {
                const tnaPercent = (data.tna * 100).toFixed(2)
                setImpliedTna(data.tna)
                setTna(tnaPercent)
            } else {
                setImpliedTna(null)
            }
        },
    })

    function handleInstallmentChange(value: string) {
        setCustomInstallment(value)
        setImpliedTna(null)

        const installment = parseFloat(value)
        const cap = parseFloat(capital)
        const term = parseInt(termMonths)

        if (installment > 0 && cap > 0 && term > 0 && installment > cap / term) {
            reverseMutation.mutate({
                capital: cap,
                termMonths: term,
                desiredInstallment: installment,
                smartDueDate,
                startDate,
                firstInstallmentMonth: firstInstallmentMonth || undefined,
            })
        }
    }

    // Re-trigger reverse calc when capital or term change and there's a custom installment
    function handleCapitalChange(value: string) {
        setCapital(value)
        retriggerReverse(value, termMonths, customInstallment)
    }

    function handleTermChange(value: string) {
        setTermMonths(value)
        retriggerReverse(capital, value, customInstallment)
    }

    function retriggerReverse(cap: string, term: string, installment: string) {
        if (!installment) return
        setImpliedTna(null)
        const c = parseFloat(cap)
        const t = parseInt(term)
        const i = parseFloat(installment)
        if (i > 0 && c > 0 && t > 0 && i > c / t) {
            reverseMutation.mutate({
                capital: c,
                termMonths: t,
                desiredInstallment: i,
                smartDueDate,
                startDate,
                firstInstallmentMonth: firstInstallmentMonth || undefined,
            })
        }
    }

    // Preview for interest-only
    const interestPreview = loanType === 'interest_only' && capital && monthlyRate
        ? parseFloat(capital) * (parseFloat(monthlyRate) / 100)
        : null

    const createMutation = trpc.loans.create.useMutation({
        onSuccess: () => {
            utils.loans.list.invalidate()
            utils.loans.getDashboardMetrics.invalidate()
            utils.loans.getDashboardMetricsDebtor.invalidate()
            onOpenChange(false)
            setBorrowerName('')
            setCapital('')
            setCurrency('ARS')
            setLoanType('amortized')
            setTna('')
            setMonthlyRate('')
            setTermMonths('')
            setCustomInstallment('')
            setImpliedTna(null)
            setSelectedPersonId('')
            setCreditorName('')
            setSelectedBorrowerTypeId('')
            setRoundEnabled(false)
            setRoundingMultiple(1000)
            setFirstInstallmentMonth('')
            setNoInterest(false)
            setSelectedCollectorId('')
        },
    })

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (loanType === 'interest_only') {
            createMutation.mutate({
                borrowerName,
                capital: parseFloat(capital),
                currency,
                loanType: 'interest_only',
                monthlyInterestRate: noInterest ? 0 : parseFloat(monthlyRate) / 100,
                startDate,
                personId: selectedPersonId || undefined,
                direction,
                creditorName: direction === 'borrower' ? creditorName || undefined : undefined,
                collectorId: selectedCollectorId || undefined,
                smartDueDate,
            })
        } else {
            createMutation.mutate({
                borrowerName,
                capital: parseFloat(capital),
                currency,
                loanType: 'amortized',
                tna: noInterest ? 0 : parseFloat(tna) / 100,
                termMonths: parseInt(termMonths),
                startDate,
                personId: selectedPersonId || undefined,
                direction,
                creditorName: direction === 'borrower' ? creditorName || undefined : undefined,
                collectorId: selectedCollectorId || undefined,
                smartDueDate,
                roundingMultiple: roundEnabled ? roundingMultiple : 0,
                firstInstallmentMonth: firstInstallmentMonth || undefined,
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Préstamo
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{direction === 'lender' ? 'Crear Préstamo' : 'Registrar Deuda'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ── Datos del préstamo ── */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Datos del préstamo</legend>
                        <div className="space-y-2">
                            <Label htmlFor="borrowerName">
                                {direction === 'lender' ? 'Nombre del Deudor' : 'Descripción'}
                            </Label>
                            <Input
                                id="borrowerName"
                                value={borrowerName}
                                onChange={(e) => setBorrowerName(e.target.value)}
                                placeholder={direction === 'lender' ? 'Ej: Juan Perez' : 'Ej: Tarjeta Visa - Cuotas celular'}
                                required
                            />
                        </div>

                        {direction === 'borrower' && (
                            <div className="space-y-2">
                                <Label htmlFor="creditorName">Acreedor</Label>
                                <Input
                                    id="creditorName"
                                    value={creditorName}
                                    onChange={(e) => setCreditorName(e.target.value)}
                                    placeholder="Ej: Banco Galicia, Mercado Crédito"
                                />
                            </div>
                        )}

                    {/* Person selector */}
                    {persons && persons.length > 0 && (
                        <div className="space-y-2">
                            <Label>Persona (opcional)</Label>
                            <Select value={selectedPersonId} onValueChange={(v) => {
                                const id = v === '__none__' ? '' : v
                                setSelectedPersonId(id)
                                if (id) {
                                    const p = persons.find((p) => p.id === id)
                                    if (p && !borrowerName) setBorrowerName(p.name)
                                }
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin persona asignada" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Sin persona</SelectItem>
                                    {persons.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name} {p.alias ? `(${p.alias})` : ''} · Score: {p.score}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedPersonId && (() => {
                                const sp = persons.find((p) => p.id === selectedPersonId)
                                if (!sp) return null
                                const isCritical = sp.category === 'critico'
                                return (
                                    <div className={cn(
                                        'text-xs px-3 py-2 rounded-lg flex items-center gap-2',
                                        isCritical
                                            ? 'bg-red-500/10 text-red-400'
                                            : sp.category === 'alto'
                                                ? 'bg-orange-500/10 text-orange-400'
                                                : sp.category === 'medio'
                                                    ? 'bg-yellow-500/10 text-yellow-400'
                                                    : 'bg-green-500/10 text-accent-positive'
                                    )}>
                                        {isCritical ? <ShieldX className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                                        <span>
                                            {isCritical
                                                ? 'Score crítico — no se recomienda prestar'
                                                : `Riesgo ${sp.category} · Score: ${sp.score}/12`
                                            }
                                        </span>
                                    </div>
                                )
                            })()}
                        </div>
                    )}

                    {/* Risk alerts for selected person */}
                    {riskCheck && selectedPersonId && direction === 'lender' && (() => {
                        const cap = parseFloat(capital) || 0
                        const newTotal = riskCheck.currentExposure + cap
                        const wouldExceed = riskCheck.maxExposure > 0 && newTotal > riskCheck.maxExposure
                        const isCritical = riskCheck.category === 'critico'
                        const currentTna = parseFloat(tna) / 100 || (parseFloat(monthlyRate) / 100 * 12) || 0

                        return (
                            <div className="space-y-1.5">
                                {/* Exposure limit */}
                                <div className={cn(
                                    'text-xs px-3 py-2 rounded-lg flex items-start gap-2',
                                    isCritical
                                        ? 'bg-red-500/10 text-red-400'
                                        : wouldExceed
                                            ? 'bg-orange-500/10 text-orange-400'
                                            : 'bg-muted text-muted-foreground'
                                )}>
                                    <TrendingDown className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    <div>
                                        {isCritical ? (
                                            <span>Riesgo crítico — límite de exposición: <strong>$0</strong></span>
                                        ) : (
                                            <>
                                                <span>
                                                    Exposición actual: <strong>{formatCurrency(riskCheck.currentExposure)}</strong>
                                                    {' / '}
                                                    Límite: <strong>{formatCurrency(riskCheck.maxExposure)}</strong>
                                                </span>
                                                {cap > 0 && wouldExceed && (
                                                    <span className="block mt-0.5">
                                                        Este préstamo excede el límite por {formatCurrency(newTotal - riskCheck.maxExposure)}
                                                    </span>
                                                )}
                                                {cap > 0 && !wouldExceed && riskCheck.remainingRoom > 0 && (
                                                    <span className="block mt-0.5">
                                                        Margen disponible: {formatCurrency(riskCheck.remainingRoom - cap)}
                                                    </span>
                                                )}
                                                {cap === 0 && riskCheck.remainingRoom <= 0 && !isCritical && (
                                                    <span className="block mt-0.5">Sin margen — ya excede el límite recomendado</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Breakeven rate */}
                                {riskCheck.breakevenTNA > 0 && !noInterest && (
                                    <div className={cn(
                                        'text-xs px-3 py-2 rounded-lg flex items-center gap-2',
                                        currentTna > 0 && currentTna < riskCheck.breakevenTNA
                                            ? 'bg-red-500/10 text-red-400'
                                            : currentTna >= riskCheck.breakevenTNA && currentTna < riskCheck.suggestedTNA
                                                ? 'bg-yellow-500/10 text-yellow-400'
                                                : 'bg-muted text-muted-foreground'
                                    )}>
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            Tasa break-even: <strong>{(riskCheck.breakevenTNA * 100).toFixed(1)}% TNA</strong>
                                            {' · '}Sugerida: <strong>{(riskCheck.suggestedTNA * 100).toFixed(1)}%</strong>
                                            {currentTna > 0 && currentTna < riskCheck.breakevenTNA && (
                                                <span className="font-semibold"> — tu tasa no cubre el riesgo</span>
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })()}

                    {/* Borrower type selector */}
                    {borrowerTypes && borrowerTypes.length > 0 && direction === 'lender' && (
                        <div className="space-y-2">
                            <Label>Tipo de cliente</Label>
                            <Select value={selectedBorrowerTypeId || '__none__'} onValueChange={(v) => {
                                const id = v === '__none__' ? '' : v
                                setSelectedBorrowerTypeId(id)
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin tipo asignado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Sin tipo asignado</SelectItem>
                                    {borrowerTypes.map((bt) => (
                                        <SelectItem key={bt.id} value={bt.id}>
                                            {bt.name} — TNA base: {Number(bt.baseTna)}%
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {suggestedRate && (
                                <div className="text-xs px-3 py-2 rounded-lg bg-blue-500/10 text-accent-blue flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        TNA mínima recomendada: <strong>{suggestedRate.total}%</strong>
                                        {suggestedRate.adjustment > 0 && (
                                            <span className="text-muted-foreground ml-1">
                                                ({suggestedRate.baseTna}% base + {suggestedRate.adjustment}% ajuste plazo)
                                            </span>
                                        )}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-xs ml-auto"
                                        onClick={() => {
                                            setTna(suggestedRate.total.toString())
                                            setCustomInstallment('')
                                            setImpliedTna(null)
                                            // Also set monthly rate for interest_only
                                            const monthlyFromTna = (Math.pow(1 + suggestedRate.total / 100, 1 / 12) - 1) * 100
                                            setMonthlyRate(Math.round(monthlyFromTna * 10) / 10 + '')
                                        }}
                                    >
                                        Aplicar
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Collector selector — only for lender */}
                    {direction === 'lender' && (
                        <CollectorSelector value={selectedCollectorId} onChange={setSelectedCollectorId} />
                    )}

                    {/* Loan type & currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo de Préstamo</Label>
                            <Select value={loanType} onValueChange={(v) => setLoanType(v as typeof loanType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="amortized">Amortizado (cuotas fijas)</SelectItem>
                                    <SelectItem value="interest_only">Solo interés (sin plazo)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Moneda</Label>
                            <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ARS">ARS (Pesos)</SelectItem>
                                    <SelectItem value="USD">USD (Dolares)</SelectItem>
                                    <SelectItem value="EUR">EUR (Euros)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    </fieldset>

                    {/* ── Condiciones financieras ── */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Condiciones financieras</legend>

                    <div className="flex items-center gap-2 py-1">
                        <Switch id="no-interest" checked={noInterest} onCheckedChange={setNoInterest} />
                        <Label htmlFor="no-interest" className="cursor-pointer">Sin intereses (Tasa 0%)</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="loanCapital">Capital ({currency})</Label>
                            <Input
                                id="loanCapital"
                                type="number"
                                value={capital}
                                onChange={(e) => handleCapitalChange(e.target.value)}
                                placeholder="1000000"
                                required
                            />
                        </div>
                        {loanType === 'amortized' ? (
                            <div className="space-y-2">
                                <Label htmlFor="loanTerm">Plazo (meses)</Label>
                                <Input
                                    id="loanTerm"
                                    type="number"
                                    value={termMonths}
                                    onChange={(e) => handleTermChange(e.target.value)}
                                    placeholder="12"
                                    min="1"
                                    max="360"
                                    required
                                />
                            </div>
                        ) : !noInterest ? (
                            <div className="space-y-2">
                                <Label htmlFor="loanMonthlyRate">Tasa Mensual (%)</Label>
                                <Input
                                    id="loanMonthlyRate"
                                    type="number"
                                    value={monthlyRate}
                                    onChange={(e) => setMonthlyRate(e.target.value)}
                                    placeholder="10"
                                    step="0.5"
                                    required
                                />
                                {monthlyRate && parseFloat(monthlyRate) > 0 && (() => {
                                    const tem = parseFloat(monthlyRate) / 100
                                    const tea = (Math.pow(1 + tem, 12) - 1) * 100
                                    const tna = tem * 12 * 100
                                    return (
                                        <p className="text-xs text-muted-foreground">
                                            TNA {tna.toFixed(1)}% · TEA {tea.toFixed(2)}%
                                        </p>
                                    )
                                })()}
                            </div>
                        ) : null}
                    </div>

                    {loanType === 'amortized' && !noInterest && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="loanTna">TNA (%)</Label>
                                <Input
                                    id="loanTna"
                                    type="number"
                                    value={tna}
                                    onChange={(e) => { setTna(e.target.value); setImpliedTna(null); setCustomInstallment('') }}
                                    placeholder="55"
                                    step="0.5"
                                    required
                                />
                                {tna && parseFloat(tna) > 0 && (() => {
                                    const tem = tnaToMonthlyRate(parseFloat(tna) / 100)
                                    const tea = (Math.pow(1 + tem, 12) - 1) * 100
                                    return (
                                        <p className="text-xs text-muted-foreground">
                                            TEA equivalente: <strong className="text-foreground">{tea.toFixed(2)}%</strong>
                                        </p>
                                    )
                                })()}
                                {suggestedRate && tna && parseFloat(tna) < suggestedRate.total && impliedTna === null && (
                                    <p className="text-xs flex items-center gap-1 text-yellow-500">
                                        <AlertTriangle className="h-3 w-3" />
                                        Por debajo de la mínima recomendada ({suggestedRate.total}%)
                                    </p>
                                )}
                                {impliedTna !== null && (
                                    <p className="text-xs flex items-center gap-1 text-accent-blue">
                                        <Zap className="h-3 w-3" />
                                        Calculada desde la cuota
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="loanInstallment">Cuota Deseada (opcional)</Label>
                                <Input
                                    id="loanInstallment"
                                    type="number"
                                    value={customInstallment}
                                    onChange={(e) => handleInstallmentChange(e.target.value)}
                                    placeholder="Calcular TNA desde cuota"
                                />
                                {reverseMutation.isPending && (
                                    <p className="text-xs text-muted-foreground">Calculando TNA...</p>
                                )}
                                {impliedTna !== null && (
                                    <p className="text-xs flex items-center gap-1 text-accent-positive">
                                        <Zap className="h-3 w-3" />
                                        → TNA resultante: {(impliedTna * 100).toFixed(2)}%
                                    </p>
                                )}
                                {!reverseMutation.isPending && impliedTna === null && customInstallment !== '' &&
                                    parseFloat(customInstallment) > 0 && parseFloat(capital) > 0 && parseInt(termMonths) > 0 &&
                                    parseFloat(customInstallment) <= parseFloat(capital) / parseInt(termMonths) && (
                                        <p className="text-xs text-red-500">Cuota insuficiente para amortizar</p>
                                    )}
                            </div>
                        </div>
                    )}

                    {/* Interest-only preview */}
                    {loanType === 'interest_only' && interestPreview !== null && interestPreview > 0 && (
                        <div className="bg-blue-500/10 text-accent-blue rounded-lg px-3 py-2 text-sm">
                            Cuota mensual de interés: <strong>{formatCurrency(interestPreview, currency)}</strong>
                        </div>
                    )}
                    </fieldset>

                    {/* Opciones avanzadas — collapsible */}
                    <div className="border rounded-lg">
                        <button
                            type="button"
                            className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            <span>Opciones avanzadas</span>
                            <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
                        </button>
                        {showAdvanced && (
                            <div className="px-3 pb-3 space-y-4 border-t pt-3">
                                <div className="space-y-2">
                                    <Label htmlFor="loanStartDate">Fecha de Inicio</Label>
                                    <Input
                                        id="loanStartDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="modal-smart-due-date"
                                            checked={smartDueDate}
                                            onCheckedChange={setSmartDueDate}
                                        />
                                        <Label htmlFor="modal-smart-due-date" className="text-sm cursor-pointer">
                                            Primer vencimiento inteligente
                                        </Label>
                                    </div>
                                    {smartDueDate && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 pl-0.5">
                                            <Info className="h-3 w-3 shrink-0" />
                                            Las cuotas vencen el 2° día hábil de cada mes
                                        </p>
                                    )}
                                </div>

                                {loanType === 'amortized' && (
                                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                id="modal-round-installments"
                                                checked={roundEnabled}
                                                onCheckedChange={setRoundEnabled}
                                            />
                                            <Label htmlFor="modal-round-installments" className="text-sm cursor-pointer">
                                                Redondear cuotas
                                            </Label>
                                        </div>
                                        {roundEnabled && (
                                            <Select value={roundingMultiple.toString()} onValueChange={(v) => setRoundingMultiple(parseInt(v))}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1000">Múltiplos de $1.000</SelectItem>
                                                    <SelectItem value="100">Múltiplos de $100</SelectItem>
                                                    <SelectItem value="500">Múltiplos de $500</SelectItem>
                                                    <SelectItem value="5000">Múltiplos de $5.000</SelectItem>
                                                    <SelectItem value="10000">Múltiplos de $10.000</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                )}

                                {loanType === 'amortized' && (
                                    <div className="space-y-2">
                                        <Label>Mes de primera cuota (opcional)</Label>
                                        <Select value={firstInstallmentMonth || '__auto__'} onValueChange={(v) => setFirstInstallmentMonth(v === '__auto__' ? '' : v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__auto__">Automático</SelectItem>
                                                {getNextMonths(8).map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Loan preview with first due date + mini schedule */}
                    {loanType === 'amortized' && capital && tna && termMonths && startDate && (() => {
                        const cap = parseFloat(capital)
                        const term = parseInt(termMonths)
                        const rate = tnaToMonthlyRate(parseFloat(tna) / 100)
                        if (!(cap > 0 && term > 0 && rate > 0)) return null
                        let installment = cap * rate / (1 - Math.pow(1 + rate, -term))
                        if (roundEnabled && roundingMultiple > 0) {
                            installment = Math.ceil(installment / roundingMultiple) * roundingMultiple
                        }
                        const [y, m, d] = startDate.split('-').map(Number)
                        const start = new Date(y, m - 1, d)
                        const dueDate = smartDueDate
                            ? getSmartFirstDueDate(start)
                            : new Date(y, m, d)
                        const dueDateStr = dueDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

                        // Mini amortization schedule (first 3 + last)
                        const previewRows: { n: number; interest: number; principal: number; balance: number }[] = []
                        let balance = cap
                        const showCount = Math.min(3, term)
                        for (let i = 1; i <= term; i++) {
                            const interest = balance * rate
                            const principal = installment - interest
                            balance = Math.max(0, balance - principal)
                            if (i <= showCount || i === term) {
                                previewRows.push({ n: i, interest, principal, balance })
                            }
                        }

                        return (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        {term} {pluralize(term, 'cuota')} de ~{formatCurrency(installment, currency)} — 1er vencimiento:{' '}
                                        <span className="font-semibold">{dueDateStr}</span>
                                    </span>
                                </div>
                                <div className="text-xs border rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-muted/50 text-muted-foreground">
                                                <th className="py-1.5 px-2 text-left font-medium">#</th>
                                                <th className="py-1.5 px-2 text-right font-medium">Interés</th>
                                                <th className="py-1.5 px-2 text-right font-medium">Capital</th>
                                                <th className="py-1.5 px-2 text-right font-medium">Saldo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, idx) => (
                                                <>
                                                    {idx === previewRows.length - 1 && term > showCount && (
                                                        <tr key="ellipsis">
                                                            <td colSpan={4} className="py-1 text-center text-muted-foreground">···</td>
                                                        </tr>
                                                    )}
                                                    <tr key={row.n} className="border-t border-border/30">
                                                        <td className="py-1.5 px-2 tabular-nums">{row.n}</td>
                                                        <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(row.interest, currency)}</td>
                                                        <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(row.principal, currency)}</td>
                                                        <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(row.balance, currency)}</td>
                                                    </tr>
                                                </>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    })()}

                    {createMutation.error && (
                        <p className="text-sm text-red-500">{createMutation.error.message}</p>
                    )}

                    <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Creando...' : 'Crear Préstamo'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
