'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface AmountInputProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  showPrefix?: boolean
  className?: string
}

export function AmountInput({
  id = 'amount',
  label,
  value,
  onChange,
  error,
  placeholder = '0,00',
  showPrefix = true,
  className,
}: AmountInputProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id} className={error ? 'text-red-500' : ''}>
          {label}
        </Label>
      )}
      <div className="relative">
        {showPrefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
        )}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
          placeholder={placeholder}
          className={cn(
            showPrefix && 'pl-7',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
