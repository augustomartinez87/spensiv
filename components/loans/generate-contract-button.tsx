'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileText } from 'lucide-react'
import type { LoanDetail } from './types'

function toLoanData(loan: LoanDetail) {
  return {
    borrowerName: loan.borrowerName,
    personName: loan.person?.name ?? null,
    capital: Number(loan.capital),
    currency: loan.currency,
    installmentAmount: Number(loan.installmentAmount),
    termMonths: loan.termMonths,
    startDate: new Date(loan.startDate),
    monthlyRate: Number(loan.monthlyRate),
    loanType: loan.loanType,
    installments: loan.loanInstallments.map((i) => ({
      number: i.number,
      dueDate: new Date(i.dueDate),
      amount: Number(i.amount),
      interest: Number(i.interest),
      principal: Number(i.principal),
      balance: Number(i.balance),
    })),
  }
}

export function GenerateContractButton({ loan }: { loan: LoanDetail }) {
  const [loading, setLoading] = useState(false)

  if (loan.direction !== 'lender' || loan.loanInstallments.length === 0) return null

  async function handleDownload(type: 'contract' | 'pagare' | 'both') {
    setLoading(true)
    try {
      const { downloadContract, downloadPagareGuide, downloadBothDocuments } = await import('@/lib/contract-generator')
      const data = toLoanData(loan)
      if (type === 'contract') await downloadContract(data)
      else if (type === 'pagare') await downloadPagareGuide(data)
      else await downloadBothDocuments(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          <FileText className="h-4 w-4 mr-2" />
          {loading ? 'Generando...' : 'Generar contrato'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => handleDownload('contract')}>
          Contrato de Mutuo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload('pagare')}>
          Guía de Pagaré
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload('both')}>
          Ambos documentos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
