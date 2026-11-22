/**
 * Shop maths for the Business calculator. Pure functions: every tool takes raw text
 * inputs (as typed), validates them, and returns either friendly errors or results.
 * Money values are rounded to 2 decimal places; percentages to 2.
 */

export type Fields = Record<string, string>

export interface ResultLine {
  label: string
  value: number
  kind: 'money' | 'percent' | 'number'
  /** The headline answer — shown large. */
  primary?: boolean
  hint?: string
}

export interface ToolResult {
  errors: Record<string, string>
  lines: ResultLine[]
  note?: string
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

interface ParseRule {
  required?: boolean
  min?: number
  max?: number
  /** Inclusive minimum is the default; set to make the bound exclusive (e.g. quantity > 0). */
  exclusiveMin?: boolean
  label: string
}

/** Parses "1,250.50" style input. Returns undefined for empty optional fields. */
function read(fields: Fields, key: string, rule: ParseRule, errors: Record<string, string>): number | undefined {
  const raw = (fields[key] ?? '').replace(/,/g, '').trim()
  if (raw === '') {
    if (rule.required !== false) errors[key] = `Enter the ${rule.label.toLowerCase()}.`
    return undefined
  }
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(raw)) {
    errors[key] = 'Enter a valid number.'
    return undefined
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || Math.abs(n) > 1e15) {
    errors[key] = 'That number is too large.'
    return undefined
  }
  const min = rule.min ?? 0
  if (rule.exclusiveMin ? n <= min : n < min) {
    errors[key] = rule.exclusiveMin ? `${rule.label} must be more than ${min}.` : `${rule.label} can't be negative.`
    return undefined
  }
  if (rule.max !== undefined && n > rule.max) {
    errors[key] = `${rule.label} can't be more than ${rule.max}.`
    return undefined
  }
  return n
}

const empty = (errors: Record<string, string>): ToolResult => ({ errors, lines: [] })

/** A. Profit: per-unit buy/sell prices × quantity. */
export function profitCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const buy = read(f, 'buy', { label: 'Buying price' }, errors)
  const sell = read(f, 'sell', { label: 'Selling price' }, errors)
  const qty = read(f, 'qty', { label: 'Quantity', exclusiveMin: true, required: false }, errors) ?? 1
  if (buy === undefined || sell === undefined || Object.keys(errors).length) return empty(errors)

  const cost = round2(buy * qty)
  const revenue = round2(sell * qty)
  const profit = round2(revenue - cost)
  const lines: ResultLine[] = [
    { label: profit >= 0 ? 'Gross profit' : 'Loss', value: Math.abs(profit), kind: 'money', primary: true },
    { label: 'Total cost', value: cost, kind: 'money' },
    { label: 'Total revenue', value: revenue, kind: 'money' },
  ]
  if (revenue > 0) lines.push({ label: 'Profit margin', value: round2((profit / revenue) * 100), kind: 'percent', hint: 'Profit as a share of the selling price' })
  if (cost > 0) lines.push({ label: 'Markup', value: round2((profit / cost) * 100), kind: 'percent', hint: 'Profit as a share of the buying price' })
  return { errors, lines, note: profit < 0 ? 'You are selling below cost.' : undefined }
}

/** B. Discount off a price. */
export function discountCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const price = read(f, 'price', { label: 'Original price' }, errors)
  const pct = read(f, 'pct', { label: 'Discount', max: 100 }, errors)
  if (price === undefined || pct === undefined) return empty(errors)
  const amount = round2((price * pct) / 100)
  return {
    errors,
    lines: [
      { label: 'Customer pays', value: round2(price - amount), kind: 'money', primary: true },
      { label: 'Discount amount', value: amount, kind: 'money' },
    ],
  }
}

/** C. VAT — add VAT to a net price, or pull it out of a VAT-inclusive price. */
export function vatCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const amount = read(f, 'amount', { label: 'Amount' }, errors)
  const rate = read(f, 'rate', { label: 'VAT rate', max: 100 }, errors)
  if (amount === undefined || rate === undefined) return empty(errors)
  if (f.mode === 'extract') {
    const net = round2(amount / (1 + rate / 100))
    return {
      errors,
      lines: [
        { label: 'VAT included', value: round2(amount - net), kind: 'money', primary: true },
        { label: 'Price without VAT', value: net, kind: 'money' },
        { label: 'Price with VAT', value: round2(amount), kind: 'money' },
      ],
    }
  }
  const vat = round2((amount * rate) / 100)
  return {
    errors,
    lines: [
      { label: 'Price with VAT', value: round2(amount + vat), kind: 'money', primary: true },
      { label: 'VAT to add', value: vat, kind: 'money' },
      { label: 'Price without VAT', value: round2(amount), kind: 'money' },
    ],
  }
}

