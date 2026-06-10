import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/RoleGuard'
import AppLayout from './components/layout/AppLayout'
import { LoadingState } from './components/ui/Spinner'
// Login eager (giriş noktası); kimlik doğrulamalı sayfalar lazy (code-splitting).
import Login from './pages/login/Login'
import ForgotPassword from './pages/login/ForgotPassword'
import ResetPassword from './pages/login/ResetPassword'

// Route-level code splitting: her sayfa ayrı chunk → ilk yük küçülür, recharts
// (Dashboard) gibi ağır bağımlılıklar yalnızca o sayfaya girilince yüklenir.
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const Products = lazy(() => import('./pages/products/Products'))
const ProductEdit = lazy(() => import('./pages/products/ProductEdit'))
const Orders = lazy(() => import('./pages/orders/Orders'))
const Returns = lazy(() => import('./pages/returns/Returns'))
const Customers = lazy(() => import('./pages/customers/Customers'))
const Blog = lazy(() => import('./pages/blog/Blog'))
const Resellers = lazy(() => import('./pages/resellers/Resellers'))
const Promotions = lazy(() => import('./pages/promotions/Promotions'))
const Reviews = lazy(() => import('./pages/reviews/Reviews'))
const SettingsPage = lazy(() => import('./pages/settings/Settings'))
const WarehouseInventory = lazy(() => import('./pages/inventory/WarehouseInventory'))

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
            <Suspense fallback={<LoadingState label="Yükleniyor..." />}>
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
                    <Route path="/returns" element={<Returns />} />
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
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}
