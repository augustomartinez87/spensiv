type BillingCycleWithInstallments = {
  period: string
  status: string
  dueDate: Date
  installments: Array<{ amount: unknown }>
}

type CardWithCycles = {
  id: string
  name: string
  bank: string
  brand: string
  last4: string | null
  creditLimit: unknown
  closingDay: number
  dueDay: number
  billingCycles: BillingCycleWithInstallments[]
}

export interface CardBalance {
  id: string
  name: string
  bank: string
  brand: string
  last4: string | null
  creditLimit: number | null
  closingDay: number
  dueDay: number
  totalBalance: number
  currentPeriodBalance: number
  nextDueDate: Date | null
  nextDueAmount: number
  cycleCount: number
}

function cyclePendingAmount(cycle: BillingCycleWithInstallments): number {
  return cycle.installments.reduce((sum, installment) => sum + Number(installment.amount), 0)
}

/**
 * Computes per-card and aggregate balance data from billing cycles.
 */
export function computeCardBalances(
  cards: CardWithCycles[],
  currentPeriod: string,
): { cards: CardBalance[]; totalDebt: number } {
  const cardBalances = cards.map((card) => {
    const totalBalance = card.billingCycles.reduce(
      (sum, cycle) => sum + cyclePendingAmount(cycle),
      0,
    )

    const currentPeriodBalance = card.billingCycles
      .filter((cycle) => cycle.period === currentPeriod)
      .reduce((sum, cycle) => sum + cyclePendingAmount(cycle), 0)

    const nextDueCycle = card.billingCycles
      .filter(
        (cycle) =>
          (cycle.status === 'open' || cycle.status === 'closed') &&
          cyclePendingAmount(cycle) > 0,
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]

    return {
      id: card.id,
      name: card.name,
      bank: card.bank,
      brand: card.brand,
      last4: card.last4,
      creditLimit: card.creditLimit ? Number(card.creditLimit) : null,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      totalBalance,
      currentPeriodBalance,
      nextDueDate: nextDueCycle?.dueDate || null,
      nextDueAmount: nextDueCycle ? cyclePendingAmount(nextDueCycle) : 0,
      cycleCount: card.billingCycles.length,
    }
  })

  const totalDebt = cardBalances.reduce((sum, card) => sum + card.totalBalance, 0)

  return { cards: cardBalances, totalDebt }
}
