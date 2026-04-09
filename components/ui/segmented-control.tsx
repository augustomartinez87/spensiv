'use client'

import { cn } from '@/lib/utils'

interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onValueChange: (value: T) => void
  variant?: 'default' | 'primary'
  size?: 'sm' | 'default'
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  variant = 'default',
  size = 'default',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex bg-muted rounded-lg p-0.5', className)}>
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              isActive
                ? variant === 'primary'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
