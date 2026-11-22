import {
  AdminPanelSettings,
  ArrowForward,
  BarChartRounded,
  CalculateOutlined,
  CalendarMonthOutlined,
  ExpandLess,
  ExpandMore,
  GroupsOutlined,
  HeadsetMicOutlined,
  HomeRounded,
  Inventory2Outlined,
  KeyboardArrowDown,
  LocalPharmacyRounded,
  KebabDiningRounded,
  PriceChangeOutlined,
  ContentCutRounded,
  MedicationRounded,
  EventBusyRounded,
  GppMaybeOutlined,
  Inventory2Rounded,
  MoreHorizRounded,
  ReceiptRounded,
  LocalShippingOutlined,
  Logout,
  Menu as MenuIcon,
  NotificationsNoneRounded,
  PersonRounded,
  PointOfSaleOutlined,
  ReceiptLongOutlined,
  ScheduleOutlined,
  SecurityRounded,
  SettingsOutlined,
  ShoppingCartRounded,
  StorefrontRounded,
  VisibilityRounded,
  WarehouseOutlined,
} from '@mui/icons-material'
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  ButtonBase,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/endpoints/auth'
import { businessApi } from '../../api/endpoints/business'
import { notificationsApi } from '../../api/endpoints/notifications'
import { platformApi } from '../../api/endpoints/platform'
import { useAuthStore } from '../../stores/authStore'
import { usePlatform } from '../../hooks/usePlatform'
import { useToastStore } from '../../stores/toastStore'
import { SessionsDialog } from '../common/SessionsDialog'
import { CalculatorPanel } from '../calculator/CalculatorPanel'
import { TrialBanner } from '../subscription/TrialBanner'
import { useCalculatorStore } from '../calculator/calculatorStore'

const DRAWER_WIDTH = 264
/** Sidebar look per platform: navy/blue for the general POS, deep teal for the pharmacy. */
const BRAND = {
  general: { sidebar: 'linear-gradient(180deg, #13295B 0%, #0E1F47 55%, #0B1838 100%)', active: '#2563EB', activeShadow: 'rgba(37, 99, 235, 0.45)', hover: '#1D4ED8', logo: '#3B82F6' },
  pharmacy: { sidebar: 'linear-gradient(180deg, #0F4C4A 0%, #0B3B39 55%, #072A29 100%)', active: '#0D9488', activeShadow: 'rgba(13, 148, 136, 0.45)', hover: '#0F766E', logo: '#2DD4BF' },
  butchery: { sidebar: 'linear-gradient(180deg, #5B0B20 0%, #450818 55%, #2E0510 100%)', active: '#BE123C', activeShadow: 'rgba(190, 18, 60, 0.45)', hover: '#9F1239', logo: '#FB7185' },
} as const

interface Access {
  permission?: string
  anyOf?: string[]
  /** Hidden unless the business has switched on advanced features in Settings. */
  advanced?: boolean
}

interface NavLeaf extends Access {
  label: string
  path: string
}

interface NavEntry extends Access {
  label: string
  icon: ReactNode
  path?: string
  children?: NavLeaf[]
}

/**
 * Organised around what a shop does every day. Advanced workflows only appear once
 * switched on in Settings, and every entry is filtered by the user's permissions so
 * a cashier never sees screens they can't use.
 */
