import {
  AdminPanelSettings,
  Assessment,
  Description,
  FactCheck,
  Groups,
  HistoryRounded,
  Inventory2,
  LocalShipping,
  Logout,
  Menu as MenuIcon,
  Notifications,
  PeopleAlt,
  PointOfSale,
  Receipt,
  ReceiptLong,
  SecurityRounded,
  Settings,
  Storefront,
  StorefrontRounded,
  SwapHoriz,
} from '@mui/icons-material'
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../../api/endpoints/auth'
import { notificationsApi } from '../../api/endpoints/notifications'
import { platformApi } from '../../api/endpoints/platform'
import { useAuthStore } from '../../stores/authStore'
import { useToastStore } from '../../stores/toastStore'
import { SessionsDialog } from '../common/SessionsDialog'

const DRAWER_WIDTH = 240

interface NavItem {
  label: string
  path: string
  icon: ReactNode
  permission?: string
  anyOf?: string[]
}

const PLATFORM_NAV_ITEMS: NavItem[] = [
  { label: 'Platform Admin', path: '/platform', icon: <AdminPanelSettings fontSize="small" /> },
]

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <Assessment fontSize="small" /> },
  { label: 'POS Checkout', path: '/pos', icon: <PointOfSale fontSize="small" />, permission: 'sales.create' },
  { label: 'Sales History', path: '/sales', icon: <Receipt fontSize="small" />, anyOf: ['sales.view.own', 'sales.view.all'] },
  { label: 'Customers', path: '/customers', icon: <Groups fontSize="small" />, permission: 'customers.manage' },
  { label: 'Quotations', path: '/quotations', icon: <Description fontSize="small" />, permission: 'quotations.manage' },
  { label: 'Products', path: '/products', icon: <Storefront fontSize="small" />, permission: 'products.manage' },
  { label: 'Inventory', path: '/inventory', icon: <Inventory2 fontSize="small" />, permission: 'inventory.view' },
  { label: 'Suppliers', path: '/suppliers', icon: <LocalShipping fontSize="small" />, permission: 'suppliers.manage' },
  { label: 'Purchases', path: '/purchases', icon: <FactCheck fontSize="small" />, permission: 'purchases.manage' },
  { label: 'Stock Transfers', path: '/stock-transfers', icon: <SwapHoriz fontSize="small" />, permission: 'stock_transfers.manage' },
  { label: 'Stock Taking', path: '/stock-takes', icon: <FactCheck fontSize="small" />, permission: 'stock_takes.manage' },
  { label: 'Expenses', path: '/expenses', icon: <ReceiptLong fontSize="small" />, anyOf: ['expenses.manage', 'expenses.view'] },
  { label: 'Staff', path: '/staff', icon: <PeopleAlt fontSize="small" />, permission: 'staff.manage' },
  { label: 'Roles & Permissions', path: '/roles', icon: <SecurityRounded fontSize="small" />, permission: 'roles.manage' },
  { label: 'Audit Log', path: '/audit-log', icon: <HistoryRounded fontSize="small" />, permission: 'roles.manage' },
  { label: 'Business Settings', path: '/settings', icon: <Settings fontSize="small" />, permission: 'business.settings.manage' },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user, hasPermission, clear } = useAuthStore()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)

  const isPlatformAdmin = !!user?.is_platform_admin

  const resendVerification = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => useToastStore.getState().show('Verification email sent.', 'success'),
  })

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

  const visibleItems = isPlatformAdmin
    ? PLATFORM_NAV_ITEMS
    : NAV_ITEMS.filter(
        (item) =>
          (!item.permission || hasPermission(item.permission)) &&
          (!item.anyOf || item.anyOf.some((p) => hasPermission(p))),
      )

  async function handleLogout() {
    try {
      await authApi.logout()
    } finally {
      clear()
      navigate('/login')
    }
  }

  const drawerContent = (
    <>
        <Toolbar sx={{ px: 2.5, gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.45)',
              flexShrink: 0,
            }}
          >
            <StorefrontRounded sx={{ color: '#052E20', fontSize: 20 }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              letterSpacing: 0.3,
              background: 'linear-gradient(90deg, #FFFFFF 0%, #A7F3D0 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Dukani
          </Typography>
        </Toolbar>
        <Divider sx={{ borderColor: 'rgba(52, 211, 153, 0.15)', mx: 2 }} />
        <List sx={{ px: 1.5, py: 1.5 }}>
          {visibleItems.map((item) => {
            const selected = location.pathname === item.path
            return (
              <ListItemButton
                key={item.path}
                selected={selected}
                onClick={() => navigate(item.path)}
                sx={{
                  position: 'relative',
                  borderRadius: 2,
                  mb: 0.5,
                  pl: 2,
                  color: 'rgba(209, 250, 229, 0.75)',
                  transition: 'background-color 0.18s ease, color 0.18s ease, transform 0.18s ease',
                  '& .MuiListItemIcon-root': { color: 'inherit', transition: 'color 0.18s ease' },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: 3,
                    borderRadius: 4,
                    backgroundColor: '#34D399',
                    opacity: 0,
                    transition: 'opacity 0.18s ease',
                  },
                  '&:hover': {
                    bgcolor: 'rgba(52, 211, 153, 0.12)',
                    color: '#F0FDF4',
                    transform: 'translateX(2px)',
                  },
                  '&.Mui-selected': {
                    bgcolor: 'rgba(16, 185, 129, 0.18)',
                    color: '#ECFDF5',
                    boxShadow: 'inset 0 0 0 1px rgba(52, 211, 153, 0.35)',
                  },
                  '&.Mui-selected::before': { opacity: 1 },
                  '&.Mui-selected .MuiListItemIcon-root': { color: '#34D399' },
                  '&.Mui-selected:hover': { bgcolor: 'rgba(16, 185, 129, 0.24)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { sx: { fontSize: 14, fontWeight: selected ? 700 : 500 } } }}
                />
              </ListItemButton>
            )
          })}
        </List>
    </>
  )

  const drawerPaperSx = {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box' as const,
    borderRight: 'none',
    background: 'linear-gradient(180deg, #0B3D2E 0%, #072A22 55%, #051F1A 100%)',
    color: '#ECFDF5',
    boxShadow: '4px 0 24px rgba(0, 0, 0, 0.25)',
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': drawerPaperSx,
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': drawerPaperSx,
        }}
      >
        {drawerContent}
      </Drawer>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: 'background.paper' }}
        >
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                onClick={() => setMobileOpen(true)}
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                aria-label="Open navigation"
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {isPlatformAdmin ? 'Platform Administration' : user?.business?.name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {user?.roles.map((role) => (
                <Chip key={role} label={role} size="small" variant="outlined" />
              ))}
              {(() => {
                const activeQuery = isPlatformAdmin ? platformNotificationsQuery : notificationsQuery
                const markRead = isPlatformAdmin ? platformApi.notifications.markRead : notificationsApi.markRead
                const queryKey = isPlatformAdmin ? ['platform-notifications'] : ['notifications']
                return (
                  <>
                    <IconButton onClick={(e) => setNotifAnchorEl(e.currentTarget)}>
                      <Badge badgeContent={activeQuery.data?.length ?? 0} color="error">
                        <Notifications fontSize="small" />
                      </Badge>
                    </IconButton>
                    <Menu anchorEl={notifAnchorEl} open={!!notifAnchorEl} onClose={() => setNotifAnchorEl(null)} slotProps={{ paper: { sx: { width: 340 } } }}>
                      {(activeQuery.data?.length ?? 0) === 0 && (
                        <MenuItem disabled sx={{ opacity: '1 !important' }}>
                          <Typography variant="body2" color="text.secondary">
                            No unread notifications
                          </Typography>
                        </MenuItem>
                      )}
                      {activeQuery.data?.map((n) => (
                        <MenuItem
                          key={n.id}
                          onClick={async () => {
                            await markRead(n.id)
                            queryClient.invalidateQueries({ queryKey })
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
                  </>
                )
              })()}
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{user?.name?.[0]?.toUpperCase()}</Avatar>
              </IconButton>
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
                <MenuItem
                  onClick={() => {
                    setAnchorEl(null)
                    setSessionsOpen(true)
                  }}
                >
                  <ListItemIcon>
                    <SecurityRounded fontSize="small" />
                  </ListItemIcon>
                  Active sessions
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <Logout fontSize="small" />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>
        {user && !user.is_platform_admin && !user.email_verified_at && (
          <Alert
            severity="warning"
            sx={{ borderRadius: 0 }}
            action={
              <Button color="inherit" size="small" loading={resendVerification.isPending} onClick={() => resendVerification.mutate()} sx={{ fontWeight: 700 }}>
                Resend email
              </Button>
            }
          >
            Please verify your email address ({user.email}) to secure your account.
          </Alert>
        )}
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          {children}
        </Box>
      </Box>
      <SessionsDialog open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </Box>
  )
}
