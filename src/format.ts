let fractionDigits = 2

export function setMoneyCents(showCents: boolean) {
  fractionDigits = showCents ? 2 : 0
}

export function money(amount: number, symbol: string): string {
  const value = Number.isFinite(amount) ? amount : 0
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${symbol}${formatted}`
}

export function qty(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}
