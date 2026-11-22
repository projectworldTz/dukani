import { describe, expect, it } from 'vitest'
import { CalcError, evaluate, formatNumber, preview } from './expression'

describe('evaluate — basic arithmetic', () => {
  it.each([
    ['2+3', 5],
    ['10-4', 6],
    ['6×7', 42],
    ['6*7', 42],
    ['20÷4', 5],
    ['20/4', 5],
    ['2+3×4', 14],
    ['(2+3)×4', 20],
    ['10-2-3', 5],
    ['100÷10÷2', 5],
    ['2(3+4)', 14],
    ['(1+1)(2+2)', 8],
  ])('%s = %d', (input, expected) => {
    expect(evaluate(input)).toBe(expected)
  })

  it('handles decimals without floating-point noise', () => {
    expect(evaluate('0.1+0.2')).toBe(0.3)
    expect(evaluate('1.1×3')).toBe(3.3)
    expect(evaluate('2.5×4')).toBe(10)
    expect(evaluate('.5+.25')).toBe(0.75)
  })

  it('handles negative numbers', () => {
    expect(evaluate('-5+3')).toBe(-2)
    expect(evaluate('5×-2')).toBe(-10)
    expect(evaluate('(-4)×(-4)')).toBe(16)
    expect(evaluate('--3')).toBe(3)
  })

  it('handles zero', () => {
    expect(evaluate('0×12345')).toBe(0)
    expect(evaluate('0÷5')).toBe(0)
    expect(evaluate('-0')).toBe(0)
  })

  it('accepts thousands separators', () => {
    expect(evaluate('1,500+2,500')).toBe(4000)
  })

  it('handles large numbers', () => {
    expect(evaluate('999999999×1000')).toBe(999999999000)
    expect(evaluate('12345678×87654321')).toBe(1082152022374638)
  })
})

describe('evaluate — powers, roots, percent', () => {
  it('powers are right-associative and bind tighter than unary minus', () => {
    expect(evaluate('2^10')).toBe(1024)
    expect(evaluate('2^3^2')).toBe(512)
    expect(evaluate('-2^2')).toBe(-4)
    expect(evaluate('(-2)^2')).toBe(4)
    expect(evaluate('5²')).toBe(25)
    expect(evaluate('4^0.5')).toBe(2)
  })

  it('square roots', () => {
    expect(evaluate('√16')).toBe(4)
    expect(evaluate('√(9+16)')).toBe(5)
    expect(evaluate('2√9')).toBe(6)
    expect(evaluate('√2')).toBeCloseTo(1.41421356237, 10)
  })

  it('percent works like a shop calculator', () => {
    expect(evaluate('50%')).toBe(0.5)
    expect(evaluate('200+10%')).toBe(220)
    expect(evaluate('200-10%')).toBe(180)
    expect(evaluate('200×10%')).toBe(20)
    expect(evaluate('15000-18%')).toBe(12300)
    expect(evaluate('10%×300')).toBe(30)
  })
})

describe('evaluate — friendly errors', () => {
  it.each([
    ['', 'Enter a calculation.'],
    ['5÷0', "Can't divide by zero."],
    ['5÷(2-2)', "Can't divide by zero."],
    ['√-4', "Can't take the square root of a negative number."],
    ['(-8)^0.5', 'That power has no real answer.'],
    ['2+', 'The calculation is not complete.'],
    ['×3', 'The calculation is not complete.'],
    ['(2+3', 'A bracket is not closed.'],
    ['2+3)', 'There is a closing bracket without an opening one.'],
    ['1.2.3', 'That number has too many decimal points.'],
    ['10^400', 'The answer is too large to show.'],
  ])('%j → %s', (input, message) => {
    expect(() => evaluate(input)).toThrow(CalcError)
    expect(() => evaluate(input)).toThrow(message)
  })

  it('rejects anything that is not maths — no code can run', () => {
    expect(() => evaluate('alert(1)')).toThrow(CalcError)
    expect(() => evaluate('2+a')).toThrow(CalcError)
    expect(() => evaluate('constructor')).toThrow(CalcError)
  })
})

describe('preview', () => {
  it('ignores a trailing operator and auto-closes brackets while typing', () => {
    expect(preview('12×3+')).toBe(36)
    expect(preview('(2+3')).toBe(5)
    expect(preview('√')).toBeNull()
    expect(preview('')).toBeNull()
    expect(preview('5÷0')).toBeNull()
  })
})

describe('formatNumber', () => {
  it('adds separators and trims decimals', () => {
    expect(formatNumber(1234567.5)).toBe('1,234,567.5')
    expect(formatNumber(0.3)).toBe('0.3')
    expect(formatNumber(-42)).toBe('-42')
    expect(formatNumber(1e20)).toBe('1e+20')
  })
})
