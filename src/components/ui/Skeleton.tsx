import { cn } from '@/lib/formatters'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-surface-2 rounded-lg', className)} />
  )
}

export function SkeletonKPI() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <Skeleton className="h-3 w-24 mb-4" />
      <Skeleton className="h-8 w-36 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
