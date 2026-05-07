import type { ReactNode } from 'react'

interface PageHeaderProps {
  titulo: string
  subtitulo?: string
  acciones?: ReactNode
}

export function PageHeader({ titulo, subtitulo, acciones }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-white md:text-2xl">{titulo}</h1>
        {subtitulo && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitulo}</p>
        )}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}
