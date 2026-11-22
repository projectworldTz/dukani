import { describe, expect, it } from 'vitest'
import {
  breakEvenCalc,
  breakdown,
  changeCalc,
  discountCalc,
  markupCalc,
  profitCalc,
  salesCalc,
  stockValueCalc,
  vatCalc,
  type ToolResult,
} from './business'

/** Map result lines by label for readable assertions. */
const v = (r: ToolResult) => Object.fromEntries(r.lines.map((l) => [l.label, l.value]))

describe('A. profit', () => {
  it('normal values', () => {
    const r = profitCalc({ buy: '700', sell: '1000', qty: '24' })
    expect(r.errors).toEqual({})
    expect(v(r)).toEqual({ 'Gross profit': 7200, 'Total cost': 16800, 'Total revenue': 24000, 'Profit margin': 30, Markup: 42.86 })
  })
  it('quantity defaults to 1 and decimals round to cents', () => {
    expect(v(profitCalc({ buy: '2.5', sell: '3.75', qty: '' }))).toMatchObject({ 'Gross profit': 1.25, 'Profit margin': 33.33, Markup: 50 })
  })
  it('selling below cost shows a loss', () => {
    const r = profitCalc({ buy: '1000', sell: '800', qty: '2' })
    expect(v(r)['Loss']).toBe(400)
    expect(r.note).toMatch(/below cost/)
  })
  it('zero prices do not divide by zero', () => {
    const r = profitCalc({ buy: '0', sell: '0', qty: '5' })
    expect(r.errors).toEqual({})
    expect(v(r)).toEqual({ 'Gross profit': 0, 'Total cost': 0, 'Total revenue': 0 })
  })
  it('validates empty, invalid, negative and zero quantity', () => {
    expect(profitCalc({ buy: '', sell: 'abc' }).errors).toEqual({ buy: 'Enter the buying price.', sell: 'Enter a valid number.' })
    expect(profitCalc({ buy: '-5', sell: '10' }).errors.buy).toBe("Buying price can't be negative.")
    expect(profitCalc({ buy: '5', sell: '10', qty: '0' }).errors.qty).toBe('Quantity must be more than 0.')
  })
  it('handles large numbers and thousands separators', () => {
    expect(v(profitCalc({ buy: '1,000,000', sell: '1,250,000', qty: '1000' }))['Gross profit']).toBe(250_000_000)
    expect(profitCalc({ buy: '1e20', sell: '1' }).errors.buy).toBe('Enter a valid number.')
    expect(profitCalc({ buy: '9999999999999999', sell: '1' }).errors.buy).toBe('That number is too large.')
  })
})

describe('B. discount', () => {
  it('normal and decimal values', () => {
    expect(v(discountCalc({ price: '15000', pct: '10' }))).toEqual({ 'Customer pays': 13500, 'Discount amount': 1500 })
    expect(v(discountCalc({ price: '99.99', pct: '12.5' }))).toEqual({ 'Customer pays': 87.49, 'Discount amount': 12.5 })
  })
  it('0% and 100%', () => {
    expect(v(discountCalc({ price: '5000', pct: '0' }))['Customer pays']).toBe(5000)
    expect(v(discountCalc({ price: '5000', pct: '100' }))['Customer pays']).toBe(0)
  })
  it('rejects over 100% and negatives', () => {
    expect(discountCalc({ price: '5000', pct: '120' }).errors.pct).toBe("Discount can't be more than 100.")
    expect(discountCalc({ price: '-1', pct: '5' }).errors.price).toBeDefined()
  })
})

describe('C. VAT', () => {
  it('adds 18% VAT', () => {
    expect(v(vatCalc({ amount: '10000', rate: '18', mode: 'add' }))).toEqual({ 'Price with VAT': 11800, 'VAT to add': 1800, 'Price without VAT': 10000 })
  })
  it('extracts VAT from an inclusive price', () => {
    expect(v(vatCalc({ amount: '11800', rate: '18', mode: 'extract' }))).toEqual({ 'VAT included': 1800, 'Price without VAT': 10000, 'Price with VAT': 11800 })
  })
  it('supports other rates, including 0%', () => {
    expect(v(vatCalc({ amount: '1000', rate: '16', mode: 'add' }))['Price with VAT']).toBe(1160)
    expect(v(vatCalc({ amount: '1000', rate: '0', mode: 'extract' }))['VAT included']).toBe(0)
  })
  it('validates the rate', () => {
    expect(vatCalc({ amount: '1000', rate: '', mode: 'add' }).errors.rate).toBe('Enter the vat rate.')
    expect(vatCalc({ amount: '1000', rate: '150', mode: 'add' }).errors.rate).toBeDefined()
  })
})

