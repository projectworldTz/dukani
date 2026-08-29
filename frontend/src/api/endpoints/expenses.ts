import { api } from '../client'

export const expenseCategoriesApi = {
  list: () => api.get<{ id: number; name: string }[]>('/expense-categories').then((r) => r.data),
  create: (name: string) => api.post('/expense-categories', { name }).then((r) => r.data),
}

export const expensesApi = {
  list: (params?: { branch_id?: number; category_id?: number; from?: string; to?: string }) =>
    api.get('/expenses', { params }).then((r) => r.data),
  create: (data: { expense_category_id: number; branch_id?: number; amount: number; description?: string; date: string; payment_method_id?: number }) =>
    api.post('/expenses', data).then((r) => r.data),
}

export interface ProfitReport {
  revenue: number
  cost_of_goods_sold: number
  gross_profit: number
  gross_profit_margin: number
  total_expenses: number
  net_profit: number
}

export const reportsApi = {
  profit: (params?: { from?: string; to?: string; branch_id?: number; group_by?: 'none' | 'product' | 'category' | 'branch' }) =>
    api.get('/reports/profit', { params }).then((r) => r.data),
}
