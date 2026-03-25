export function amountClass(amount: number) {
    const abs = Math.abs(amount)
    if (abs >= 10_000_000) return 'text-base font-bold'
    if (abs >= 1_000_000) return 'text-lg font-bold'
    return 'text-xl font-bold'
}

export function loanRateInfo(loan: { rateIsNominal: boolean | null; tna: { toString(): string }; monthlyRate: { toString(): string } }) {
    const tem = Number(loan.monthlyRate)
    const tea = Math.pow(1 + tem, 12) - 1
    const tna = loan.rateIsNominal ? Number(loan.tna) : tem * 12
    return { tem, tea, tna, isLegacy: !loan.rateIsNominal }
}
