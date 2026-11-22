export interface AuthUser {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  phone: string | null
  status: string
  is_platform_admin: boolean
  branch_id: number | null
  job_title: string | null
  roles: string[]
  permissions: string[]
  business: {
    id: number
    name: string
    slug: string
    currency: string
    timezone: string
    /** Off = simple mode: multi-step stock/purchasing workflows are hidden from the menu. */
    advanced_features?: boolean
    category?: string | null
    /** 'pharmacy' for Pharmacy & Health businesses — switches the whole app to the pharmacy platform. */
    platform?: 'general' | 'pharmacy' | 'butchery'
  } | null
}

export interface Branch {
  id: number
  name: string
  code: string
  address: string | null
  phone: string | null
  is_main: boolean
  status: 'active' | 'inactive'
}

export interface Product {
  id: number
  uuid: string
  name: string
  description: string | null
  sku: string | null
  image_url: string | null
  /** Pharmacy medicine details (null for general products). */
  generic_name?: string | null
  strength?: string | null
  dosage_form?: string | null
  pack_size?: string | null
  manufacturer?: string | null
  requires_prescription?: boolean
  is_controlled?: boolean
  /** Butchery: priced per kg; every stock quantity is in grams. */
  sold_by_weight?: boolean
  /** Pharmacy, with a branch: units in expired batches (not sellable) and the next expiry date. */
  expired_stock?: number
  nearest_expiry?: string | null
  category: { id: number; name: string } | null
  brand: { id: number; name: string } | null
  unit: { id: number; name: string; short_name: string } | null
  cost_price: string
  selling_price: string
  wholesale_price: string | null
  minimum_selling_price: string | null
  tax_rate: string
  is_tax_inclusive: boolean
  discount_percent: string | null
  reorder_level: number
  max_stock_level: number | null
  shelf_location: string | null
  has_expiry: boolean
  has_batch: boolean
  has_serial: boolean
  status: 'active' | 'inactive'
  available_stock?: number
  barcodes: { code: string; type: string; is_primary: boolean }[]
  created_at: string
}

export interface CartLine {
  product: Product
  quantity: number
  discountAmount: number
  /** Pharmacy: how the patient should take it — printed on the receipt. */
  dosage?: string
}

export interface PaymentMethod {
  id: number
  name: string
  type: string
  is_active: boolean
}

export interface CashierShift {
  id: number
  branch_id: number
  user_id: number
  opening_cash: string
  closing_cash: string | null
  expected_cash: string | null
  difference: string | null
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
}

export interface Sale {
  id: number
  receipt_number: string
  status: string
  branch_id: number
  cashier?: { id: number; name: string }
  customer_id?: number | null
  customer_name: string | null
  customer_phone: string | null
  subtotal: string
  discount_total: string
  tax_total: string
  grand_total: string
  amount_paid: string
  change_amount: string
  outstanding_balance?: string | number
  loyalty_points_earned?: number
  loyalty_points_redeemed?: number
  currency: string
  items?: {
    product_id: number | null
    product_name: string
    sku: string | null
    quantity: number
    /** 1000 when quantity is in grams and unit_price is per kg. */
    price_divisor?: number
    unit_price: string
    discount_amount: string
    tax_amount: string
    line_total: string
    dosage_instructions?: string | null
    batches?: { batch_number: string | null; expiry_date: string | null; quantity: number }[]
  }[]
  prescription?: Prescription | null
  payments?: { payment_method: string; amount: string; reference: string | null }[]
  completed_at: string | null
  created_at: string
  fiscal_status?: 'not_required' | 'pending' | 'fiscalized' | 'failed'
  fiscal_receipt_number?: string | null
  fiscal_verification_code?: string | null
  fiscal_verification_url?: string | null
  fiscal_z_number?: string | null
  fiscalized_at?: string | null
}

export interface Prescription {
  rx_number: string
  prescriber_name: string
  prescriber_reg_no?: string | null
  facility?: string | null
  issued_on?: string | null
  patient_name: string
  patient_age?: number | null
  patient_phone?: string | null
  notes?: string | null
}

export interface StaffMember {
  id: number
  name: string
  email: string
  phone: string | null
  status: 'active' | 'inactive'
  branch_id: number | null
  job_title: string | null
  roles: string[]
  created_at: string
}

export interface RoleWithPermissions {
  id: number
  name: string
  is_protected: boolean
  permissions: string[]
  users_count: number
  limits: { key: string; value: string }[]
}
