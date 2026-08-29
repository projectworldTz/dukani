import { api } from '../client'

export const stockTransfersApi = {
  list: (params?: { status?: string; branch_id?: number }) => api.get('/stock-transfers', { params }).then((r) => r.data),
  create: (data: { from_branch_id: number; to_branch_id: number; notes?: string; items: { product_id: number; quantity: number }[] }) =>
    api.post('/stock-transfers', data).then((r) => r.data),
  show: (id: number) => api.get(`/stock-transfers/${id}`).then((r) => r.data),
  request: (id: number) => api.post(`/stock-transfers/${id}/request`).then((r) => r.data),
  approve: (id: number) => api.post(`/stock-transfers/${id}/approve`).then((r) => r.data),
  dispatch: (id: number) => api.post(`/stock-transfers/${id}/dispatch`).then((r) => r.data),
  receive: (id: number) => api.post(`/stock-transfers/${id}/receive`).then((r) => r.data),
  cancel: (id: number) => api.post(`/stock-transfers/${id}/cancel`).then((r) => r.data),
}

export const stockTakesApi = {
  list: (params?: { status?: string; branch_id?: number }) => api.get('/stock-takes', { params }).then((r) => r.data),
  create: (branchId: number, productIds: number[]) =>
    api.post('/stock-takes', { branch_id: branchId, product_ids: productIds }).then((r) => r.data),
  show: (id: number) => api.get(`/stock-takes/${id}`).then((r) => r.data),
  recordCounts: (id: number, counts: { item_id: number; counted_quantity: number }[]) =>
    api.put(`/stock-takes/${id}/counts`, { counts }).then((r) => r.data),
  submit: (id: number) => api.post(`/stock-takes/${id}/submit`).then((r) => r.data),
  approve: (id: number) => api.post(`/stock-takes/${id}/approve`).then((r) => r.data),
}

export const productBatchesApi = {
  expiring: (withinDays = 90) => api.get('/product-batches', { params: { within_days: withinDays } }).then((r) => r.data),
}
