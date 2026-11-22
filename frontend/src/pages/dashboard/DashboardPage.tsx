import {
  ArrowDownward,
  ArrowForward,
  ArrowUpward,
  BarChartRounded,
  CalculateRounded,
  BoltRounded,
  CategoryRounded,
  GroupAddRounded,
  InsertChartRounded,
  ReceiptLongOutlined,
  MonetizationOnRounded,
  ViewInArRounded,
  ShoppingCartRounded,
  WarningAmberRounded,
  WidgetsRounded,
  EventBusyRounded,
  HourglassBottomRounded,
  LocalPharmacyRounded,
  MedicationRounded,
  ScaleRounded,
  PriceChangeRounded,
  ContentCutRounded,
} from '@mui/icons-material'
import { Box, Button, ButtonBase, Chip, Paper, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from '@mui/material'
import { LineChart } from '@mui/x-charts/LineChart'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { productsApi } from '../../api/endpoints/products'
import { dashboardReportsApi } from '../../api/endpoints/reports'
import { salesApi } from '../../api/endpoints/sales'
import { useActiveBranch } from '../../hooks/useActiveBranch'
import { useAuthStore } from '../../stores/authStore'
import type { Product, Sale } from '../../types'
import { initials, tileColors } from '../pos/posUtils'
import { useCalculatorStore } from '../../components/calculator/calculatorStore'
import { usePlatform } from '../../hooks/usePlatform'
import { butcheryApi } from '../../api/endpoints/butchery'
import { formatQty, isWeighed } from '../../utils/quantity'
import { expiryStatus, medicineSubtitle, pharmacyApi } from '../../api/endpoints/pharmacy'

type Range = '7d' | '30d' | 'month'

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function rangeDates(range: Range) {
  const to = new Date()
  const from = range === '7d' ? daysAgo(6) : range === '30d' ? daysAgo(29) : new Date(to.getFullYear(), to.getMonth(), 1)
  const days: Date[] = []
  for (const d = new Date(from); isoDay(d) <= isoDay(to); d.setDate(d.getDate() + 1)) days.push(new Date(d))
  return { from: isoDay(from), to: isoDay(to), days }
}

/** "RCP-2026-000005" → 5: the running number is what a cashier refers to. */
function shortReceipt(receipt: string) {
  const n = Number(receipt.split('-').pop())
  return Number.isFinite(n) ? n : receipt
}

function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}

/** "+12% vs yesterday" — or a short plain-language note when there is nothing to compare with. */
function Delta({ today, yesterday }: { today: number; yesterday: number }) {
  const font = 'clamp(12.5px, 0.95vw, 16px)'
  if (yesterday === 0) {
    return <Typography sx={{ fontSize: font, color: 'text.secondary' }} noWrap>{today > 0 ? 'New today' : 'No sales yet today'}</Typography>
  }
  const pct = Math.round(((today - yesterday) / Math.abs(yesterday)) * 100)
  const up = pct >= 0
  const color = up ? '#16A34A' : '#EF4444'
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
      {up ? <ArrowUpward sx={{ fontSize: 'clamp(14px, 1vw, 18px)', color }} /> : <ArrowDownward sx={{ fontSize: 'clamp(14px, 1vw, 18px)', color }} />}
      <Typography sx={{ fontWeight: 600, fontSize: font, color }}>
        {up ? '+' : ''}
        {pct}%
      </Typography>
      <Typography sx={{ fontSize: font, color: 'text.secondary' }} noWrap>
        vs yesterday
      </Typography>
    </Stack>
  )
}

// Same soft tints, borders and solid icon circles as the reference design.
const CARD_THEMES = {
  blue: { bg: '#EDF3FF', border: '#D7E3FB', icon: '#2563EB' },
  green: { bg: '#E9F8EF', border: '#CDEBD9', icon: '#22A55B' },
  orange: { bg: '#FFF3E6', border: '#F9DFC0', icon: '#F5A31A' },
  purple: { bg: '#F2EEFE', border: '#E0D8FB', icon: '#7C4DEB' },
} as const

/**
 * Sizes scale with the viewport (CSS clamp) so four cards always fit in one row on a
 * laptop and reach the reference design's full size on large monitors. minWidth: 0
 * everywhere lets long amounts truncate with "…" instead of pushing the row wider.
 */
