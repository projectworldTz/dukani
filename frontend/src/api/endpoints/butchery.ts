import { api } from '../client'

export interface ButcherySummary {
  sold_kg_today: number
  weighed_products: number
  breakdowns_this_week: number
}

export interface CarcassBreakdown {
  id: number
  description: string
  carcass_weight_g: number
  total_cost: string
  yield_weight_g: number
  cost_per_kg: string
  lines: { product_id: number; name: string; weight_g: number }[]
  created_at: string
  creator: { id: number; name: string } | null
  yield_percent?: number
  loss_kg?: number
}

export const butcheryApi = {
  summary: (branchId?: number) => api.get<ButcherySummary>('/butchery/summary', { params: { branch_id: branchId } }).then((r) => r.data),
  updatePrices: (prices: { product_id: number; selling_price: number; cost_price?: number }[]) =>
    api.post<{ updated: number }>('/butchery/prices', { prices }).then((r) => r.data),
  breakdowns: () => api.get<{ data: CarcassBreakdown[] }>('/butchery/breakdowns').then((r) => r.data),
  createBreakdown: (data: { branch_id: number; description: string; carcass_weight_kg: number; total_cost: number; lines: { product_id: number; weight_kg: number }[] }) =>
    api.post<CarcassBreakdown>('/butchery/breakdowns', data).then((r) => r.data),
}