const NAV: NavEntry[] = [
  { label: 'Dashboard', path: '/', icon: <HomeRounded /> },
  {
    label: 'Sales (POS)',
    icon: <PointOfSaleOutlined />,
    children: [
      { label: 'New sale', path: '/pos', permission: 'sales.create' },
      { label: 'Sales history', path: '/sales', anyOf: ['sales.view.own', 'sales.view.all'] },
      { label: 'Quotations', path: '/quotations', permission: 'quotations.manage', advanced: true },
    ],
  },
  { label: 'Products', path: '/products', icon: <Inventory2Outlined />, permission: 'products.manage' },
  { label: 'Customers', path: '/customers', icon: <GroupsOutlined />, permission: 'customers.manage' },
  {
    label: 'Purchases',
    icon: <LocalShippingOutlined />,
    advanced: true,
    children: [
      { label: 'Purchase orders', path: '/purchases', permission: 'purchases.manage' },
      { label: 'Suppliers', path: '/suppliers', permission: 'suppliers.manage' },
    ],
  },
  {
    label: 'Inventory',
    icon: <WarehouseOutlined />,
    advanced: true,
    children: [
      { label: 'Stock levels', path: '/inventory', permission: 'inventory.view' },
      { label: 'Stock transfers', path: '/stock-transfers', permission: 'stock_transfers.manage' },
      { label: 'Stock taking', path: '/stock-takes', permission: 'stock_takes.manage' },
    ],
  },
  { label: 'Expenses', path: '/expenses', icon: <ReceiptLongOutlined />, anyOf: ['expenses.manage', 'expenses.view'] },
  { label: 'Reports', path: '/reports', icon: <BarChartRounded />, permission: 'sales.view.all' },
  {
    label: 'Settings',
    icon: <SettingsOutlined />,
    children: [
      { label: 'Business settings', path: '/settings', permission: 'business.settings.manage' },
      { label: 'Staff', path: '/staff', permission: 'staff.manage' },
      { label: 'Roles & permissions', path: '/roles', permission: 'roles.manage', advanced: true },
      { label: 'Audit log', path: '/audit-log', permission: 'roles.manage', advanced: true },
    ],
  },
]

/**
 * Pharmacy platform: dispensing, medicines, expiry, prescriptions and the controlled
 * drugs register. General-retail screens (quotations, stock transfers…) stay hidden.
 */
const PHARMACY_NAV: NavEntry[] = [
  { label: 'Dashboard', path: '/', icon: <HomeRounded /> },
  {
    label: 'Dispense',
    icon: <LocalPharmacyRounded />,
    children: [
      { label: 'New sale', path: '/pos', permission: 'sales.create' },
      { label: 'Sales history', path: '/sales', anyOf: ['sales.view.own', 'sales.view.all'] },
      { label: 'Prescriptions', path: '/prescriptions', anyOf: ['sales.view.own', 'sales.view.all'] },
    ],
  },
  { label: 'Medicines', path: '/medicines', icon: <MedicationRounded />, permission: 'products.manage' },
  { label: 'Stock & Expiry', path: '/expiry', icon: <EventBusyRounded />, permission: 'inventory.view' },
  { label: 'Controlled Drugs', path: '/controlled-drugs', icon: <GppMaybeOutlined />, permission: 'inventory.view' },
  { label: 'Customers', path: '/customers', icon: <GroupsOutlined />, permission: 'customers.manage' },
  {
    label: 'Purchases',
    icon: <LocalShippingOutlined />,
    advanced: true,
    children: [
      { label: 'Purchase orders', path: '/purchases', permission: 'purchases.manage' },
      { label: 'Suppliers', path: '/suppliers', permission: 'suppliers.manage' },
    ],
  },
  { label: 'Expenses', path: '/expenses', icon: <ReceiptLongOutlined />, anyOf: ['expenses.manage', 'expenses.view'] },
  { label: 'Reports', path: '/reports', icon: <BarChartRounded />, permission: 'sales.view.all' },
  {
    label: 'Settings',
    icon: <SettingsOutlined />,
    children: [
      { label: 'Business settings', path: '/settings', permission: 'business.settings.manage' },
      { label: 'Staff', path: '/staff', permission: 'staff.manage' },
      { label: 'Roles & permissions', path: '/roles', permission: 'roles.manage', advanced: true },
      { label: 'Audit log', path: '/audit-log', permission: 'roles.manage', advanced: true },
    ],
  },
]

