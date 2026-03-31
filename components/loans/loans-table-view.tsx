'use client'

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/contexts/trpc-client'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronRight,
    Wallet,
    Infinity,
    Search,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculatePersonScore } from '@/lib/loan-scoring'
import { loanRateInfo } from './helpers'
import type { LoanListItem } from './types'

type SortColumn = 'person' | 'capital' | 'type' | 'tna' | 'term' | 'progress' | 'nextDue' | 'status'
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'all' | 'current' | 'overdue' | 'interestOnly'
type CurrencyFilter = 'all' | 'ARS' | 'USD' | 'EUR'

/** A zero-rate loan has no installment schedule — never "overdue" */
function isZeroRateOpenLoan(loan: LoanListItem) {
    return Number(loan.monthlyRate) === 0
}

function getLoanStatus(loan: LoanListItem) {
    const now = new Date()
    const nextDue = loan.nextDueDate ? new Date(loan.nextDueDate) : null
    if (loan.status === 'completed') return 'completed' as const
    if (isZeroRateOpenLoan(loan)) return 'open' as const
    if (nextDue && nextDue < now) return 'overdue' as const
    if (!nextDue && loan.status === 'active') return 'new' as const
    return 'current' as const
}

function getStatusDisplay(status: ReturnType<typeof getLoanStatus>) {
    switch (status) {
        case 'overdue': return { label: 'Vencido', color: 'bg-red-500', textColor: 'text-red-400' }
        case 'current': return { label: 'Al día', color: 'bg-green-500', textColor: 'text-green-400' }
        case 'new': return { label: 'Nuevo', color: 'bg-blue-500', textColor: 'text-blue-400' }
        case 'open': return { label: 'Abierto', color: 'bg-blue-400', textColor: 'text-blue-400' }
        case 'completed': return { label: 'Finalizado', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' }
    }
}

function getRiskDotColor(loan: LoanListItem): string | null {
    if (!loan.person) return null
    const scoreResult = calculatePersonScore(loan.person)
    if (scoreResult.score < 4) return '#ef4444'
    if (scoreResult.score < 7) return '#f59e0b'
    return '#22c55e'
}

function parseCardTitleSubtitle(loan: LoanListItem) {
    let title: string
    let subtitle: string | null = null
    if (loan.person) {
        title = loan.person.name || loan.person.alias || loan.borrowerName
        const parts = loan.borrowerName.split(' - ')
        if (parts.length > 1) {
            const personName = loan.person.name || loan.person.alias || ''
            subtitle = parts.filter(p => p.trim() !== personName.trim()).join(' - ') || null
        }
    } else {
        const parts = loan.borrowerName.split(' - ')
        title = parts[0]
        subtitle = parts.length > 1 ? parts.slice(1).join(' - ') : null
    }
    return { title, subtitle }
}

function SortIcon({ column, activeColumn, direction }: { column: SortColumn; activeColumn: SortColumn; direction: SortDirection }) {
    if (column !== activeColumn) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return direction === 'asc'
        ? <ArrowUp className="h-3 w-3 ml-1" />
        : <ArrowDown className="h-3 w-3 ml-1" />
}

export function LoansTableView({ onSelect, direction }: { onSelect: (id: string) => void; direction: 'lender' | 'borrower' }) {
    const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'refinanced'>('active')
    const { data: loans, isLoading } = trpc.loans.list.useQuery({ direction, status: statusFilter })

    const [sortColumn, setSortColumn] = useState<SortColumn>('nextDue')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [quickFilter, setQuickFilter] = useState<StatusFilter>('all')
    const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')

    function handleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortColumn(column)
            setSortDirection('asc')
        }
    }

    const filtered = useMemo(() => {
        if (!loans) return []
        let result = loans.filter(l => l.status !== 'pre_approved')

        // Quick filter
        if (quickFilter === 'current') {
            result = result.filter(l => getLoanStatus(l) === 'current')
        } else if (quickFilter === 'overdue') {
            result = result.filter(l => getLoanStatus(l) === 'overdue')
        } else if (quickFilter === 'interestOnly') {
            result = result.filter(l => l.loanType === 'interest_only')
        }

        // Currency filter
        if (currencyFilter !== 'all') {
            result = result.filter(l => l.currency === currencyFilter)
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(l => {
                const { title, subtitle } = parseCardTitleSubtitle(l)
                return title.toLowerCase().includes(q) || (subtitle && subtitle.toLowerCase().includes(q)) || l.borrowerName.toLowerCase().includes(q)
            })
        }

        return result
    }, [loans, quickFilter, currencyFilter, searchQuery])

    const sorted = useMemo(() => {
        const arr = [...filtered]
        arr.sort((a, b) => {
            let cmp = 0
            switch (sortColumn) {
                case 'person': {
                    const aName = parseCardTitleSubtitle(a).title
                    const bName = parseCardTitleSubtitle(b).title
                    cmp = aName.localeCompare(bName)
                    break
                }
                case 'capital':
                    cmp = Number(a.capital) - Number(b.capital)
                    break
                case 'type':
                    cmp = a.loanType.localeCompare(b.loanType)
                    break
                case 'tna':
                    cmp = Number(a.tna) - Number(b.tna)
                    break
                case 'term':
                    cmp = (a.termMonths ?? 999) - (b.termMonths ?? 999)
                    break
                case 'progress': {
                    const aPct = a.totalCount > 0 ? a.paidCount / a.totalCount : 0
                    const bPct = b.totalCount > 0 ? b.paidCount / b.totalCount : 0
                    cmp = aPct - bPct
                    break
                }
                case 'nextDue': {
                    const aDate = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER
                    const bDate = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER
                    cmp = aDate - bDate
                    break
                }
                case 'status': {
                    const order = { overdue: 0, current: 1, open: 2, new: 3, completed: 4 }
                    cmp = order[getLoanStatus(a)] - order[getLoanStatus(b)]
                    break
                }
            }
            return sortDirection === 'asc' ? cmp : -cmp
        })
        return arr
    }, [filtered, sortColumn, sortDirection])

    // Totals
    const totals = useMemo(() => {
        const totalCapital = sorted.reduce((sum, l) => sum + Number(l.capital), 0)
        const nextAmounts = sorted.filter(l => l.nextAmount > 0).map(l => l.nextAmount)
        const avgNextAmount = nextAmounts.length > 0 ? nextAmounts.reduce((s, a) => s + a, 0) / nextAmounts.length : 0
        return { totalCapital, avgNextAmount, count: sorted.length }
    }, [sorted])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Status filter toggle (same as card view) */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex bg-muted rounded-lg p-0.5 w-fit">
                    {(['active', 'completed', 'refinanced'] as const).map((s) => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'active' ? 'Activos' : s === 'completed' ? 'Finalizados' : 'Refinanciados'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Search + quick filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o descripción..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {([
                        { value: 'all', label: 'Todos' },
                        { value: 'current', label: 'Al día' },
                        { value: 'overdue', label: 'Vencidos' },
                        { value: 'interestOnly', label: 'Solo interés' },
                    ] as const).map((f) => (
                        <Button
                            key={f.value}
                            variant={quickFilter === f.value ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setQuickFilter(f.value)}
                        >
                            {f.label}
                        </Button>
                    ))}
                    <div className="w-px bg-border mx-1" />
                    {(['all', 'ARS', 'USD', 'EUR'] as const).map((c) => (
                        <Button
                            key={c}
                            variant={currencyFilter === c ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setCurrencyFilter(c)}
                        >
                            {c === 'all' ? 'Todas' : c}
                        </Button>
                    ))}
                </div>
            </div>

            {sorted.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                    Sin resultados para los filtros seleccionados
                </div>
            ) : (
                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[180px]">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('person')}>
                                        Persona
                                        <SortIcon column="person" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[120px]">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('capital')}>
                                        Capital
                                        <SortIcon column="capital" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[110px] hidden md:table-cell">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('type')}>
                                        Tipo
                                        <SortIcon column="type" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[80px] hidden md:table-cell">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('tna')}>
                                        TNA
                                        <SortIcon column="tna" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[80px] hidden md:table-cell">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('term')}>
                                        Plazo
                                        <SortIcon column="term" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[100px]">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('progress')}>
                                        Progreso
                                        <SortIcon column="progress" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[120px]">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('nextDue')}>
                                        Prox. cuota
                                        <SortIcon column="nextDue" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[80px]">
                                    <button className="flex items-center text-xs uppercase tracking-wider font-medium" onClick={() => handleSort('status')}>
                                        Estado
                                        <SortIcon column="status" activeColumn={sortColumn} direction={sortDirection} />
                                    </button>
                                </TableHead>
                                <TableHead className="w-[80px] hidden sm:table-cell">
                                    <span className="text-xs uppercase tracking-wider font-medium">Acciones</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sorted.map((loan) => {
                                const { title, subtitle } = parseCardTitleSubtitle(loan)
                                const isInterestOnly = loan.loanType === 'interest_only'
                                const isZeroRate = Number(loan.monthlyRate) === 0
                                const cur = loan.currency
                                const ri = loanRateInfo(loan)
                                const status = getLoanStatus(loan)
                                const statusDisplay = getStatusDisplay(status)
                                const nextDue = loan.nextDueDate ? new Date(loan.nextDueDate) : null
                                const isOverdue = status === 'overdue'
                                const riskColor = getRiskDotColor(loan)
                                const progressPct = loan.totalCount > 0 ? (loan.paidCount / loan.totalCount) * 100 : 0

                                return (
                                    <TableRow
                                        key={loan.id}
                                        className={cn(
                                            "cursor-pointer h-[52px] transition-colors",
                                            isOverdue && "bg-red-500/5"
                                        )}
                                        onClick={() => onSelect(loan.id)}
                                    >
                                        {/* Persona */}
                                        <TableCell className="py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {riskColor && (
                                                    <span
                                                        className="shrink-0 inline-block rounded-full w-2 h-2"
                                                        style={{ backgroundColor: riskColor }}
                                                    />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm text-foreground truncate">{title}</p>
                                                    {subtitle && (
                                                        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Capital */}
                                        <TableCell className="py-2">
                                            <span className="text-sm tabular-nums font-medium">{formatCurrency(Number(loan.capital), cur)}</span>
                                            {cur !== 'ARS' && (
                                                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">{cur}</Badge>
                                            )}
                                        </TableCell>

                                        {/* Tipo */}
                                        <TableCell className="py-2 hidden md:table-cell">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {isZeroRate
                                                    ? 'Sin intereses'
                                                    : isInterestOnly
                                                        ? 'Solo interés'
                                                        : 'Amortizado'
                                                }
                                            </Badge>
                                        </TableCell>

                                        {/* TNA */}
                                        <TableCell className="py-2 hidden md:table-cell">
                                            <span className={cn("text-sm tabular-nums font-medium", Number(loan.tna) > 1.5 && "text-red-400")}>
                                                {isZeroRate ? '0%' : `${(ri.tna * 100).toFixed(1)}%`}
                                            </span>
                                        </TableCell>

                                        {/* Plazo */}
                                        <TableCell className="py-2 hidden md:table-cell">
                                            <span className="text-sm text-muted-foreground">
                                                {isInterestOnly ? 'Sin plazo' : `${loan.termMonths}m`}
                                            </span>
                                        </TableCell>

                                        {/* Progreso */}
                                        <TableCell className="py-2">
                                            {(isInterestOnly || isZeroRate) ? (
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <Infinity className="h-3.5 w-3.5" />
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden max-w-[80px]">
                                                        <div
                                                            className="h-full bg-green-500 rounded-full transition-all"
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground tabular-nums">
                                                        {loan.paidCount}/{loan.totalCount}
                                                    </span>
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Prox. cuota */}
                                        <TableCell className="py-2">
                                            {isZeroRate ? (
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Capital pdte:</p>
                                                    <p className="text-sm tabular-nums font-medium">{formatCurrency(Number(loan.principalOutstanding), cur)}</p>
                                                </div>
                                            ) : nextDue ? (
                                                <div>
                                                    <p className={cn("text-sm", isOverdue ? "text-red-400 font-medium" : "text-foreground")}>
                                                        {format(nextDue, "d MMM", { locale: es })}
                                                    </p>
                                                    <p className={cn("text-xs tabular-nums", isOverdue ? "text-red-400/80" : "text-muted-foreground")}>
                                                        {formatCurrency(loan.nextAmount, cur)}
                                                    </p>
                                                    {isOverdue && (
                                                        <Badge variant="destructive" className="text-[8px] px-1 py-0 mt-0.5">VENCIDA</Badge>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    {isInterestOnly ? 'Mensual' : 'Sin cuotas'}
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Estado */}
                                        <TableCell className="py-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn("w-2 h-2 rounded-full shrink-0", statusDisplay.color)} />
                                                <span className={cn("text-xs", statusDisplay.textColor)}>{statusDisplay.label}</span>
                                            </div>
                                        </TableCell>

                                        {/* Acciones */}
                                        <TableCell className="py-2 hidden sm:table-cell">
                                            <div className="flex items-center gap-1">
                                                {loan.status === 'active' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onSelect(loan.id)
                                                        }}
                                                        title="Registrar cobro"
                                                    >
                                                        <Wallet className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onSelect(loan.id)
                                                    }}
                                                    title="Ver detalle"
                                                >
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}

                            {/* Totals row */}
                            <TableRow className="bg-muted/30 hover:bg-muted/30 font-medium border-t-2">
                                <TableCell className="py-2.5">
                                    <span className="text-xs text-muted-foreground">{totals.count} préstamos</span>
                                </TableCell>
                                <TableCell className="py-2.5">
                                    <span className="text-sm tabular-nums">{formatCurrency(totals.totalCapital, 'ARS')}</span>
                                </TableCell>
                                <TableCell className="py-2.5 hidden md:table-cell" />
                                <TableCell className="py-2.5 hidden md:table-cell" />
                                <TableCell className="py-2.5 hidden md:table-cell" />
                                <TableCell className="py-2.5" />
                                <TableCell className="py-2.5">
                                    {totals.avgNextAmount > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            Prom: {formatCurrency(totals.avgNextAmount, 'ARS')}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="py-2.5" />
                                <TableCell className="py-2.5 hidden sm:table-cell" />
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
