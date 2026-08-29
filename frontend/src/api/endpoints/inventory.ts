import { api } from '../client'

export const inventoryApi = {
  list: (params?: { branch_id?: number; low_stock?: boolean; page?: number }) =>
    api.get('/inventory', { params }).then((r) => r.data),
  adjust: (productId: number, data: { branch_id: number; quantity_change: number; type: string; reason?: string }) =>
    api.post(`/products/${productId}/stock/adjust`, data).then((r) => r.data),
  movements: (productId: number) => api.get(`/products/${productId}/stock/movements`).then((r) => r.data),
}
