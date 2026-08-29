import { api } from '../client'

export interface CustomerRecord {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  customer_type: 'retail' | 'wholesale'
  credit_limit: number
  loyalty_points: number
  notes: string | null
  outstanding_balance: number
}

export const customersApi = {
  list: (search?: string) => api.get<CustomerRecord[]>('/customers', { params: { search } }).then((r) => r.data),
  create: (data: Partial<CustomerRecord>) => api.post<CustomerRecord>('/customers', data).then((r) => r.data),
  show: (id: number) => api.get(`/customers/${id}`).then((r) => r.data),
  update: (id: number, data: Partial<CustomerRecord>) => api.put(`/customers/${id}`, data).then((r) => r.data),
  recordPayment: (id: number, saleId: number, amount: number, paymentMethodId?: number) =>
    api.post(`/customers/${id}/payments`, { sale_id: saleId, amount, payment_method_id: paymentMethodId }).then((r) => r.data),
}
