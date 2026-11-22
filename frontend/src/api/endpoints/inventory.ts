import { api } from '../client'

export type StockMovementType = 'opening_stock' | 'purchase' | 'adjustment' | 'damaged' | 'expired' | 'lost' | 'stolen'

export interface AdjustStockPayload {
  branch_id: number
  type: StockMovementType
  /** Relative change: positive to add stock, negative to remove it. */
  quantity_change?: number
  /** Absolute quantity actually counted on the shelf ("Fix count"). */
  counted_quantity?: number
  /** New cost price per unit when restocking. */
  unit_cost?: number
  reason?: string
  /** Pharmacy: the batch arriving (with its expiry) or the batch to remove from. */
  batch_number?: string
  expiry_date?: string
  manufactured_at?: string
  batch_id?: number
}

export interface StockMovement {
  id: number
  type: string
  quantity_change: number
  previous_quantity: number
  new_quantity: number
  reason: string | null
  created_at: string
  user: { id: number; name: string } | null
  branch: { id: number; name: string } | null
}

export const inventoryApi = {
  list: (params?: { branch_id?: number; low_stock?: boolean; page?: number }) =>
    api.get('/inventory', { params }).then((r) => r.data),
  adjust: (productId: number, data: AdjustStockPayload) =>
    api.post(`/products/${productId}/stock/adjust`, data).then((r) => r.data),
  movements: (productId: number) =>
    api.get<{ data: StockMovement[] }>(`/products/${productId}/stock/movements`).then((r) => r.data),
}
