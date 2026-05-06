export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCuit(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

export function isValidCuit(value: string): boolean {
  const digits = onlyDigits(value)
  if (digits.length !== 11) return false
  if (/^(\d)\1+$/.test(digits)) return false

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, weight, idx) => acc + Number(digits[idx]) * weight, 0)
  const mod = sum % 11
  const checkDigit = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return checkDigit === Number(digits[10])
}

export function shouldValidateCuit(tipoDocumento: string): boolean {
  return tipoDocumento === 'CUIT' || tipoDocumento === 'CUIL'
}
