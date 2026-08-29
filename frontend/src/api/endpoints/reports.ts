import { api } from '../client'

export type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'all'

export interface DashboardSummary {
  todays_sales: number
  yesterdays_sales: number
  weekly_sales: number
  monthly_sales: number
  yearly_sales: number
  transactions_count: number
  average_transaction_value: number
  total_customers: number
  new_customers_this_month: number
  low_stock_count: number
  out_of_stock_count: number
  inventory_value: number
  outstanding_customer_credit: number
  outstanding_supplier_payments: number
  cash_sales: number
  mobile_money_sales: number
  card_sales: number
  bank_transfer_sales: number
  discounts_given: number
  tax_collected: number
  total_expenses_this_month: number
  period: ReportPeriod
  period_from: string | null
  period_to: string
  period_revenue: number
  period_profit: number
  period_transactions_count: number
  period_average_transaction_value: number
  period_tax_collected: number
  period_discounts_given: number
  period_expenses: number
  period_cash_sales: number
  period_mobile_money_sales: number
  period_card_sales: number
  period_bank_transfer_sales: number
  period_new_customers: number
}

export interface TrendPoint {
  date: string
  revenue: number
  profit: number
}

export interface TopProductRow {
  product_id: number | null
  product_name: string
  quantity_sold: number
  revenue: number
}

export interface TopProducts {
  best_selling: TopProductRow[]
  lowest_selling: TopProductRow[]
  highest_revenue: TopProductRow[]
}

export const dashboardReportsApi = {
  summary: (period?: ReportPeriod, branchId?: number) =>
    api.get<DashboardSummary>('/reports/dashboard-summary', { params: { period, branch_id: branchId } }).then((r) => r.data),
  trend: (params?: { period?: ReportPeriod; from?: string; to?: string; group_by?: 'day' | 'month'; branch_id?: number }) =>
    api.get<TrendPoint[]>('/reports/sales-trend', { params }).then((r) => r.data),
  topProducts: (period?: ReportPeriod, limit = 5) =>
    api.get<TopProducts>('/reports/top-products', { params: { period, limit } }).then((r) => r.data),
}
