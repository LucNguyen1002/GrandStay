import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { LandingPage } from './pages/LandingPage'
import { Loading } from './components/ui'
import { LockKeyhole } from 'lucide-react'
import { defaultAuthenticatedRoute } from './auth/routes'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const RoomsPage = lazy(() => import('./pages/RoomsPage').then(m => ({ default: m.RoomsPage })))
const BookingsPage = lazy(() => import('./pages/BookingsPage').then(m => ({ default: m.BookingsPage })))
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })))
const CatalogPage = lazy(() => import('./pages/CatalogPage').then(m => ({ default: m.CatalogPage })))
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })))
const CommercialPage = lazy(() => import('./pages/CommercialPage').then(m => ({ default: m.CommercialPage })))
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })))
const VnPayPaymentResultPage = lazy(() => import('./pages/VnPayPaymentResultPage').then(m => ({ default: m.VnPayPaymentResultPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })))
const AuditPage = lazy(() => import('./pages/AuditPage').then(m => ({ default: m.AuditPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

function Protected() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  return isAuthenticated ? <AppShell /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
}

function AuthenticatedFallback() {
  const { user } = useAuth()
  return <Navigate to={user ? defaultAuthenticatedRoute(user) : '/login'} replace />
}

function Authorized({ children, permission, role, anyPermissions = [], anyRoles = [] }: {
  children: React.ReactNode
  permission?: string
  role?: string
  anyPermissions?: string[]
  anyRoles?: string[]
}) {
  const { can, hasRole } = useAuth()
  const alternativeRequired = anyPermissions.length > 0 || anyRoles.length > 0
  const hasAlternative = anyPermissions.some(can) || anyRoles.some(hasRole)
  if ((permission && !can(permission)) || (role && !hasRole(role)) || (alternativeRequired && !hasAlternative)) {
    return <div className="mx-auto max-w-xl py-20 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><LockKeyhole size={24}/></div>
      <h1 className="mt-5 font-display text-2xl font-bold">Bạn chưa được cấp quyền</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">Tài khoản hiện tại không có quyền truy cập chức năng này. Hãy liên hệ quản trị viên nếu bạn cần sử dụng.</p>
    </div>
  }
  return children
}

export function App() {
  return <Suspense fallback={<Loading/>}><Routes>
    <Route index element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<Protected />}>
      <Route path="dashboard" element={<Authorized permission="report:read"><DashboardPage /></Authorized>} />
      <Route path="rooms" element={<Authorized permission="room:read"><RoomsPage /></Authorized>} />
      <Route path="bookings" element={<Authorized anyPermissions={['booking:read']} anyRoles={['CUSTOMER']}><BookingsPage /></Authorized>} />
      <Route path="customers" element={<Authorized permission="booking:read"><CustomersPage /></Authorized>} />
      <Route path="catalog" element={<Authorized permission="room:read"><CatalogPage /></Authorized>} />
      <Route path="services" element={<Authorized permission="service:read"><ServicesPage /></Authorized>} />
      <Route path="commercial" element={<Authorized permission="promotion:write"><CommercialPage /></Authorized>} />
      <Route path="billing" element={<Authorized permission="payment:read"><BillingPage /></Authorized>} />
      <Route path="payment/vnpay/result" element={<Authorized anyPermissions={['payment:read']} anyRoles={['CUSTOMER']}><VnPayPaymentResultPage /></Authorized>} />
      <Route path="reports" element={<Authorized permission="report:read"><ReportsPage /></Authorized>} />
      <Route path="users" element={<Authorized role="ADMIN"><UsersPage /></Authorized>} />
      <Route path="audit" element={<Authorized permission="audit:read"><AuditPage /></Authorized>} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<AuthenticatedFallback />} />
    </Route>
  </Routes></Suspense>
}
