import { forwardRef } from 'react'
import { cn } from '@/lib/formatters'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
          'shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
          variant === 'primary' && 'bg-primary hover:bg-primary-hover text-white shadow-primary/20',
          variant === 'secondary' && 'bg-surface-2 hover:bg-surface-3 text-white border border-border',
          variant === 'outline' && 'bg-transparent hover:bg-surface-2 text-white border border-border',
          variant === 'ghost' && 'bg-transparent hover:bg-surface-2 text-muted-foreground hover:text-white shadow-none',
          variant === 'danger' && 'bg-danger hover:bg-danger/85 text-white',
          variant === 'success' && 'bg-success hover:bg-success/85 text-background',
          variant === 'warning' && 'bg-warning hover:bg-warning/85 text-background',
          size === 'sm' && 'px-3 py-1.5 text-xs',
          size === 'md' && 'px-4 py-2 text-sm',
          size === 'lg' && 'px-5 py-2.5 text-base',
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
