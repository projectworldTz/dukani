import {
  AttachMoney,
  Inventory2,
  PointOfSale,
  Receipt,
  Storefront,
  TrendingDown,
  TrendingUp,
} from '@mui/icons-material'
import { Box, Card, CardContent, Fade, Grid, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { PieChart } from '@mui/x-charts/PieChart'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { inventoryApi } from '../../api/endpoints/inventory'
import { dashboardReportsApi, type ReportPeriod } from '../../api/endpoints/reports'
import { useAuthStore } from '../../stores/authStore'

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

function StatCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: string; to?: string }) {
  const content = (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', color: 'white', display: 'flex' }}>{icon}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }} noWrap>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
  return to ? (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      {content}
    </Link>
  ) : (
    content
  )
}

const PAYMENT_COLORS: Record<string, string> = {
  Cash: '#2563EB',
  'Mobile money': '#0EA5E9',
  Card: '#F59E0B',
  'Bank transfer': '#8B5CF6',
}

export function ReportsPage() {
  const { user, hasPermission } = useAuthStore()
  const currency = user?.business?.currency ?? ''
  const canViewReports = hasPermission('sales.view.all')
  const [period, setPeriod] = useState<ReportPeriod>('month')

  const lowStockQuery = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryApi.list({ low_stock: true }),
    enabled: hasPermission('inventory.view') && !canViewReports,
  })
  const summaryQuery = useQuery({
    queryKey: ['reports', 'summary', period],
    queryFn: () => dashboardReportsApi.summary(period),
    enabled: canViewReports,
  })
  const trendQuery = useQuery({
    queryKey: ['reports', 'trend', period],
    queryFn: () => dashboardReportsApi.trend({ period }),
    enabled: canViewReports,
  })
  const topProductsQuery = useQuery({
    queryKey: ['reports', 'top-products', period],
    queryFn: () => dashboardReportsApi.topProducts(period, 5),
    enabled: canViewReports,
  })

  const summary = summaryQuery.data
  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`

  const paymentBreakdown = summary
    ? [
        { label: 'Cash', value: summary.period_cash_sales },
        { label: 'Mobile money', value: summary.period_mobile_money_sales },
        { label: 'Card', value: summary.period_card_sales },
        { label: 'Bank transfer', value: summary.period_bank_transfer_sales },
      ].filter((p) => p.value > 0)
    : []

  const isMonthlyTrend = trendQuery.data?.[0]?.date.length === 7 // "YYYY-MM" vs "YYYY-MM-DD"
  const trendLabels = trendQuery.data?.map((p) => (isMonthlyTrend ? p.date : p.date.slice(5))) ?? []

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            How your business is doing — pick a period to compare.
          </Typography>
        </Box>

        {canViewReports && (
          <ToggleButtonGroup
            value={period}
            exclusive
            size="small"
            onChange={(_, value: ReportPeriod | null) => value && setPeriod(value)}
            sx={{ bgcolor: 'background.paper', width: { xs: '100%', sm: 'auto' }, flexWrap: 'wrap', '& .MuiToggleButton-root': { flex: { xs: '1 1 33%', sm: '0 0 auto' }, px: { xs: 1, sm: 1.5 } } }}
          >
            {PERIODS.map((p) => (
              <ToggleButton key={p.value} value={p.value} sx={{ textTransform: 'none', px: 2 }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </Stack>

      <Grid container spacing={2}>
        {!canViewReports && hasPermission('inventory.view') && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              icon={<Inventory2 fontSize="small" />}
              label="Low stock items"
              value={String(lowStockQuery.data?.data?.length ?? lowStockQuery.data?.length ?? 0)}
              to="/products?stock=low"
            />
          </Grid>
        )}

        {summary && (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fade in timeout={300}>
                <div>
                  <StatCard icon={<PointOfSale fontSize="small" />} label="Revenue" value={fmt(summary.period_revenue)} />
                </div>
              </Fade>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fade in timeout={400}>
                <div>
                  <StatCard icon={<TrendingUp fontSize="small" />} label="Gross profit" value={fmt(summary.period_profit)} />
                </div>
              </Fade>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fade in timeout={500}>
                <div>
                  <StatCard icon={<Receipt fontSize="small" />} label="Transactions" value={summary.period_transactions_count.toLocaleString()} />
                </div>
              </Fade>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Fade in timeout={600}>
                <div>
                  <StatCard icon={<AttachMoney fontSize="small" />} label="Avg. transaction" value={fmt(summary.period_average_transaction_value)} />
                </div>
              </Fade>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<AttachMoney fontSize="small" />} label="Tax collected" value={fmt(summary.period_tax_collected)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<TrendingDown fontSize="small" />} label="Discounts given" value={fmt(summary.period_discounts_given)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<AttachMoney fontSize="small" />} label="Expenses" value={fmt(summary.period_expenses)} to="/expenses" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<Storefront fontSize="small" />} label="New customers" value={summary.period_new_customers.toLocaleString()} to="/customers" />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<Inventory2 fontSize="small" />} label="Low stock items" value={String(summary.low_stock_count)} to="/products?stock=low" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<Inventory2 fontSize="small" />} label="Inventory value" value={fmt(summary.inventory_value)} to="/products?stock=low" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<AttachMoney fontSize="small" />} label="Customers owe us" value={fmt(summary.outstanding_customer_credit)} to="/customers" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard icon={<AttachMoney fontSize="small" />} label="We owe suppliers" value={fmt(summary.outstanding_supplier_payments)} to="/suppliers" />
            </Grid>
          </>
        )}
      </Grid>

      {canViewReports && (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Fade in={!!trendQuery.data} timeout={500}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Revenue & profit
                </Typography>
                {trendQuery.data && trendQuery.data.length > 0 ? (
                  <LineChart
                    height={300}
                    xAxis={[{ scaleType: 'point', data: trendLabels }]}
                    series={[
                      { data: trendQuery.data.map((p) => p.revenue), label: 'Revenue', color: '#2563EB', curve: 'monotoneX' },
                      { data: trendQuery.data.map((p) => p.profit), label: 'Profit', color: '#b45309', curve: 'monotoneX' },
                    ]}
                  />
                ) : (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No sales in this period yet.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Fade in={!!summary} timeout={650}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Payment methods
                </Typography>
                {paymentBreakdown.length > 0 ? (
                  <PieChart
                    height={300}
                    series={[
                      {
                        data: paymentBreakdown.map((p) => ({ id: p.label, label: p.label, value: p.value, color: PAYMENT_COLORS[p.label] })),
                        innerRadius: 55,
                        paddingAngle: 2,
                        cornerRadius: 4,
                        highlightScope: { fade: 'global', highlight: 'item' },
                      },
                    ]}
                  />
                ) : (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No payments in this period yet.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Fade in={!!topProductsQuery.data} timeout={800}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Top selling products
                </Typography>
                {topProductsQuery.data && topProductsQuery.data.best_selling.length > 0 ? (
                  <BarChart
                    height={300}
                    layout="horizontal"
                    yAxis={[{ scaleType: 'band', data: topProductsQuery.data.best_selling.map((p) => p.product_name) }]}
                    series={[{ data: topProductsQuery.data.best_selling.map((p) => p.quantity_sold), label: 'Units sold', color: '#2563EB' }]}
                    margin={{ left: 100 }}
                  />
                ) : (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No product sales in this period yet.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Fade>
          </Grid>
        </Grid>
      )}

      {!canViewReports && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          Full reports are available to owners and managers.
        </Typography>
      )}
    </Box>
  )
}