/** Butchery & fresh foods: selling by weight, the daily price board and carcass cutting. */
const BUTCHERY_NAV: NavEntry[] = [
  { label: 'Dashboard', path: '/', icon: <HomeRounded /> },
  {
    label: 'Sales (POS)',
    icon: <PointOfSaleOutlined />,
    children: [
      { label: 'New sale', path: '/pos', permission: 'sales.create' },
      { label: 'Sales history', path: '/sales', anyOf: ['sales.view.own', 'sales.view.all'] },
    ],
  },
  { label: 'Products & Stock', path: '/products', icon: <Inventory2Outlined />, permission: 'products.manage' },
  { label: 'Price Board', path: '/price-board', icon: <PriceChangeOutlined />, permission: 'products.manage' },
  { label: 'Cut Carcass', path: '/carcass', icon: <ContentCutRounded />, permission: 'inventory.adjust' },
  { label: 'Customers', path: '/customers', icon: <GroupsOutlined />, permission: 'customers.manage' },
  {
    label: 'Purchases',
    icon: <LocalShippingOutlined />,
    advanced: true,
    children: [
      { label: 'Purchase orders', path: '/purchases', permission: 'purchases.manage' },
      { label: 'Suppliers', path: '/suppliers', permission: 'suppliers.manage' },
    ],
  },
  { label: 'Expenses', path: '/expenses', icon: <ReceiptLongOutlined />, anyOf: ['expenses.manage', 'expenses.view'] },
  { label: 'Reports', path: '/reports', icon: <BarChartRounded />, permission: 'sales.view.all' },
  {
    label: 'Settings',
    icon: <SettingsOutlined />,
    children: [
      { label: 'Business settings', path: '/settings', permission: 'business.settings.manage' },
      { label: 'Staff', path: '/staff', permission: 'staff.manage' },
      { label: 'Roles & permissions', path: '/roles', permission: 'roles.manage', advanced: true },
      { label: 'Audit log', path: '/audit-log', permission: 'roles.manage', advanced: true },
    ],
  },
]

const PLATFORM_NAV: NavEntry[] = [{ label: 'Platform Admin', path: '/platform', icon: <AdminPanelSettings /> }]

const ROLE_LABELS: Record<string, string> = { 'Business Owner': 'Owner' }