function StatCard({ tone, icon, label, value, unit, footer, loading }: { tone: keyof typeof CARD_THEMES; icon: ReactNode; label: string; value: string; unit?: string; footer: ReactNode; loading?: boolean }) {
  const t = CARD_THEMES[tone]
  return (
    <Box
      data-stat-card
      sx={{
        minWidth: 0,
        p: 'clamp(14px, 1.3vw, 22px)',
        borderRadius: '12px',
        bgcolor: t.bg,
        border: '1px solid',
        borderColor: t.border,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 1.25, sm: 'clamp(12px, 1.2vw, 24px)' },
      }}
    >
      <Box
        sx={{
          width: { xs: 40, sm: 'clamp(46px, 3.9vw, 70px)' },
          height: { xs: 40, sm: 'clamp(46px, 3.9vw, 70px)' },
          borderRadius: '50%',
          bgcolor: t.icon,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          '& svg': { fontSize: { xs: 22, sm: 'clamp(24px, 2.1vw, 38px)' } },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, width: '100%' }}>
        <Typography sx={{ fontWeight: 600, fontSize: { xs: 13, sm: 'clamp(14px, 1.1vw, 18px)' }, color: '#1F2937', lineHeight: 1.3 }} noWrap>
          {label}
        </Typography>
        {loading ? (
          <Skeleton width="80%" height={36} />
        ) : (
          <Typography title={unit ? `${unit} ${value}` : value} sx={{ fontWeight: 800, fontSize: { xs: 21, sm: 'clamp(20px, 1.75vw, 31px)' }, lineHeight: 1.3, letterSpacing: -0.3, color: '#0F172A' }} noWrap>
            {unit && (
              <Box component="span" sx={{ fontSize: '0.62em', fontWeight: 700, color: '#475569', mr: '0.3em', letterSpacing: 0 }}>
                {unit}
              </Box>
            )}
            {value}
          </Typography>
        )}
        <Box sx={{ mt: 0.25, minWidth: 0 }}>{footer}</Box>
      </Box>
    </Box>
  )
}

const PHONE_LABELS: Record<string, string> = { 'Start Sale': 'Sell', 'Add Product': 'Product', 'Add Customer': 'Customer', 'View Reports': 'Reports', Calculator: 'Calc', 'Add Medicine': 'Medicine', 'Check Expiry': 'Expiry', 'Price Board': 'Prices', 'Cut Carcass': 'Carcass' }

interface QuickAction {
  label: string
  icon: ReactNode
  color: string
  show: boolean
  /** Navigate somewhere… */
  to?: string
  /** …or do something on the current screen (e.g. open the calculator). */
  onClick?: () => void
}

/** Props that make a ButtonBase either a router link or a plain button. */
const actionProps = (a: Pick<QuickAction, 'to' | 'onClick'>) => (a.to ? { component: Link, to: a.to } : { onClick: a.onClick })

/** Phone: quick actions as a row of round app icons, like a mobile banking app. */
function QuickActionIcons({ actions }: { actions: QuickAction[] }) {
  return (
    <Paper elevation={0} sx={{ display: { xs: 'grid', sm: 'none' }, gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`, gap: 1, p: 1.5, mb: 2, borderRadius: '14px', border: '1px solid', borderColor: 'divider' }}>
      {actions.map((a) => (
        <ButtonBase key={a.label} {...(actionProps(a) as object)} sx={{ flexDirection: 'column', gap: 0.75, borderRadius: 2, py: 0.5, minWidth: 0 }}>
          <Box sx={{ width: 52, height: 52, borderRadius: '16px', bgcolor: a.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 14px ${a.color}40`, '& svg': { fontSize: 26 } }}>
            {a.icon}
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', width: '100%', textAlign: 'center' }} noWrap>
            {PHONE_LABELS[a.label] ?? a.label}
          </Typography>
        </ButtonBase>
      ))}
    </Paper>
  )
}

function Panel({ icon, title, action, children, sx }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode; sx?: object }) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: '12px', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 3px rgba(15,23,42,0.04)', height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          {icon}
          <Typography sx={{ fontWeight: 700, fontSize: 19 }}>{title}</Typography>
        </Stack>
        {action}
      </Stack>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
  )
}

