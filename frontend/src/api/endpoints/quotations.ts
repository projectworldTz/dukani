import { api } from '../client'

export interface QuotationItemPayload {
  product_id: number
  quantity: number
  unit_price?: number
  discount_amount?: number
}

export interface QuotationPayload {
  branch_id: number
  customer_id?: number
  customer_name?: string
  valid_until?: string
  notes?: string
  payment_terms?: string
  items: QuotationItemPayload[]
}

export const quotationsApi = {
  list: (status?: string) => api.get('/quotations', { params: { status } }).then((r) => r.data),
  create: (data: QuotationPayload) => api.post('/quotations', data).then((r) => r.data),
  update: (id: number, data: Partial<QuotationPayload>) => api.put(`/quotations/${id}`, data).then((r) => r.data),
  show: (id: number) => api.get(`/quotations/${id}`).then((r) => r.data),
  updateStatus: (id: number, status: string) => api.put(`/quotations/${id}/status`, { status }).then((r) => r.data),
  convert: (id: number) => api.post(`/quotations/${id}/convert`).then((r) => r.data),
  duplicate: (id: number) => api.post(`/quotations/${id}/duplicate`).then((r) => r.data),
  fetchPdfBlob: (id: number) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data as Blob),
}
