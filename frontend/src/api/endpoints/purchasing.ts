import { api } from '../client'

export interface SupplierRecord {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tin: string | null
  outstanding_balance: number
}

export const suppliersApi = {
  list: () => api.get<SupplierRecord[]>('/suppliers').then((r) => r.data),
  create: (data: Partial<SupplierRecord>) => api.post<SupplierRecord>('/suppliers', data).then((r) => r.data),
  show: (id: number) => api.get(`/suppliers/${id}`).then((r) => r.data),
}

export interface PurchaseItemPayload {
  product_id: number
  quantity_ordered: number
  unit_cost: number
  tax_amount?: number
}

export const purchasesApi = {
  list: (params?: { status?: string; supplier_id?: number }) => api.get('/purchases', { params }).then((r) => r.data),
  create: (data: { branch_id: number; supplier_id: number; notes?: string; items: PurchaseItemPayload[] }) =>
    api.post('/purchases', data).then((r) => r.data),
  show: (id: number) => api.get(`/purchases/${id}`).then((r) => r.data),
  receive: (id: number, receipts: { purchase_item_id: number; quantity: number; batch_number?: string; expiry_date?: string }[]) =>
    api.post(`/purchases/${id}/receive`, { receipts }).then((r) => r.data),
  recordPayment: (id: number, amount: number, paymentMethodId?: number, reference?: string) =>
    api.post(`/purchases/${id}/payments`, { amount, payment_method_id: paymentMethodId, reference }).then((r) => r.data),
  createReturn: (id: number, items: { purchase_item_id: number; quantity: number }[], reason?: string) =>
    api.post(`/purchases/${id}/returns`, { items, reason }).then((r) => r.data),
}

export const purchaseOrdersApi = {
  list: () => api.get('/purchase-orders').then((r) => r.data),
  create: (data: { branch_id: number; supplier_id: number; notes?: string; items: PurchaseItemPayload[] }) =>
    api.post('/purchase-orders', data).then((r) => r.data),
  show: (id: number) => api.get(`/purchase-orders/${id}`).then((r) => r.data),
  updateStatus: (id: number, status: string) => api.put(`/purchase-orders/${id}/status`, { status }).then((r) => r.data),
  convert: (id: number) => api.post(`/purchase-orders/${id}/convert`).then((r) => r.data),
}