function ViewAll({ to }: { to: string }) {
  return (
    <Button component={Link} to={to} endIcon={<ArrowForward />} sx={{ fontWeight: 600 }}>
      View All
    </Button>
  )
}

const PAYMENT_CHIP: Record<string, { bg: string; fg: string }> = {
  cash: { bg: '#DCFCE7', fg: '#15803D' },
  card: { bg: '#DBEAFE', fg: '#1D4ED8' },
  bank: { bg: '#E0F2FE', fg: '#0369A1' },
  mobile: { bg: '#F3E8FF', fg: '#7E22CE' },
}
function paymentChipColors(name: string) {
  const n = name.toLowerCase()
  if (n.includes('cash')) return PAYMENT_CHIP.cash
  if (n.includes('card')) return PAYMENT_CHIP.card
  if (n.includes('bank')) return PAYMENT_CHIP.bank
  return PAYMENT_CHIP.mobile
}
const STATUS_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  completed: { bg: '#DCFCE7', fg: '#15803D', label: 'Completed' },
  held: { bg: '#FEF3C7', fg: '#B45309', label: 'On hold' },
  refunded: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Refunded' },
  partially_refunded: { bg: '#FFEDD5', fg: '#C2410C', label: 'Part refunded' },
  cancelled: { bg: '#F1F5F9', fg: '#475569', label: 'Cancelled' },
}

/** Compact payment labels so the Recent Sales table fits beside the chart. */
function shortMethod(name: string) {
  const n = name.toLowerCase()
  if (n.includes('bank')) return 'Bank'
  if (n.includes('mobile')) return 'Mobile'
  return name
}

