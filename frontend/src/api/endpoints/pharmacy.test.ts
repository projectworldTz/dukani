import { describe, expect, it } from 'vitest'
import { initials } from '../../pages/pos/posUtils'
import { expiryStatus, medicineSubtitle } from './pharmacy'

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('expiryStatus', () => {
  it('flags expired, under 30 days, under 90 days and fine', () => {
    expect(expiryStatus(inDays(-3))).toMatchObject({ color: 'error', days: -3 })
    expect(expiryStatus(inDays(-3)).label).toMatch(/^Expired /)
    expect(expiryStatus(inDays(0))).toMatchObject({ color: 'error', days: 0 })
    expect(expiryStatus(inDays(20))).toMatchObject({ color: 'error', days: 20 })
    expect(expiryStatus(inDays(60))).toMatchObject({ color: 'warning', days: 60 })
    expect(expiryStatus(inDays(400))).toMatchObject({ color: 'success', days: 400 })
    expect(expiryStatus(inDays(400)).label).toMatch(/^Exp /)
  })

  it('handles a missing date', () => {
    expect(expiryStatus(null)).toEqual({ label: 'No expiry', color: 'info', days: null })
  })
})

describe('medicineSubtitle', () => {
  it('joins generic name, strength and a readable form', () => {
    expect(medicineSubtitle({ generic_name: 'Paracetamol', strength: '500 mg', dosage_form: 'tablet' })).toBe('Paracetamol · 500 mg · Tablet')
    expect(medicineSubtitle({ generic_name: 'Amoxicillin', dosage_form: 'suspension' })).toBe('Amoxicillin · Suspension')
    expect(medicineSubtitle({})).toBe('')
  })
})

describe('initials', () => {
  it('uses words that start with a letter', () => {
    expect(initials('Amoxil 500mg')).toBe('AM')
    expect(initials('Panadol Extra')).toBe('PE')
    expect(initials('Coca-Cola 500ml')).toBe('CC')
    expect(initials('500')).toBe('50')
  })
})
