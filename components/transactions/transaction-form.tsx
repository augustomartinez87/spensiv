'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus } from 'lucide-react'

export function TransactionForm() {
    const [open, setOpen] = useState(false)
    const { toast } = useToast()
    const utils = trpc.useUtils()

    const [formData, setFormData] = useState({
        description: '',
        totalAmount: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'credit_card' as 'credit_card' | 'debit_card' | 'cash' | 'transfer',
        cardId: '',
        installments: '1',
        expenseType: 'structural' as 'structural' | 'emotional_recurrent' | 'emotional_impulsive',
    })

    const { data: cards } = trpc.cards.list.useQuery()
    const createMutation = trpc.transactions.create.useMutation({
        onSuccess: () => {
            toast({
                title: 'Gasto registrado',
                description: 'El gasto se registró exitosamente',
            })
            setOpen(false)
            setFormData({
                description: '',
                totalAmount: '',
                purchaseDate: new Date().toISOString().split('T')[0],
                paymentMethod: 'credit_card',
                cardId: '',
                installments: '1',
                expenseType: 'structural',
            })
            utils.dashboard.getMonthlyBalance.invalidate()
            utils.transactions.list.invalidate()
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            })
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        createMutation.mutate({
            description: formData.description,
            totalAmount: parseFloat(formData.totalAmount),
            purchaseDate: new Date(formData.purchaseDate),
            paymentMethod: formData.paymentMethod,
            cardId: formData.paymentMethod === 'credit_card' ? formData.cardId : undefined,
            installments: parseInt(formData.installments),
            expenseType: formData.expenseType,
        })
    }

    const isCreditCard = formData.paymentMethod === 'credit_card'

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Gasto
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Registrar Gasto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Ej: FIAMBRE CON SANTI"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={formData.totalAmount}
                                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                                placeholder="7100.00"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">Fecha</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.purchaseDate}
                                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="paymentMethod">Medio de pago</Label>
                        <Select
                            value={formData.paymentMethod}
                            onValueChange={(value: any) => setFormData({ ...formData, paymentMethod: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="credit_card">Tarjeta de Crédito</SelectItem>
                                <SelectItem value="debit_card">Tarjeta de Débito</SelectItem>
                                <SelectItem value="cash">Efectivo</SelectItem>
                                <SelectItem value="transfer">Transferencia</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isCreditCard && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="card">Tarjeta</Label>
                                <Select
                                    value={formData.cardId}
                                    onValueChange={(value) => setFormData({ ...formData, cardId: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tarjeta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cards?.map((card) => (
                                            <SelectItem key={card.id} value={card.id}>
                                                {card.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="installments">Cuotas</Label>
                                <Input
                                    id="installments"
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={formData.installments}
                                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="expenseType">Tipo de gasto</Label>
                        <Select
                            value={formData.expenseType}
                            onValueChange={(value: any) => setFormData({ ...formData, expenseType: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="structural">🔵 Estructural</SelectItem>
                                <SelectItem value="emotional_recurrent">🟡 Recurrente</SelectItem>
                                <SelectItem value="emotional_impulsive">🔴 Impulsivo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
