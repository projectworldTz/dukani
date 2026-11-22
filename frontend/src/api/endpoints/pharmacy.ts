import { api } from '../client'
import type { Prescription } from '../../types'

export interface PharmacySummary {
  expired_batches: number
  expired_units: number
  expiring_30_batches: number
  expiring_90_batches: number
  expiring_90_units: number
  prescriptions_today: number
  controlled_medicines: number
  prescription_medicines: number
}

export interface MedicineBatch {
  id: number
  batch_number: string
  expiry_date: string | null
  manufactured_at: string | null
  quantity_received: number
  quantity_remaining: number
  days_until_expiry: number | null
  is_expired: boolean
}

export interface ExpiryRow {
  id: number
  product: { id: number; name: string; generic_name: string | null; strength: string | null; dosage_form: string | null; cost_price: string; is_controlled: boolean } | null
  branch: { id: number; name: string } | null
  batch_number: string
  expiry_date: string
  quantity_remaining: number
  value_at_cost: number
  days_until_expiry: number
  is_expired: boolean
}

export interface PrescriptionRecord extends Prescription {
  id: number
  created_at: string
  sale: {
    id: number
    receipt_number: string
    grand_total: string
    completed_at: string | null
    status: string
    items: { id: number; product_name: string; quantity: number; dosage_instructions: string | null }[]
  } | null
  recorder: { id: number; name: string } | null
}

export interface ControlledEntry {
  id: number
  type: 'received' | 'dispensed' | 'returned' | 'removed' | 'adjusted'
  quantity_in: number
  quantity_out: number
  balance_after: number
  patient_name: string | null
  prescriber_name: string | null
  reference: string | null
  created_at: string
  product: { id: number; name: string; generic_name: string | null; strength: string | null; dosage_form: string | null } | null
  batch: { id: number; batch_number: string; expiry_date: string | null } | null
  recorder: { id: number; name: string } | null
  sale: { id: number; receipt_number: string } | null
  branch: { id: number; name: string } | null
}

interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
}

export const pharmacyApi = {
  catalog: () => api.get<{ dosage_forms: string[] }>('/pharmacy/catalog').then((r) => r.data),
  summary: (branchId?: number) => api.get<PharmacySummary>('/pharmacy/summary', { params: { branch_id: branchId } }).then((r) => r.data),
  expiry: (params: { status: 'expiring' | 'expired'; within_days?: number; branch_id?: number }) =>
    api.get<ExpiryRow[]>('/pharmacy/expiry', { params }).then((r) => r.data),
  productBatches: (productId: number, branchId?: number) =>
    api.get<MedicineBatch[]>(`/pharmacy/products/${productId}/batches`, { params: { branch_id: branchId } }).then((r) => r.data),
  prescriptions: (params: { search?: string; page?: number }) =>
    api.get<Paginated<PrescriptionRecord>>('/pharmacy/prescriptions', { params }).then((r) => r.data),
  controlledRegister: (params: { product_id?: number; page?: number }) =>
    api.get<Paginated<ControlledEntry>>('/pharmacy/controlled-register', { params }).then((r) => r.data),
}

/** Plain-language dosage form names. */
export const DOSAGE_FORM_LABELS: Record<string, string> = {
  tablet: 'Tablet', capsule: 'Capsule', syrup: 'Syrup', suspension: 'Suspension', injection: 'Injection', cream: 'Cream',
  ointment: 'Ointment', drops: 'Drops', inhaler: 'Inhaler', suppository: 'Suppository', powder: 'Powder', sachet: 'Sachet',
  gel: 'Gel', lotion: 'Lotion', spray: 'Spray', device: 'Medical device', other: 'Other',
}

/** Quick dosage instructions a pharmacist taps instead of typing. */
export const DOSAGE_PRESETS = [
  '1 tablet 3 times daily after meals',
  '2 tablets 3 times daily after meals',
  '1 tablet twice daily',
  '1 tablet once daily',
  '2 tablets every 6 hours if needed for pain',
  '5 ml 3 times daily',
  '10 ml 3 times daily',
  'Apply twice daily',
  'As directed by the doctor',
]

/** "Paracetamol · 500 mg · Tablet" */
export function medicineSubtitle(p: { generic_name?: string | null; strength?: string | null; dosage_form?: string | null }) {
  return [p.generic_name, p.strength, p.dosage_form ? DOSAGE_FORM_LABELS[p.dosage_form] ?? p.dosage_form : null].filter(Boolean).join(' · ')
}

/** Expiry status for badges: expired, < 30 days, < 90 days, or fine. */
export function expiryStatus(date: string | null | undefined): { label: string; color: 'error' | 'warning' | 'info' | 'success'; days: number | null } {
  if (!date) return { label: 'No expiry', color: 'info', days: null }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${date}T00:00:00`)
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  const label = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  if (days < 0) return { label: `Expired ${label}`, color: 'error', days }
  if (days <= 30) return { label: `Exp ${label}`, color: 'error', days }
  if (days <= 90) return { label: `Exp ${label}`, color: 'warning', days }
  return { label: `Exp ${label}`, color: 'success', days }
}
