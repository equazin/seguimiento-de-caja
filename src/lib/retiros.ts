import type { Movimiento } from '@/db/schema'

export const RETIRO_PERSONAL_CATEGORY_ID = 'cat-retiro'
export const VEHICULOS_CATEGORY_ID = 'cat-vehiculos'
export const RETIRO_PERSONAL_TOPE_SEMANAL = 300000
export const PERSONAS_RETIRO = ['Andres', 'Nicolas'] as const

export type PersonaRetiro = typeof PERSONAS_RETIRO[number]

export function parseLocalDate(fecha: string): Date {
  const [year, month, day] = fecha.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getRangoSemana(fecha: Date = new Date()) {
  const inicio = new Date(fecha)
  const day = inicio.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  inicio.setDate(inicio.getDate() + diffToMonday)
  inicio.setHours(0, 0, 0, 0)

  const fin = new Date(inicio)
  fin.setDate(inicio.getDate() + 6)
  fin.setHours(23, 59, 59, 999)

  return {
    inicio,
    fin,
    inicioStr: toDateInputValue(inicio),
    finStr: toDateInputValue(fin),
  }
}

export function normalizarPersonaRetiro(contacto?: string | null): PersonaRetiro | null {
  const value = contacto?.trim().toLowerCase()
  if (value === 'andres' || value === 'andrés') return 'Andres'
  if (value === 'nicolas' || value === 'nicoals' || value === 'nicólas' || value === 'nicolás') return 'Nicolas'
  return null
}

export function esRetiroPersonal(movimiento: Movimiento): boolean {
  return movimiento.tipo === 'egreso' && movimiento.categoria_id === RETIRO_PERSONAL_CATEGORY_ID
}

export function esGastoVehiculo(movimiento: Movimiento): boolean {
  return movimiento.tipo === 'egreso' && movimiento.categoria_id === VEHICULOS_CATEGORY_ID
}

export function estaEnRango(movimiento: Movimiento, inicioStr: string, finStr: string): boolean {
  return movimiento.fecha >= inicioStr && movimiento.fecha <= finStr
}
