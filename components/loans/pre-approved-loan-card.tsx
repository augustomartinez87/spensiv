'use client'

import { useState } from 'react'
import { formatCurrency, formatDateToInput } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { loanRateInfo } from './helpers'

export function PreApprovedLoanCard({
    loan,
    onConfirm,
    onDelete,
    isConfirming,
    isDeleting,
}: {
    loan: any
    onConfirm: (loanId: string, startDate: string) => void
    onDelete: (id: string) => void
    isConfirming: boolean
    isDeleting: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const [confirmDate, setConfirmDate] = useState(formatDateToInput(new Date()))
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const cur = loan.currency
    const isInterestOnly = loan.loanType === 'interest_only'

    return (
        <Card className="border-amber-800/50 bg-amber-950/20">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className="font-bold text-foreground truncate">{loan.borrowerName}</h3>
                        <p className="text-sm text-muted-foreground">
                            {formatCurrency(Number(loan.capital), cur)}
                            {' · '}
                            {isInterestOnly ? 'Solo interés' : `${loan.termMonths} meses`}
                        </p>
                    </div>
                    <Badge variant="outline" className="text-accent-warning border-amber-600 shrink-0">
                        Preaprobado
                    </Badge>
                </div>

                {(() => {
                    const ri = loanRateInfo(loan)
                    return (
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>
                                {isInterestOnly
                                    ? `${(ri.tem * 100).toFixed(2)}% TEM`
                                    : `Cuota: ${formatCurrency(Number(loan.installmentAmount), cur)}`
                                }
                            </span>
                            <span>TNA {(ri.tna * 100).toFixed(1)}% · TEA {(ri.tea * 100).toFixed(1)}%</span>
                        </div>
                    )
                })()}

                {expanded ? (
                    <div className="space-y-3 pt-2 border-t border-amber-800/50">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Fecha de inicio del préstamo</Label>
                            <Input
                                type="date"
                                value={confirmDate}
                                onChange={(e) => setConfirmDate(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => onConfirm(loan.id, confirmDate)}
                                disabled={isConfirming}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                {isConfirming ? 'Confirmando...' : 'Confirmar'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpanded(false)}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setExpanded(true)}
                        >
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                            Confirmar
                        </Button>
                        {showDeleteConfirm ? (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => onDelete(loan.id)}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? '...' : 'Si'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDeleteConfirm(false)}
                                >
                                    No
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