describe('D. markup', () => {
  it('selling price from cost and markup', () => {
    expect(v(markupCalc({ cost: '700', pct: '30' }))).toEqual({ 'Recommended selling price': 910, 'Profit per item': 210, 'Profit margin': 23.08 })
  })
  it('0% markup and zero cost', () => {
    expect(v(markupCalc({ cost: '500', pct: '0' }))['Recommended selling price']).toBe(500)
    expect(v(markupCalc({ cost: '0', pct: '50' }))).toEqual({ 'Recommended selling price': 0, 'Profit per item': 0 })
  })
})

describe('E. stock value', () => {
  it('value at cost, optional selling value', () => {
    expect(v(stockValueCalc({ qty: '48', unit: '700' }))).toEqual({ 'Stock value (at cost)': 33600 })
    expect(v(stockValueCalc({ qty: '48', unit: '700', sell: '1000' }))).toEqual({ 'Stock value (at cost)': 33600, 'Value if all sold': 48000, 'Expected profit': 14400 })
  })
  it('decimal quantities (e.g. kilograms) and zero', () => {
    expect(v(stockValueCalc({ qty: '12.5', unit: '2800' }))['Stock value (at cost)']).toBe(35000)
    expect(v(stockValueCalc({ qty: '0', unit: '2800' }))['Stock value (at cost)']).toBe(0)
  })
  it('rejects an invalid optional selling price', () => {
    expect(stockValueCalc({ qty: '1', unit: '1', sell: 'x' }).errors.sell).toBe('Enter a valid number.')
  })
})

describe('F. sales total', () => {
  it('percent and fixed discounts', () => {
    expect(v(salesCalc({ price: '1500', qty: '4', discount: '10', discountType: 'percent' }))).toEqual({ 'Total to pay': 5400, Subtotal: 6000, Discount: 600 })
    expect(v(salesCalc({ price: '1500', qty: '4', discount: '500', discountType: 'amount' }))).toEqual({ 'Total to pay': 5500, Subtotal: 6000, Discount: 500 })
  })
  it('no discount is fine; a discount above the subtotal is not', () => {
    expect(v(salesCalc({ price: '300', qty: '3', discount: '' }))['Total to pay']).toBe(900)
    expect(salesCalc({ price: '300', qty: '3', discount: '1000', discountType: 'amount' }).errors.discount).toMatch(/more than the subtotal/)
  })
})

describe('G. change', () => {
  it('change to give', () => {
    expect(v(changeCalc({ due: '5900', received: '10000' }))['Change to give']).toBe(4100)
  })
  it('exact and short payments', () => {
    expect(changeCalc({ due: '5000', received: '5000' }).note).toMatch(/no change/)
    const short = changeCalc({ due: '5000', received: '3000' })
    expect(v(short)['Customer still owes']).toBe(2000)
  })
  it('suggests TZS notes and coins', () => {
    expect(breakdown(4100)).toEqual([
      { value: 2000, count: 2 },
      { value: 100, count: 1 },
    ])
    expect(breakdown(18750)).toEqual([
      { value: 10000, count: 1 },
      { value: 5000, count: 1 },
      { value: 2000, count: 1 },
      { value: 1000, count: 1 },
      { value: 500, count: 1 },
      { value: 200, count: 1 },
      { value: 50, count: 1 },
    ])
  })
})

describe('H. break-even', () => {
  it('rounds the number of items up', () => {
    // 300,000 / (1,500 - 1,000) = 600 exactly
    expect(v(breakEvenCalc({ fixed: '300000', price: '1500', variable: '1000' }))).toEqual({
      'Items to sell to break even': 600,
      'Sales needed': 900000,
      'Profit per item (after item cost)': 500,
    })
    // 100 / 30 = 3.33 → 4 items
    expect(v(breakEvenCalc({ fixed: '100', price: '50', variable: '20' }))['Items to sell to break even']).toBe(4)
  })
  it('zero fixed costs', () => {
    expect(v(breakEvenCalc({ fixed: '0', price: '50', variable: '20' }))['Items to sell to break even']).toBe(0)
  })
  it('price not above cost can never break even', () => {
    expect(breakEvenCalc({ fixed: '1000', price: '20', variable: '20' }).errors.price).toMatch(/never break even/)
    expect(breakEvenCalc({ fixed: '1000', price: '10', variable: '20' }).lines).toEqual([])
  })
})