function SoftChip({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <Chip label={label} size="small" sx={{ bgcolor: bg, color: fg, fontWeight: 600, borderRadius: 1.5, height: 24, fontSize: 'clamp(11.5px, 0.85vw, 13px)', '& .MuiChip-label': { px: 'clamp(6px, 0.6vw, 10px)' } }} />
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuthStore()
  const currency = user?.business?.currency ?? ''
  const canReports = hasPermission('sales.view.all')
  const canSeeSales = canReports || hasPermission('sales.view.own')
  const canSeeStock = hasPermission('products.manage')
  const { isPharmacy, isButchery } = usePlatform()
  const canSeeExpiry = isPharmacy && hasPermission('inventory.view')
  const { branchId } = useActiveBranch()
  const [range, setRange] = useState<Range>('7d')
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`

  const yesterday = isoDay(daysAgo(1))
  const summaryQuery = useQuery({ queryKey: ['reports', 'summary', 'today'], queryFn: () => dashboardReportsApi.summary('today'), enabled: canReports })
  const yesterdayQuery = useQuery({
    queryKey: ['reports', 'trend', 'yesterday', yesterday],
    queryFn: () => dashboardReportsApi.trend({ from: yesterday, to: yesterday, group_by: 'day' }),
    enabled: canReports,
  })
  const { from, to, days } = useMemo(() => rangeDates(range), [range])
  const trendQuery = useQuery({
    queryKey: ['reports', 'trend', range, from, to],
    queryFn: () => dashboardReportsApi.trend({ from, to, group_by: 'day' }),
    enabled: canReports,
  })
  const recentQuery = useQuery({ queryKey: ['sales', 'recent'], queryFn: () => salesApi.list({ page: 1, per_page: 5 }), enabled: canSeeSales })
  const lowQuery = useQuery({
    queryKey: ['products', 'dashboard-alerts', 'low', branchId],
    queryFn: () => productsApi.list({ branch_id: branchId!, stock: 'low', per_page: 5 }),
    enabled: canSeeStock && !!branchId,
  })
  const outQuery = useQuery({
    queryKey: ['products', 'dashboard-alerts', 'out', branchId],
    queryFn: () => productsApi.list({ branch_id: branchId!, stock: 'out', per_page: 5 }),
    enabled: canSeeStock && !!branchId,
  })

  const summary = summaryQuery.data
  const y = yesterdayQuery.data?.[0] ?? { revenue: summary?.yesterdays_sales ?? 0, profit: 0, orders: 0 }
  const lowCount = (lowQuery.data?.meta?.total ?? 0) + (outQuery.data?.meta?.total ?? 0)
  const alerts: Product[] = [...(outQuery.data?.data ?? []), ...(lowQuery.data?.data ?? [])].slice(0, 4)

  // Pharmacy: expiry is the stock risk that matters most.
  const pharmacySummaryQuery = useQuery({
    queryKey: ['pharmacy', 'summary', branchId],
    queryFn: () => pharmacyApi.summary(branchId ?? undefined),
    enabled: canSeeExpiry && !!branchId,
  })
  const expiredRowsQuery = useQuery({
    queryKey: ['pharmacy', 'expiry', 'expired', 90, branchId],
    queryFn: () => pharmacyApi.expiry({ status: 'expired', branch_id: branchId ?? undefined }),
    enabled: canSeeExpiry && !!branchId,
  })
  const expiringRowsQuery = useQuery({
    queryKey: ['pharmacy', 'expiry', 'expiring', 90, branchId],
    queryFn: () => pharmacyApi.expiry({ status: 'expiring', within_days: 90, branch_id: branchId ?? undefined }),
    enabled: canSeeExpiry && !!branchId,
  })
  const expiryAlerts = [...(expiredRowsQuery.data ?? []), ...(expiringRowsQuery.data ?? [])].slice(0, 4)
  const ps = pharmacySummaryQuery.data
  const butcheryQuery = useQuery({
    queryKey: ['butchery', 'summary', branchId],
    queryFn: () => butcheryApi.summary(branchId ?? undefined),
    enabled: isButchery && canReports && !!branchId,
  })
  const recentSales: Sale[] = recentQuery.data?.data ?? []

  // Fill missing days with zero so the chart shows every day in the range.
  const byDay = new Map((trendQuery.data ?? []).map((p) => [p.date, p.revenue]))
  const chartValues = days.map((d) => byDay.get(isoDay(d)) ?? 0)
  const chartLabels = days.map((d) => (range === '7d' ? d.toLocaleDateString(undefined, { weekday: 'short' }) : String(d.getDate())))

  const openCalculator = useCalculatorStore((s) => s.setOpen)
  const quickActions: QuickAction[] = isPharmacy
    ? [
        { label: 'Dispense', icon: <LocalPharmacyRounded />, to: '/pos', color: '#0D9488', show: hasPermission('sales.create') },
        { label: 'Add Medicine', icon: <MedicationRounded />, to: '/medicines?new=1', color: '#2563EB', show: hasPermission('products.manage') },
        { label: 'Check Expiry', icon: <EventBusyRounded />, to: '/expiry', color: '#F59E0B', show: hasPermission('inventory.view') },
        { label: 'Calculator', icon: <CalculateRounded />, onClick: () => openCalculator(true), color: '#16A34A', show: true },
      ].filter((a) => a.show)
    : isButchery
      ? [
          { label: 'Start Sale', icon: <ShoppingCartRounded />, to: '/pos', color: '#BE123C', show: hasPermission('sales.create') },
          { label: 'Price Board', icon: <PriceChangeRounded />, to: '/price-board', color: '#2563EB', show: hasPermission('products.manage') },
          { label: 'Cut Carcass', icon: <ContentCutRounded />, to: '/carcass', color: '#F59E0B', show: hasPermission('inventory.adjust') },
          { label: 'Calculator', icon: <CalculateRounded />, onClick: () => openCalculator(true), color: '#16A34A', show: true },
        ].filter((a) => a.show)
    : [
    { label: 'Start Sale', icon: <ShoppingCartRounded />, to: '/pos', color: '#2563EB', show: hasPermission('sales.create') },
    { label: 'Add Product', icon: <CategoryRounded />, to: '/products?new=1', color: '#0D9488', show: hasPermission('products.manage') },
    { label: 'Add Customer', icon: <GroupAddRounded />, to: '/customers?new=1', color: '#F59E0B', show: hasPermission('customers.manage') },
    { label: 'View Reports', icon: <InsertChartRounded />, to: '/reports', color: '#7C3AED', show: canReports },
    { label: 'Calculator', icon: <CalculateRounded />, onClick: () => openCalculator(true), color: '#16A34A', show: true },
      ].filter((a) => a.show)

  return (
    <Box>
      <Box sx={{ mb: { xs: 2, sm: 3 } }}>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 34 }, letterSpacing: -0.5 }}>
          {isPhone ? 'Hi' : 'Welcome back'}, {user?.name?.split(' ')[0]}! <span role="img" aria-label="wave">👋</span>
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: { xs: 14, sm: 18 } }}>
          {isPhone ? new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : "Here's what's happening in your business today."}
        </Typography>
      </Box>

      {/* Stat cards */}
      {(canReports || canSeeStock || canSeeExpiry) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1.25, md: 2 }, mb: { xs: 2, sm: 2.5 } }}>
          {canReports && (
            <>
              <StatCard tone="blue" icon={<ShoppingCartRounded />} label="Today's Sales" loading={!summary} unit={currency} value={Math.round(summary?.period_revenue ?? 0).toLocaleString()} footer={<Delta today={summary?.period_revenue ?? 0} yesterday={y.revenue} />} />
              {isButchery && (
                <StatCard tone="green" icon={<ScaleRounded />} label="Sold Today" loading={!butcheryQuery.data} unit={undefined} value={`${(butcheryQuery.data?.sold_kg_today ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`} footer={<Typography sx={{ fontSize: 'clamp(12.5px, 0.95vw, 16px)', color: 'text.secondary' }} noWrap>{(summary?.period_transactions_count ?? 0).toLocaleString()} sales today</Typography>} />
              )}
              {!isPharmacy && !isButchery && (
                <StatCard tone="green" icon={<ViewInArRounded />} label="Total Orders" loading={!summary} value={(summary?.period_transactions_count ?? 0).toLocaleString()} footer={<Delta today={summary?.period_transactions_count ?? 0} yesterday={y.orders ?? 0} />} />
              )}
              <StatCard tone={isPharmacy ? 'green' : 'orange'} icon={<MonetizationOnRounded />} label="Profit Today" loading={!summary} unit={currency} value={Math.round(summary?.period_profit ?? 0).toLocaleString()} footer={<Delta today={summary?.period_profit ?? 0} yesterday={y.profit} />} />
            </>
          )}
          {canSeeExpiry && (
            <>
              <StatCard
                tone="orange"
                icon={<HourglassBottomRounded />}
                label="Expiring Soon"
                loading={!ps}
                value={String(ps?.expiring_90_batches ?? 0)}
                unit={undefined}
                footer={
                  <ButtonBase component={Link} to="/expiry" sx={{ color: 'primary.main', fontWeight: 600, fontSize: 'clamp(12.5px, 0.95vw, 16px)', gap: 0.5, whiteSpace: 'nowrap' }}>
                    Batches in 90 days <ArrowForward sx={{ fontSize: 16 }} />
                  </ButtonBase>
                }
              />
              <StatCard
                tone="purple"
                icon={<EventBusyRounded />}
                label="Expired Stock"
                loading={!ps}
                value={`${ps?.expired_units ?? 0}`}
                footer={
                  <ButtonBase component={Link} to="/expiry" sx={{ color: (ps?.expired_units ?? 0) > 0 ? 'error.main' : 'primary.main', fontWeight: 600, fontSize: 'clamp(12.5px, 0.95vw, 16px)', gap: 0.5, whiteSpace: 'nowrap' }}>
                    {(ps?.expired_units ?? 0) > 0 ? 'Remove now' : 'All in date'} <ArrowForward sx={{ fontSize: 16 }} />
                  </ButtonBase>
                }
              />
            </>
          )}
          {canSeeStock && !isPharmacy && (
            <StatCard
              tone="purple"
              icon={<WidgetsRounded />}
              label="Low Stock Items"
              loading={!lowQuery.data || !outQuery.data}
              value={String(lowCount)}
              footer={
                <ButtonBase component={Link} to="/products?stock=low" sx={{ color: 'primary.main', fontWeight: 600, fontSize: 'clamp(12.5px, 0.95vw, 16px)', gap: 0.5, whiteSpace: 'nowrap' }}>
                  View Details <ArrowForward sx={{ fontSize: 16 }} />
                </ButtonBase>
              }
            />
          )}
        </Box>
      )}

      {quickActions.length > 0 && <QuickActionIcons actions={quickActions} />}

      {/* Chart + recent sales */}
      {(canReports || canSeeSales) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: canReports ? 'minmax(0, 1.3fr) minmax(0, 1fr)' : 'minmax(0, 1fr)' }, gap: 2, mb: 2.5 }}>
          {canReports && (
            <Panel
              icon={<BarChartRounded sx={{ color: 'primary.main', fontSize: 30 }} />}
              title="Sales Overview"
              action={
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={range}
                  onChange={(_, v: Range | null) => v && setRange(v)}
                  fullWidth={isPhone}
                  sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: { xs: 1, sm: 1.75 }, borderColor: 'divider' }, '& .MuiToggleButton-root.Mui-selected': { bgcolor: 'primary.main', color: '#FFFFFF', '&:hover': { bgcolor: 'primary.dark' } } }}
                >
                  <ToggleButton value="7d">7 Days</ToggleButton>
                  <ToggleButton value="30d">30 Days</ToggleButton>
                  <ToggleButton value="month">This Month</ToggleButton>
                </ToggleButtonGroup>
              }
            >
              {trendQuery.isLoading ? (
                <Skeleton variant="rounded" height={isPhone ? 190 : 236} />
              ) : (
                <Box sx={{ position: 'relative' }}>
                  <Chip
                    label={`Today: ${money(chartValues[chartValues.length - 1] ?? 0)}`}
                    sx={{ position: 'absolute', right: 8, top: 0, zIndex: 1, bgcolor: 'primary.main', color: '#fff', fontWeight: 700 }}
                  />
                  <LineChart
                    height={isPhone ? 190 : 236}
                    margin={{ left: 4, right: 16, top: 34, bottom: 4 }}
                    grid={{ horizontal: true, vertical: true }}
                    xAxis={[{ scaleType: 'point', data: chartLabels, tickLabelStyle: { fontSize: isPhone ? 11 : 13 } }]}
                    yAxis={[{ valueFormatter: (v: number) => compact(v), width: isPhone ? 38 : 48, tickLabelStyle: { fontSize: isPhone ? 11 : 13 } }]}
                    series={[{ data: chartValues, area: true, color: theme.palette.primary.main, curve: 'linear', showMark: range === '7d', valueFormatter: (v) => money(v ?? 0), label: 'Sales' }]}
                    hideLegend
                    sx={{
                      '& .MuiLineChart-area': { fillOpacity: 0.12 },
                      '& .MuiLineChart-line': { strokeWidth: 2.5 },
                      '& .MuiLineChart-mark': { fill: theme.palette.primary.main, stroke: '#fff', strokeWidth: 2 },
                      '& .MuiChartsGrid-line': { stroke: '#EEF2F7' },
                    }}
                  />
                  {chartValues.every((v) => v === 0) && (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt: -1 }}>
                      No sales in this period yet — they will appear here as you sell.
                    </Typography>
                  )}
                </Box>
              )}
            </Panel>
          )}

          {canSeeSales && (
            <Panel icon={<ReceiptLongOutlined sx={{ fontSize: 28 }} />} title={canReports ? 'Recent Sales' : 'My Recent Sales'} action={<ViewAll to="/sales" />} sx={{ p: 0, '& > :first-of-type': { px: 2.5, pt: 2.5 } }}>
              {recentQuery.isLoading ? (
                <Box sx={{ px: 2.5 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} height={40} />
                  ))}
                </Box>
              ) : recentSales.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', px: 2 }}>
                  <Typography sx={{ fontWeight: 600 }}>No sales yet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed sales will show up here.
                  </Typography>
                </Box>
              ) : (
                <>
                <Stack sx={{ display: { xs: 'flex', sm: 'none' }, px: 2, pb: 1 }} divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
                  {recentSales.map((s) => {
                    const method = s.payments?.[0]?.payment_method
                    const when = new Date(s.completed_at ?? s.created_at)
                    return (
                      <ButtonBase key={s.id} onClick={() => navigate(`/sales?receipt=${encodeURIComponent(s.receipt_number)}`)} sx={{ py: 1.25, gap: 1.5, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#EFF6FF', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ReceiptLongOutlined fontSize="small" />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 14.5 }} noWrap>
                            Sale #{shortReceipt(s.receipt_number)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {method ? ` · ${(s.payments?.length ?? 0) > 1 ? 'Split' : shortMethod(method)}` : ''}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>{money(Number(s.grand_total))}</Typography>
                      </ButtonBase>
                    )
                  })}
                </Stack>
                <Box sx={{ overflowX: 'auto', display: { xs: 'none', sm: 'block' } }}>
                  <Box
                    component="table"
                    sx={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 'clamp(12.5px, 0.95vw, 14.5px)',
                      '& th': { textAlign: 'left', fontWeight: 600, color: 'text.secondary', bgcolor: '#F8FAFC', py: 1.25, px: 'clamp(6px, 0.8vw, 12px)', whiteSpace: 'nowrap' },
                      '& td': { py: 0.85, px: 'clamp(6px, 0.8vw, 12px)', borderTop: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' },
                      '& tbody tr': { cursor: 'pointer' },
                      '& tbody tr:hover': { bgcolor: 'action.hover' },
                      '& th:first-of-type, & td:first-of-type': { pl: 'clamp(14px, 1.3vw, 20px)' },
                    }}
                  >
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Time</th>
                        <th>Amount</th>
                        <th>Payment</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((s) => {
                        const method = s.payments?.[0]?.payment_method ?? (s.status === 'held' ? '—' : 'Credit')
                        const status = STATUS_CHIP[s.status] ?? { bg: '#F1F5F9', fg: '#475569', label: s.status }
                        const when = new Date(s.completed_at ?? s.created_at)
                        return (
                          <tr key={s.id} onClick={() => navigate(`/sales?receipt=${encodeURIComponent(s.receipt_number)}`)}>
                            <td style={{ fontWeight: 600 }}>#{shortReceipt(s.receipt_number)}</td>
                            <td>{isoDay(when) === isoDay(new Date()) ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                            <td style={{ fontWeight: 600 }}>{money(Number(s.grand_total))}</td>
                            <td>{method === '—' ? '—' : <SoftChip label={(s.payments?.length ?? 0) > 1 ? 'Split' : shortMethod(method)} {...paymentChipColors(method)} />}</td>
                            <td>
                              <SoftChip label={status.label} bg={status.bg} fg={status.fg} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </Box>
                </Box>
                </>
              )}
            </Panel>
          )}
        </Box>
      )}

      {/* Quick actions + stock alerts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: (isPharmacy ? canSeeExpiry : canSeeStock) && quickActions.length > 0 ? 'minmax(0, 1.3fr) minmax(0, 1fr)' : 'minmax(0, 1fr)' }, gap: 2 }}>
        {quickActions.length > 0 && (
          <Panel icon={<BoltRounded sx={{ color: '#F59E0B', fontSize: 30 }} />} title="Quick Actions" sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${quickActions.length}, minmax(0, 1fr))` }, gap: 'clamp(8px, 0.9vw, 14px)' }}>
              {quickActions.map((a) => (
                <ButtonBase
                  key={a.label}
                  {...(actionProps(a) as object)}
                  sx={{
                    minWidth: 0,
                    bgcolor: a.color,
                    color: '#fff',
                    borderRadius: '10px',
                    px: 'clamp(10px, 1vw, 18px)',
                    py: 'clamp(12px, 1.1vw, 18px)',
                    minHeight: { xs: 88, sm: 96 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    boxShadow: `0 8px 18px ${a.color}38`,
                    transition: 'transform .12s, box-shadow .12s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 12px 24px ${a.color}55` },
                  }}
                >
                  {/* Icon and arrow share the top row so the label below gets the tile's full width — always one line. */}
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', '& svg:first-of-type': { fontSize: 'clamp(24px, 1.9vw, 30px)' } }}>
                    {a.icon}
                    <ArrowForward sx={{ fontSize: 'clamp(16px, 1.2vw, 20px) !important', opacity: 0.9 }} />
                  </Stack>
                  <Typography title={a.label} sx={{ fontWeight: 700, fontSize: 'clamp(12.5px, 0.98vw, 16px)', lineHeight: 1.2, mt: 1.5 }} noWrap>
                    {a.label}
                  </Typography>
                </ButtonBase>
              ))}
            </Box>
          </Panel>
        )}

        {canSeeExpiry && (
          <Panel icon={<WarningAmberRounded sx={{ color: 'error.main', fontSize: 30 }} />} title="Expiry Alert" action={<ViewAll to="/expiry" />}>
            {!expiredRowsQuery.data || !expiringRowsQuery.data ? (
              <Skeleton variant="rounded" height={90} />
            ) : expiryAlerts.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 600 }}>Everything is in date 👍</Typography>
                <Typography variant="body2" color="text.secondary">
                  No medicine expires in the next 90 days.
                </Typography>
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
                {expiryAlerts.map((row) => {
                  const st = expiryStatus(row.expiry_date)
                  const name = row.product?.name ?? 'Medicine'
                  const colors = tileColors(name)
                  return (
                    <Stack key={row.id} direction="row" spacing={2} sx={{ alignItems: 'center', py: 1.25 }}>
                      <Box sx={{ width: 56, height: 56, borderRadius: '10px', bgcolor: colors.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'divider' }}>
                        <Typography sx={{ fontWeight: 800, color: colors.fg, fontSize: 18 }}>{initials(name)}</Typography>
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 15.5 }} noWrap>
                          {name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {[row.product ? medicineSubtitle(row.product) : '', `Batch ${row.batch_number}`].filter(Boolean).join(' · ')}
                        </Typography>
                        <Typography sx={{ color: st.color === 'success' ? 'text.secondary' : `${st.color}.main`, fontWeight: 600, fontSize: 13.5 }} noWrap>
                          {row.is_expired ? `Expired · ${row.quantity_remaining} units` : `${st.label} · ${row.quantity_remaining} units`}
                        </Typography>
                      </Box>
                      <Button variant={row.is_expired ? 'contained' : 'outlined'} color={row.is_expired ? 'error' : 'primary'} onClick={() => navigate('/expiry')} sx={{ px: 2, fontWeight: 700, flexShrink: 0 }}>
                        {row.is_expired ? 'Remove' : 'View'}
                      </Button>
                    </Stack>
                  )
                })}
              </Stack>
            )}
          </Panel>
        )}

        {canSeeStock && !isPharmacy && (
          <Panel icon={<WarningAmberRounded sx={{ color: 'error.main', fontSize: 30 }} />} title="Stock Alert" action={<ViewAll to="/products?stock=low" />}>
            {!lowQuery.data || !outQuery.data ? (
              <Skeleton variant="rounded" height={90} />
            ) : alerts.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 600 }}>All stocked up 👍</Typography>
                <Typography variant="body2" color="text.secondary">
                  No products are running low right now.
                </Typography>
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
                {alerts.map((p) => {
                  const qty = p.available_stock ?? 0
                  const left = formatQty(qty, isWeighed(p))
                  const colors = tileColors(p.name)
                  return (
                    <Stack key={p.id} direction="row" spacing={2} sx={{ alignItems: 'center', py: 1.25 }}>
                      <Box sx={{ width: 64, height: 64, borderRadius: '10px', bgcolor: colors.bg, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'divider' }}>
                        {p.image_url ? (
                          <Box component="img" src={p.image_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Typography sx={{ fontWeight: 800, color: colors.fg, fontSize: 20 }}>{initials(p.name)}</Typography>
                        )}
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 16 }} noWrap>
                          {p.name}
                        </Typography>
                        <Typography sx={{ color: 'error.main', fontWeight: 600, fontSize: 14.5 }}>{qty <= 0 ? 'Out of stock' : `Only ${left} left in stock`}</Typography>
                      </Box>
                      {hasPermission('inventory.adjust') && (
                        <Button variant="contained" color="error" onClick={() => navigate(`/products?stock=${qty <= 0 ? 'out' : 'low'}&restock=${p.id}`)} sx={{ px: 2.5, fontWeight: 700, flexShrink: 0 }}>
                          Restock
                        </Button>
                      )}
                    </Stack>
                  )
                })}
              </Stack>
            )}
          </Panel>
        )}
      </Box>
    </Box>
  )
}
