import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/RoleGuard'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/login/Login'
import ForgotPassword from './pages/login/ForgotPassword'
import ResetPassword from './pages/login/ResetPassword'
import Dashboard from './pages/dashboard/Dashboard'
import Products from './pages/products/Products'
import ProductEdit from './pages/products/ProductEdit'
import Orders from './pages/orders/Orders'
import Customers from './pages/customers/Customers'
import Blog from './pages/blog/Blog'
import Resellers from './pages/resellers/Resellers'
import Promotions from './pages/promotions/Promotions'
import Reviews from './pages/reviews/Reviews'
import SettingsPage from './pages/settings/Settings'
import WarehouseInventory from './pages/inventory/WarehouseInventory'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:id" element={<ProductEdit />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/customers" element={<RoleGuard><Customers /></RoleGuard>} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/resellers" element={<RoleGuard><Resellers /></RoleGuard>} />
                  <Route path="/promotions" element={<RoleGuard><Promotions /></RoleGuard>} />
                  <Route path="/reviews" element={<Reviews />} />
                  <Route path="/inventory" element={<WarehouseInventory />} />
                  <Route path="/settings" element={<RoleGuard><SettingsPage /></RoleGuard>} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}
