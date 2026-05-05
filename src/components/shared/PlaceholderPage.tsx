import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  icon: LucideIcon
  titulo: string
  descripcion: string
  proxima?: string
}

export function PlaceholderPage({ icon: Icon, titulo, descripcion, proxima }: PlaceholderPageProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center text-center space-y-4">
      <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
        <Icon size={22} className="text-primary" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-white">{titulo}</h2>
        <p className="text-sm text-muted-foreground max-w-md">{descripcion}</p>
      </div>
      {proxima && (
        <span className="text-xs text-muted-foreground bg-surface-2 border border-border rounded-full px-3 py-1">
          {proxima}
        </span>
      )}
    </div>
  )
}