/** D. Markup — selling price from cost + desired markup. */
export function markupCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const cost = read(f, 'cost', { label: 'Cost price' }, errors)
  const pct = read(f, 'pct', { label: 'Markup', max: 100000 }, errors)
  if (cost === undefined || pct === undefined) return empty(errors)
  const price = round2(cost * (1 + pct / 100))
  const profit = round2(price - cost)
  const lines: ResultLine[] = [
    { label: 'Recommended selling price', value: price, kind: 'money', primary: true },
    { label: 'Profit per item', value: profit, kind: 'money' },
  ]
  if (price > 0) lines.push({ label: 'Profit margin', value: round2((profit / price) * 100), kind: 'percent' })
  return { errors, lines }
}

/** E. Stock value — what the shelf is worth (and could earn, if a selling price is given). */
export function stockValueCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const qty = read(f, 'qty', { label: 'Quantity' }, errors)
  const unit = read(f, 'unit', { label: 'Buying price per item' }, errors)
  const sell = read(f, 'sell', { label: 'Selling price', required: false }, errors)
  if (qty === undefined || unit === undefined || Object.keys(errors).length) return empty(errors)
  const value = round2(qty * unit)
  const lines: ResultLine[] = [{ label: 'Stock value (at cost)', value, kind: 'money', primary: true }]
  if (sell !== undefined) {
    const revenue = round2(qty * sell)
    lines.push({ label: 'Value if all sold', value: revenue, kind: 'money' }, { label: 'Expected profit', value: round2(revenue - value), kind: 'money' })
  }
  return { errors, lines }
}

/** F. Sales total — price × quantity less a discount (percent or fixed amount). */
export function salesCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const price = read(f, 'price', { label: 'Price' }, errors)
  const qty = read(f, 'qty', { label: 'Quantity', exclusiveMin: true }, errors)
  const byPercent = f.discountType !== 'amount'
  const disc = read(f, 'discount', { label: 'Discount', required: false, max: byPercent ? 100 : undefined }, errors) ?? 0
  if (price === undefined || qty === undefined || Object.keys(errors).length) return empty(errors)
  const subtotal = round2(price * qty)
  const discount = round2(byPercent ? (subtotal * disc) / 100 : disc)
  if (discount > subtotal) return empty({ discount: "Discount can't be more than the subtotal." })
  return {
    errors,
    lines: [
      { label: 'Total to pay', value: round2(subtotal - discount), kind: 'money', primary: true },
      { label: 'Subtotal', value: subtotal, kind: 'money' },
      { label: 'Discount', value: discount, kind: 'money' },
    ],
  }
}

/** Tanzanian notes and coins, largest first — used to suggest how to give change. */
export const TZS_DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 200, 100, 50]

export function breakdown(amount: number, denominations = TZS_DENOMINATIONS): { value: number; count: number }[] {
  let rest = Math.round(amount)
  const out: { value: number; count: number }[] = []
  for (const d of denominations) {
    const count = Math.floor(rest / d)
    if (count > 0) {
      out.push({ value: d, count })
      rest -= count * d
    }
  }
  return out
}

/** G. Change to give back. */
export function changeCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const due = read(f, 'due', { label: 'Amount to pay' }, errors)
  const received = read(f, 'received', { label: 'Amount received' }, errors)
  if (due === undefined || received === undefined) return empty(errors)
  const diff = round2(received - due)
  if (diff < 0) {
    return { errors, lines: [{ label: 'Customer still owes', value: -diff, kind: 'money', primary: true }], note: 'The customer has not paid enough yet.' }
  }
  return { errors, lines: [{ label: 'Change to give', value: diff, kind: 'money', primary: true }], note: diff === 0 ? 'Exact amount — no change needed.' : undefined }
}

/** H. Break-even — how many items must be sold to cover fixed costs. */
export function breakEvenCalc(f: Fields): ToolResult {
  const errors: Record<string, string> = {}
  const fixed = read(f, 'fixed', { label: 'Fixed costs' }, errors)
  const price = read(f, 'price', { label: 'Selling price per item' }, errors)
  const variable = read(f, 'variable', { label: 'Cost per item' }, errors)
  if (fixed === undefined || price === undefined || variable === undefined) return empty(errors)
  const contribution = price - variable
  if (contribution <= 0) return empty({ price: 'Selling price must be higher than the cost per item, or you can never break even.' })
  const units = fixed === 0 ? 0 : Math.ceil(fixed / contribution - 1e-9)
  return {
    errors,
    lines: [
      { label: 'Items to sell to break even', value: units, kind: 'number', primary: true },
      { label: 'Sales needed', value: round2(units * price), kind: 'money' },
      { label: 'Profit per item (after item cost)', value: round2(contribution), kind: 'money' },
    ],
    note: units > 0 ? `Every item after the first ${units.toLocaleString()} is profit.` : 'No fixed costs — every sale is already profit.',
  }
}
