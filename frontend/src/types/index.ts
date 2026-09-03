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
    unit_price: string
    discount_amount: string
    tax_amount: string
    line_total: string
  }[]
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
