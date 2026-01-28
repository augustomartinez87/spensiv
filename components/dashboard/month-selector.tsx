'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MonthSelectorProps {
    value: string // "2026-01"
    onChange: (period: string) => void
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
    const [year, month] = value.split('-').map(Number)

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    const handlePrevious = () => {
        const newDate = new Date(year, month - 2) // month is 1-indexed, Date is 0-indexed
        const newPeriod = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
        onChange(newPeriod)
    }

    const handleNext = () => {
        const newDate = new Date(year, month) // month is 1-indexed
        const newPeriod = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
        onChange(newPeriod)
    }

    const handleToday = () => {
        const now = new Date()
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        onChange(period)
    }

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">
                    {monthNames[month - 1]} {year}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleToday}>
                    Hoy
                </Button>
            </div>

            <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}
