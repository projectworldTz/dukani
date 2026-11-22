/**
 * Weighed products (butchery & fresh foods) store every quantity in whole GRAMS and are
 * priced per KILOGRAM. These helpers keep that conversion in one place so screens
 * always show and accept kilograms.
 */
export const GRAMS_PER_KG = 1000

export const isWeighed = (p: { sold_by_weight?: boolean } | null | undefined) => !!p?.sold_by_weight

/** 2350 → "2.35" */
export function gramsToKg(grams: number): string {
  return (grams / GRAMS_PER_KG).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

/** "2.35" → 2350 (null when not a valid, non-negative number). */
export function kgToGrams(kg: string | number): number | null {
  const n = typeof kg === 'number' ? kg : Number(String(kg).replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0 || String(kg).trim() === '') return null
  return Math.round(n * GRAMS_PER_KG)
}

/** A stored quantity for display: "2.35 kg" for weighed products, "12" otherwise. */
export function formatQty(quantity: number, weighed: boolean): string {
  return weighed ? `${gramsToKg(quantity)} kg` : quantity.toLocaleString()
}

/** Price of a line: per-kg price × grams ÷ 1000 for weighed products. */
export function linePrice(unitPrice: number, quantity: number, weighed: boolean): number {
  return weighed ? Math.round(((unitPrice * quantity) / GRAMS_PER_KG) * 100) / 100 : unitPrice * quantity
}
