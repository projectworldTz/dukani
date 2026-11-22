export function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const TILE_COLORS = ['#DCFCE7', '#DBEAFE', '#FEF3C7', '#FCE7F3', '#E0E7FF', '#CCFBF1', '#FFEDD5', '#F3E8FF']
const TILE_TEXT = ['#166534', '#1E40AF', '#92400E', '#9D174D', '#3730A3', '#115E59', '#9A3412', '#6B21A8']

/** Stable pastel colour per product name, so tiles without a photo are still easy to tell apart. */
export function tileColors(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const i = hash % TILE_COLORS.length
  return { bg: TILE_COLORS[i], fg: TILE_TEXT[i] }
}

/** Two-letter monogram from the words that start with a letter ("Amoxil 500mg" → "AM", "Coca-Cola 500ml" → "CO"). */
export function initials(name: string) {
  const words = name.trim().split(/[\s-]+/).filter((w) => /^[A-Za-z]/.test(w))
  if (words.length === 0) return name.trim().slice(0, 2).toUpperCase() || '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Cash amounts a customer is likely to hand over: the exact total, then the total
 * rounded up to common note sizes. Keeps the cashier from typing in most sales.
 */
export function quickCashAmounts(total: number): number[] {
  if (total <= 0) return []
  const steps = [500, 1000, 5000, 10000, 20000, 50000]
  const values = new Set<number>([Math.round(total * 100) / 100])
  for (const step of steps) {
    const rounded = Math.ceil(total / step) * step
    if (rounded > total) values.add(rounded)
  }
  return [...values].sort((a, b) => a - b).slice(0, 5)
}
