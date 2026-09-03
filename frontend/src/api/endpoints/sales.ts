import { api } from '../client'
import type { PaymentMethod, Sale } from '../../types'

export interface SaleItemPayload {
  product_id: number
  quantity: number
  unit_price?: number
  discount_amount?: number
}

export interface CreateSalePayload {
  branch_id: number
  shift_id?: number
  customer_id?: number
  customer_name?: string
  customer_phone?: string
  notes?: string
  hold?: boolean
  redeem_points?: number
  idempotency_key?: string
  items: SaleItemPayload[]
  payments?: { payment_method_id: number; amount: number; reference?: string }[]
}

export const paymentMethodsApi = {
  list: () => api.get<PaymentMethod[]>('/payment-methods').then((r) => r.data),
}

export const salesApi = {
  create: (data: CreateSalePayload) => api.post<Sale>('/sales', data).then((r) => r.data),
  held: (branchId: number) => api.get<Sale[]>('/sales/held', { params: { branch_id: branchId } }).then((r) => r.data),
  complete: (saleId: number, payments: { payment_method_id: number; amount: number; reference?: string }[], redeemPoints?: number) =>
    api.post<Sale>(`/sales/${saleId}/complete`, { payments, redeem_points: redeemPoints }).then((r) => r.data),
  list: (params?: { branch_id?: number; status?: string; receipt_number?: string; page?: number }) =>
    api.get('/sales', { params }).then((r) => r.data),
  show: (id: number) => api.get<Sale>(`/sales/${id}`).then((r) => r.data),
  createReturn: (id: number, items: { sale_item_id: number; quantity: number; condition: 'sellable' | 'damaged' }[], reason?: string, refundPaymentMethodId?: number) =>
    api.post(`/sales/${id}/returns`, { items, reason, refund_payment_method_id: refundPaymentMethodId }).then((r) => r.data),
  // The receipt endpoint requires the Bearer token, so a plain <a href> or
  // window.open(url) can't be used directly (no way to attach the header) — fetch it
  // through axios (which does attach it) and hand back an object URL to open/print.
  fetchReceiptPdfBlobUrl: (id: number, paper: '58mm' | '80mm' | 'a4' = '80mm') =>
    api
      .get(`/sales/${id}/receipt.pdf`, { params: { paper }, responseType: 'blob' })
      .then((r) => URL.createObjectURL(r.data as Blob)),
  emailReceipt: (id: number, email: string | undefined, paper: '58mm' | '80mm' | 'a4' = '80mm') =>
    api.post<{ message: string }>(`/sales/${id}/receipt/email`, { email, paper }).then((r) => r.data),
  fiscalize: (id: number) => api.post<Sale>(`/sales/${id}/fiscalize`).then((r) => r.data),
}
