'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { formatCurrency, cn, formatDateToInput } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, Zap, Shield, ShieldX, Info, Clock } from 'lucide-react'
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
    const [fciRate, setFciRate] = useState('40')
    const [suggestedTna, setSuggestedTna] = useState<number | null>(null)
    const [smartDueDate, setSmartDueDate] = useState(true)
    const [roundEnabled, setRoundEnabled] = useState(false)
    const [roundingMultiple, setRoundingMultiple] = useState<number>(1000)
    const [firstInstallmentMonth, setFirstInstallmentMonth] = useState<string>('')
    const [noInterest, setNoInterest] = useState(false)

    const { data: persons } = trpc.persons.list.useQuery()

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
            reverseMutation.mutate({ capital: c, termMonths: t, desiredInstallment: i })
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
            setSuggestedTna(null)
            setFciRate('40')
            setRoundEnabled(false)
            setRoundingMultiple(1000)
            setFirstInstallmentMonth('')
            setNoInterest(false)
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
                                    if (p) {
                                        if (!borrowerName) setBorrowerName(p.name)
                                        if (p.category !== 'critico') {
                                            const fci = parseFloat(fciRate || '0') / 100
                                            const suggested = (fci + p.minTnaSpread) * 100
                                            const suggestedRounded = Math.round(suggested * 10) / 10
                                            setSuggestedTna(suggestedRounded)
                                            setTna(suggestedRounded.toString())
                                            setCustomInstallment('')
                                            setImpliedTna(null)
                                            // Also suggest monthly rate for interest-only
                                            const monthlyFromTna = (Math.pow(1 + fci + p.minTnaSpread, 1 / 12) - 1) * 100
                                            setMonthlyRate(Math.round(monthlyFromTna * 10) / 10 + '')
                                        }
                                    }
                                } else {
                                    setSuggestedTna(null)
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
                                                : `Riesgo ${sp.category} · Spread mínimo: +${(sp.minTnaSpread * 100).toFixed(0)}pp`
                                            }
                                        </span>
                                    </div>
                                )
                            })()}
                        </div>
                    )}

                    {/* FCI rate - only show when person selected */}
                    {selectedPersonId && persons?.find((p) => p.id === selectedPersonId)?.category !== 'critico' && (
                        <div className="space-y-2">
                            <Label htmlFor="fciRate">Tasa FCI referencia (%)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="fciRate"
                                    type="number"
                                    value={fciRate}
                                    onChange={(e) => {
                                        setFciRate(e.target.value)
                                        const p = persons?.find((p) => p.id === selectedPersonId)
                                        if (p && p.category !== 'critico') {
                                            const fci = parseFloat(e.target.value || '0') / 100
                                            const suggested = (fci + p.minTnaSpread) * 100
                                            const suggestedRounded = Math.round(suggested * 10) / 10
                                            setSuggestedTna(suggestedRounded)
                                            setTna(suggestedRounded.toString())
                                            setCustomInstallment('')
                                            setImpliedTna(null)
                                            const monthlyFromTna = (Math.pow(1 + fci + p.minTnaSpread, 1 / 12) - 1) * 100
                                            setMonthlyRate(Math.round(monthlyFromTna * 10) / 10 + '')
                                        }
                                    }}
                                    className="w-24"
                                    step="1"
                                    min="0"
                                />
                                <span className="text-xs text-muted-foreground">
                                    FCI {fciRate}% + spread {(() => {
                                        const p = persons?.find((p) => p.id === selectedPersonId)
                                        return p ? `${(p.minTnaSpread * 100).toFixed(0)}pp` : ''
                                    })()} = <strong className="text-foreground">{suggestedTna?.toFixed(1)}% TNA</strong>
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Loan type & currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo de Préstamo</Label>
                            <Select value={loanType} onValueChange={(v) => setLoanType(v as any)}>
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
                            <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
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
                                    onChange={(e) => { setTna(e.target.value); setImpliedTna(null); setSuggestedTna(null); setCustomInstallment('') }}
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
                                {suggestedTna !== null && impliedTna === null && parseFloat(tna) === suggestedTna && (
                                    <p className="text-xs flex items-center gap-1 text-accent-positive">
                                        <Zap className="h-3 w-3" />
                                        Sugerida desde score ({fciRate}% + spread)
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

                    {/* Smart due date toggle */}
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

                    {/* Rounding toggle — solo amortizado */}
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

                    {/* First installment month selector — solo amortizado */}
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

                    {/* Loan preview with first due date */}
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
                        return (
                            <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                    {term} cuotas de ~{formatCurrency(installment, currency)} — 1er vencimiento:{' '}
                                    <span className="font-semibold">{dueDateStr}</span>
                                </span>
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