function initialsOf(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tips = [
    ['Make a sale', 'Open Sales (POS) → New sale. Tap products or scan barcodes, then press Charge.'],
    ['Add stock', 'Go to Products and press “Add stock” on the product that arrived.'],
    ['Fix a wrong count', 'In Products press “Fix count” and type what is really on the shelf.'],
    ['End of the day', 'On the sale screen press “End shift” and count your cash drawer.'],
    ['Shortcuts at the till', 'F2 search · F4 charge · F6 hold the sale.'],
  ]
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Need help?</DialogTitle>
      <DialogContent>
        <Stack spacing={1.75}>
          {tips.map(([title, body]) => (
            <Box key={title}>
              <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {body}
              </Typography>
            </Box>
          ))}
          <Alert severity="info">Still stuck? Ask your shop owner or manager — they can change settings and permissions.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Got it</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Phone-only bottom tab bar, like a native app: the most-used screens one thumb-tap
 * away, a raised "Sell" button in the middle, and "More" for the full menu.
 */
function MobileBottomNav({ pathname, onNavigate, onMore }: { pathname: string; onNavigate: (path: string) => void; onMore: () => void }) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { isPharmacy, terms } = usePlatform()
  const tabs = [
    { label: 'Home', path: '/', icon: <HomeRounded />, show: true },
    { label: terms.products, path: terms.productsPath, icon: isPharmacy ? <MedicationRounded /> : <Inventory2Rounded />, show: hasPermission('products.manage') },
    { label: terms.sell, path: '/pos', icon: isPharmacy ? <LocalPharmacyRounded /> : <ShoppingCartRounded />, show: hasPermission('sales.create'), primary: true },
    { label: 'Sales', path: '/sales', icon: <ReceiptRounded />, show: hasPermission('sales.view.own') || hasPermission('sales.view.all') },
  ].filter((t) => t.show)

  const tabSx = (active: boolean) => ({
    flex: 1,
    flexDirection: 'column',
    gap: 0.25,
    py: 0.75,
    color: active ? 'primary.main' : '#64748B',
    '& svg': { fontSize: 24 },
  })

  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.appBar + 1,
        bgcolor: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 -6px 20px rgba(15,23,42,0.06)',
        pb: 'env(safe-area-inset-bottom)',
        alignItems: 'flex-end',
        height: 'calc(64px + env(safe-area-inset-bottom))',
      }}
    >
      {tabs.map((t) => {
        const active = t.path === '/' ? pathname === '/' : pathname.startsWith(t.path)
        if (t.primary) {
          return (
            <ButtonBase key={t.path} onClick={() => onNavigate(t.path)} aria-label={t.label} sx={{ flex: 1, flexDirection: 'column', gap: 0.25, pb: 0.75 }}>
              <Box sx={{ width: 56, height: 56, mt: -3.5, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(37,99,235,0.45)', border: '4px solid #fff', '& svg': { fontSize: 26 } }}>
                {t.icon}
              </Box>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'primary.main' }}>{t.label}</Typography>
            </ButtonBase>
          )
        }
        return (
          <ButtonBase key={t.path} onClick={() => onNavigate(t.path)} sx={tabSx(active)} aria-current={active ? 'page' : undefined}>
            {t.icon}
            <Typography sx={{ fontSize: 11.5, fontWeight: active ? 700 : 500 }}>{t.label}</Typography>
          </ButtonBase>
        )
      })}
      <ButtonBase onClick={onMore} sx={tabSx(false)}>
        <MoreHorizRounded />
        <Typography sx={{ fontSize: 11.5, fontWeight: 500 }}>More</Typography>
      </ButtonBase>
    </Box>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const now = useClock()
  const { user, token, hasPermission, clear, adminSession, exitImpersonation, setUser } = useAuthStore()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [storeAnchor, setStoreAnchor] = useState<null | HTMLElement>(null)
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const isPlatformAdmin = !!user?.is_platform_admin
  const { isPharmacy, isButchery } = usePlatform()
  const brand = BRAND[isPharmacy ? 'pharmacy' : isButchery ? 'butchery' : 'general']
  const openCalculator = useCalculatorStore((s) => s.setOpen)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  // The till is a full-screen workspace with its own bottom bar, so the tab bar steps aside there.
  const showBottomNav = isMobile && !isPlatformAdmin && location.pathname !== '/pos'

  const resendVerification = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => useToastStore.getState().show('Verification email sent.', 'success'),
  })

  // Refresh the cached profile once per session so permission and settings changes
  // (e.g. the advanced-features switch) reach users who were already logged in.
  const meQuery = useQuery({ queryKey: ['auth', 'me', token], queryFn: authApi.me, enabled: !!token, staleTime: 5 * 60_000 })
  useEffect(() => {
    if (meQuery.data) setUser(meQuery.data)
  }, [meQuery.data, setUser])

  const settingsQuery = useQuery({ queryKey: ['business-settings'], queryFn: businessApi.settings, enabled: !isPlatformAdmin, staleTime: 10 * 60_000 })

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(true),
    refetchInterval: 60_000,
    enabled: !isPlatformAdmin,
  })
  const platformNotificationsQuery = useQuery({
    queryKey: ['platform-notifications'],
    queryFn: () => platformApi.notifications.list(true),
    refetchInterval: 60_000,
    enabled: isPlatformAdmin,
  })

  const advancedEnabled = !!user?.business?.advanced_features
  const allowed = (a: Access) =>
    (!a.advanced || advancedEnabled) && (!a.permission || hasPermission(a.permission)) && (!a.anyOf || a.anyOf.some((p) => hasPermission(p)))

  const visibleNav = (isPlatformAdmin ? PLATFORM_NAV : isPharmacy ? PHARMACY_NAV : isButchery ? BUTCHERY_NAV : NAV)
    .filter(allowed)
    .map((entry) => (entry.children ? { ...entry, children: entry.children.filter(allowed) } : entry))
    .filter((entry) => !entry.children || entry.children.length > 0)
    // A group with a single visible page is shown as a plain link — no pointless dropdown.
    .map((entry) => (entry.children?.length === 1 ? { ...entry, path: entry.children[0].path, children: undefined } : entry))

  const roleLabel = user?.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ') || (isPlatformAdmin ? 'Platform admin' : '')
  const storeSubtitle = isPlatformAdmin ? 'Platform administration' : settingsQuery.data?.settings?.address || roleLabel

  async function handleLogout() {
    try {
      await authApi.logout()
    } finally {
      clear()
      navigate('/login')
    }
  }

  async function handleExitImpersonation() {
    try {
      await authApi.logout()
    } catch {
      // Impersonation token may already be expired/revoked — exiting the view still proceeds either way.
    } finally {
      exitImpersonation()
      navigate('/platform')
    }
  }

  function go(path: string) {
    navigate(path)
    setMobileOpen(false)
  }

  const itemSx = {
    borderRadius: '10px',
    mb: 0.5,
    px: 2,
    py: 1.15,
    color: 'rgba(226, 232, 240, 0.82)',
    '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 40 },
    '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#FFFFFF' },
    '&.Mui-selected': { bgcolor: brand.active, color: '#FFFFFF', boxShadow: `0 6px 16px ${brand.activeShadow}` },
    '&.Mui-selected:hover': { bgcolor: brand.hover },
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ButtonBase onClick={() => go(isPlatformAdmin ? '/platform' : '/')} sx={{ px: 2.5, py: 2.5, justifyContent: 'flex-start', gap: 1.5 }}>
        {isPharmacy ? (
          <LocalPharmacyRounded sx={{ fontSize: 40, color: brand.logo, filter: 'drop-shadow(0 4px 10px rgba(45,212,191,0.45))' }} />
        ) : isButchery ? (
          <KebabDiningRounded sx={{ fontSize: 40, color: brand.logo, filter: 'drop-shadow(0 4px 10px rgba(251,113,133,0.45))' }} />
        ) : (
          <ShoppingCartRounded sx={{ fontSize: 40, color: brand.logo, filter: 'drop-shadow(0 4px 10px rgba(59,130,246,0.45))' }} />
        )}
        <Box sx={{ textAlign: 'left' }}>
          <Typography sx={{ fontWeight: 800, fontSize: isPharmacy || isButchery ? 19.5 : 22, lineHeight: 1.1, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
            Dukani{' '}
            <Box component="span" sx={{ color: '#FBBF24' }}>
              {isPharmacy ? 'Pharmacy' : isButchery ? 'Butchery' : 'POS'}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(226,232,240,0.75)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {isPharmacy ? 'Safe, Smart Dispensing.' : isButchery ? 'Fresh Cuts, Fair Weight.' : 'Smart Shop, Easy Business.'}
          </Typography>
        </Box>
      </ButtonBase>

      <List sx={{ px: 1.75, pt: 1, flexGrow: 1, overflowY: 'auto' }}>
        {visibleNav.map((entry) => {
          if (!entry.children) {
            const selected = location.pathname === entry.path
            return (
              <ListItemButton key={entry.label} selected={selected} onClick={() => go(entry.path!)} sx={itemSx}>
                <ListItemIcon>{entry.icon}</ListItemIcon>
                <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontSize: 15.5, fontWeight: selected ? 700 : 500 } } }} />
              </ListItemButton>
            )
          }
          const containsCurrent = entry.children.some((c) => c.path === location.pathname)
          const open = openGroups[entry.label] ?? containsCurrent
          return (
            <Box key={entry.label}>
              <ListItemButton onClick={() => setOpenGroups((g) => ({ ...g, [entry.label]: !open }))} sx={{ ...itemSx, ...(containsCurrent && !open ? { color: '#FFFFFF' } : {}) }}>
                <ListItemIcon>{entry.icon}</ListItemIcon>
                <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontSize: 15.5, fontWeight: containsCurrent ? 700 : 500 } } }} />
                {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </ListItemButton>
              <Collapse in={open} unmountOnExit>
                <List disablePadding sx={{ pl: 3.5, pb: 0.5 }}>
                  {entry.children.map((child) => {
                    const selected = location.pathname === child.path
                    return (
                      <ListItemButton key={child.path} selected={selected} onClick={() => go(child.path)} sx={{ ...itemSx, py: 0.8, mb: 0.25 }}>
                        <ListItemText primary={child.label} slotProps={{ primary: { sx: { fontSize: 14.5, fontWeight: selected ? 700 : 500 } } }} />
                      </ListItemButton>
                    )
                  })}
                </List>
              </Collapse>
            </Box>
          )
        })}
      </List>

      <Box sx={{ px: 1.75, pb: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 1, mb: 1.5 }} />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2, py: 1 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(255,255,255,0.12)', color: '#E2E8F0' }}>
            <PersonRounded fontSize="small" />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: 14.5 }} noWrap>
              {user?.name}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: 12.5 }} noWrap>
                {roleLabel}
              </Typography>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E', flexShrink: 0 }} />
            </Stack>
          </Box>
        </Stack>
        <ListItemButton onClick={handleLogout} sx={{ ...itemSx, mt: 0.5 }}>
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          <ListItemText primary="Logout" slotProps={{ primary: { sx: { fontSize: 15, fontWeight: 500 } } }} />
        </ListItemButton>
        <ButtonBase
          onClick={() => setHelpOpen(true)}
          sx={{ mt: 1.5, width: '100%', justifyContent: 'flex-start', gap: 1.5, p: 1.75, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.07)', color: '#FFFFFF', textAlign: 'left', '&:hover': { bgcolor: 'rgba(255,255,255,0.11)' } }}
        >
          <HeadsetMicOutlined />
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Need Help?</Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(226,232,240,0.75)' }}>Quick guide</Typography>
          </Box>
          <ArrowForward fontSize="small" />
        </ButtonBase>
      </Box>
    </Box>
  )

  const drawerPaperSx = { width: DRAWER_WIDTH, boxSizing: 'border-box' as const, borderRight: 'none', background: brand.sidebar, color: '#E2E8F0' }
  const activeNotifQuery = isPlatformAdmin ? platformNotificationsQuery : notificationsQuery
  const markRead = isPlatformAdmin ? platformApi.notifications.markRead : notificationsApi.markRead
  const notifKey = isPlatformAdmin ? ['platform-notifications'] : ['notifications']

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', width: '100%', overflowX: 'hidden', bgcolor: 'background.default' }}>
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': drawerPaperSx }}>
        {drawerContent}
      </Drawer>
      <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': drawerPaperSx }}>
        {drawerContent}
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 1, px: { xs: 1, sm: 2, md: 3 }, minHeight: { xs: 60, sm: 76 } }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
              <IconButton onClick={() => setMobileOpen(true)} sx={{ display: { xs: showBottomNav ? 'none' : 'inline-flex', md: 'none' } }} aria-label="Open navigation">
                <MenuIcon />
              </IconButton>
              <ButtonBase
                onClick={(e) => setStoreAnchor(e.currentTarget)}
                sx={{ gap: 1.5, borderRadius: 2.5, p: 0.5, pr: 1, minWidth: 0, justifyContent: 'flex-start' }}
                aria-label="Store menu"
              >
                <Box sx={{ width: { xs: 38, sm: 50 }, height: { xs: 38, sm: 50 }, borderRadius: '10px', bgcolor: isPharmacy ? '#F0FDFA' : isButchery ? '#FFF1F2' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isPharmacy ? <LocalPharmacyRounded sx={{ color: 'primary.main', fontSize: { xs: 22, sm: 28 } }} /> : isButchery ? <KebabDiningRounded sx={{ color: 'primary.main', fontSize: { xs: 22, sm: 28 } }} /> : <StorefrontRounded sx={{ color: 'primary.main', fontSize: { xs: 22, sm: 28 } }} />}
                </Box>
                <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, sm: 17 } }} noWrap>
                      {isPlatformAdmin ? 'Dukani Platform' : user?.business?.name}
                    </Typography>
                    <KeyboardArrowDown fontSize="small" color="action" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: 13 }}>
                    {storeSubtitle}
                  </Typography>
                </Box>
              </ButtonBase>
            </Stack>

            <Stack direction="row" sx={{ alignItems: 'center', gap: { xs: 0.25, sm: 1 }, flexShrink: 0 }}>
              <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', mr: 2, color: 'text.secondary' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CalendarMonthOutlined fontSize="small" />
                  <Typography sx={{ fontWeight: 500, color: 'text.primary', fontSize: 15 }}>
                    {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <ScheduleOutlined fontSize="small" />
                  <Typography sx={{ fontWeight: 500, color: 'text.primary', fontSize: 15 }}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                </Stack>
              </Stack>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' }, my: 2 }} />
              {!isPlatformAdmin && (
                <Tooltip title="Calculator (F9)">
                  <ButtonBase
                    onClick={() => openCalculator(true)}
                    aria-label="Open calculator"
                    sx={{
                      gap: 0.75,
                      height: 40,
                      minWidth: 40,
                      px: { xs: 0, sm: 1.75 },
                      mr: { xs: 0.25, sm: 0.5 },
                      borderRadius: '12px',
                      bgcolor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: 14.5,
                      boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
                      transition: 'background-color .15s, transform .1s',
                      '&:hover': { bgcolor: '#15803D' },
                      '&:active': { transform: 'scale(0.96)' },
                    }}
                  >
                    <CalculateOutlined sx={{ fontSize: 22 }} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      Calculator
                    </Box>
                  </ButtonBase>
                </Tooltip>
              )}
              <IconButton onClick={(e) => setNotifAnchorEl(e.currentTarget)} aria-label="Notifications">
                <Badge badgeContent={activeNotifQuery.data?.length ?? 0} color="error">
                  <NotificationsNoneRounded />
                </Badge>
              </IconButton>
              <ButtonBase onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ borderRadius: 6, gap: 0.5, pl: 0.5 }} aria-label="Account menu">
                <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: 15, fontWeight: 700 }}>{initialsOf(user?.name)}</Avatar>
                <KeyboardArrowDown fontSize="small" color="action" sx={{ display: { xs: 'none', sm: 'block' } }} />
              </ButtonBase>
            </Stack>
          </Toolbar>
        </AppBar>

        <Menu anchorEl={storeAnchor} open={!!storeAnchor} onClose={() => setStoreAnchor(null)}>
          {!isPlatformAdmin && hasPermission('business.settings.manage') && (
            <MenuItem onClick={() => { setStoreAnchor(null); navigate('/settings') }}>
              <ListItemIcon><SettingsOutlined fontSize="small" /></ListItemIcon>
              Business settings
            </MenuItem>
          )}
          {!isPlatformAdmin && hasPermission('sales.create') && (
            <MenuItem onClick={() => { setStoreAnchor(null); navigate('/pos') }}>
              <ListItemIcon><PointOfSaleOutlined fontSize="small" /></ListItemIcon>
              Open the till
            </MenuItem>
          )}
          <MenuItem onClick={() => { setStoreAnchor(null); setHelpOpen(true) }}>
            <ListItemIcon><HeadsetMicOutlined fontSize="small" /></ListItemIcon>
            Help
          </MenuItem>
        </Menu>

        <Menu anchorEl={notifAnchorEl} open={!!notifAnchorEl} onClose={() => setNotifAnchorEl(null)} slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 24px)', sm: 360 }, maxWidth: 360 } } }}>
          {(activeNotifQuery.data?.length ?? 0) === 0 && (
            <MenuItem disabled sx={{ opacity: '1 !important' }}>
              <Typography variant="body2" color="text.secondary">
                You're all caught up — no new notifications.
              </Typography>
            </MenuItem>
          )}
          {activeNotifQuery.data?.map((n) => (
            <MenuItem
              key={n.id}
              onClick={async () => {
                await markRead(n.id)
                queryClient.invalidateQueries({ queryKey: notifKey })
              }}
              sx={{ whiteSpace: 'normal' }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {n.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {n.message}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>

        <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
          <MenuItem disabled sx={{ opacity: '1 !important' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.job_title ?? user?.email}
              </Typography>
            </Box>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setAnchorEl(null); setSessionsOpen(true) }}>
            <ListItemIcon><SecurityRounded fontSize="small" /></ListItemIcon>
            Active sessions
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
            Logout
          </MenuItem>
        </Menu>

        {adminSession && (
          <Alert
            severity="info"
            icon={<VisibilityRounded fontSize="small" />}
            sx={{ borderRadius: 0, bgcolor: 'warning.light' }}
            action={
              <Button color="inherit" size="small" onClick={handleExitImpersonation} sx={{ fontWeight: 700 }}>
                Exit to Platform Admin
              </Button>
            }
          >
            Viewing Dukani as <strong>{user?.business?.name ?? user?.name}</strong> — actions you take here affect their real data.
          </Alert>
        )}
        {user && !user.is_platform_admin && !user.email_verified_at && (
          <Alert
            severity="warning"
            sx={{ borderRadius: 0, py: { xs: 0, sm: 0.5 }, alignItems: 'center', '& .MuiAlert-message': { fontSize: { xs: 13, sm: 14 } } }}
            action={
              <Button color="inherit" size="small" loading={resendVerification.isPending} onClick={() => resendVerification.mutate()} sx={{ fontWeight: 700 }}>
                Resend
              </Button>
            }
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Please verify your email address ({user.email}) to secure your account.
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Please verify your email.
            </Box>
          </Alert>
        )}
        {!isPlatformAdmin && <TrialBanner />}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            width: '100%',
            p: { xs: 1.5, sm: 2.5, md: 4 },
            pb: showBottomNav ? 'calc(88px + env(safe-area-inset-bottom))' : undefined,
            overflowX: 'hidden',
          }}
        >
          {children}
        </Box>
      </Box>
      {showBottomNav && <MobileBottomNav pathname={location.pathname} onNavigate={go} onMore={() => setMobileOpen(true)} />}
      <SessionsDialog open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {!isPlatformAdmin && <CalculatorPanel />}
    </Box>
  )
}

