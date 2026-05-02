import { monthlyToAnnualRate } from '@/lib/loan-calculator'

type LoanForDisplay = {
    borrowerName: string
    concept?: string | null
    person: { name: string; alias?: string | null } | null
}

/**
 * Plain borrower name (sin concepto). Usar para mensajes dirigidos al deudor.
 * Person.name cuando hay vinculación, sino borrowerName antes del primer " - ".
 */
export function loanDisplayName(loan: LoanForDisplay): string {
    if (loan.person) return loan.person.name || loan.person.alias || loan.borrowerName.split(' - ')[0]
    return loan.borrowerName.split(' - ')[0]
}

/**
 * Etiqueta completa: nombre + concepto. Usar para listas internas y mensajes
 * al cobrador donde hay que distinguir entre múltiples préstamos de la misma persona.
 */
export function loanDisplayLabel(loan: LoanForDisplay): string {
    const name = loanDisplayName(loan)
    if (loan.person && loan.concept) return `${name} (${loan.concept})`
    return name
}

export function amountClass(amount: number) {
    const abs = Math.abs(amount)
    if (abs >= 10_000_000) return 'text-base font-bold'
    if (abs >= 1_000_000) return 'text-lg font-bold'
    return 'text-xl font-bold'
}

export function loanRateInfo(loan: { rateIsNominal: boolean | null; tna: { toString(): string }; monthlyRate: { toString(): string } }) {
    const tem = Number(loan.monthlyRate)
    const tea = monthlyToAnnualRate(tem)
    const tna = loan.rateIsNominal ? Number(loan.tna) : tem * 12
    return { tem, tea, tna, isLegacy: !loan.rateIsNominal }
}
