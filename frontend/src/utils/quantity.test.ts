import { describe, expect, it } from 'vitest'
import { formatQty, gramsToKg, kgToGrams, linePrice } from './quantity'

describe('weighed quantities (grams in storage, kg on screen)', () => {
  it('converts kg typed by the user into whole grams', () => {
    expect(kgToGrams('2.35')).toBe(2350)
    expect(kgToGrams('0.25')).toBe(250)
    expect(kgToGrams('1,000')).toBe(1_000_000)
    expect(kgToGrams('0.0004')).toBe(0)
    expect(kgToGrams('')).toBeNull()
    expect(kgToGrams('abc')).toBeNull()
    expect(kgToGrams('-1')).toBeNull()
  })

  it('formats grams as kg', () => {
    expect(gramsToKg(2350)).toBe('2.35')
    expect(gramsToKg(1500000)).toBe('1,500')
    expect(formatQty(7650, true)).toBe('7.65 kg')
    expect(formatQty(12, false)).toBe('12')
  })

  it('prices a weighed line per kg, rounded to cents', () => {
    expect(linePrice(12000, 2350, true)).toBe(28200)
    expect(linePrice(9999, 333, true)).toBe(3329.67)
    expect(linePrice(9000, 3, false)).toBe(27000)
  })
})
