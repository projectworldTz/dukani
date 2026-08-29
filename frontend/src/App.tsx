import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { ToastHost } from './components/common/ToastHost'
import { AppLayout } from './components/layout/AppLayout'
import { AuditLogPage } from './pages/audit/AuditLogPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { CustomersPage } from './pages/customers/CustomersPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { ExpensesPage } from './pages/expenses/ExpensesPage'
import { InventoryPage } from './pages/products/InventoryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PosCheckoutPage } from './pages/pos/PosCheckoutPage'
import { ProductsPage } from './pages/products/ProductsPage'
import { PurchasesPage } from './pages/purchasing/PurchasesPage'
import { StockTakesPage } from './pages/purchasing/StockTakesPage'
import { StockTransfersPage } from './pages/purchasing/StockTransfersPage'
import { SuppliersPage } from './pages/purchasing/SuppliersPage'
import { LandingPage } from './pages/marketing/LandingPage'
import { PlatformAdminPage } from './pages/platform/PlatformAdminPage'
import { QuotationsPage } from './pages/quotations/QuotationsPage'
import { RolesPage } from './pages/roles/RolesPage'
import { SalesHistoryPage } from './pages/sales/SalesHistoryPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { StaffPage } from './pages/staff/StaffPage'
import { useAuthStore } from './stores/authStore'

function Shell({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}

/** What an authenticated visitor sees at "/" — mirrors what ProtectedRoute would do,
 * since "/" is handled outside that generic group so a logged-out visitor can see
 * LandingPage here instead of being bounced straight to /login. */
function Home() {
  const isPlatformAdmin = useAuthStore((s) => !!s.user?.is_platform_admin)

  if (isPlatformAdmin) return <Navigate to="/platform" replace />

  return (
    <Shell>
      <DashboardPage />
    </Shell>
  )
}

export default function App() {
  const token = useAuthStore((s) => s.token)

  return (
    <BrowserRouter>
      <ToastHost />
      <Routes>
        <Route path="/" element={token ? <Home /> : <LandingPage />} />
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={token ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={token ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={token ? <Navigate to="/" replace /> : <ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedRoute platformOnly />}>
          <Route path="/platform" element={<Shell><PlatformAdminPage /></Shell>} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedRoute permission="sales.create" />}>
            <Route path="/pos" element={<Shell><PosCheckoutPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="products.manage" />}>
            <Route path="/products" element={<Shell><ProductsPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="inventory.view" />}>
            <Route path="/inventory" element={<Shell><InventoryPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="suppliers.manage" />}>
            <Route path="/suppliers" element={<Shell><SuppliersPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="purchases.manage" />}>
            <Route path="/purchases" element={<Shell><PurchasesPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="stock_transfers.manage" />}>
            <Route path="/stock-transfers" element={<Shell><StockTransfersPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="stock_takes.manage" />}>
            <Route path="/stock-takes" element={<Shell><StockTakesPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute anyOf={['sales.view.own', 'sales.view.all']} />}>
            <Route path="/sales" element={<Shell><SalesHistoryPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="customers.manage" />}>
            <Route path="/customers" element={<Shell><CustomersPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="quotations.manage" />}>
            <Route path="/quotations" element={<Shell><QuotationsPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute anyOf={['expenses.manage', 'expenses.view']} />}>
            <Route path="/expenses" element={<Shell><ExpensesPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="staff.manage" />}>
            <Route path="/staff" element={<Shell><StaffPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="roles.manage" />}>
            <Route path="/roles" element={<Shell><RolesPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="business.settings.manage" />}>
            <Route path="/settings" element={<Shell><SettingsPage /></Shell>} />
          </Route>
          <Route element={<ProtectedRoute permission="roles.manage" />}>
            <Route path="/audit-log" element={<Shell><AuditLogPage /></Shell>} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
