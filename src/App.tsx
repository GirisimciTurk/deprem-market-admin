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
const Orders = lazy(() => import('./pages/orders/Orders'))
const Returns = lazy(() => import('./pages/returns/Returns'))
const Customers = lazy(() => import('./pages/customers/Customers'))
const Blog = lazy(() => import('./pages/blog/Blog'))
const Categories = lazy(() => import('./pages/categories/Categories'))
const Resellers = lazy(() => import('./pages/resellers/Resellers'))
const HavarRequests = lazy(() => import('./pages/havar/HavarRequests'))
const Sellers = lazy(() => import('./pages/sellers/Sellers'))
const SellerDetail = lazy(() => import('./pages/sellers/SellerDetail'))
const SellerScorecards = lazy(() => import('./pages/seller-scorecards/SellerScorecards'))
const SellerCampaigns = lazy(() => import('./pages/seller-campaigns/SellerCampaigns'))
const CargoTariff = lazy(() => import('./pages/cargo-tariff/CargoTariff'))
const SellerContracts = lazy(() => import('./pages/seller-contracts/SellerContracts'))
const ProductApprovals = lazy(() => import('./pages/product-approvals/ProductApprovals'))
const CommissionRules = lazy(() => import('./pages/commission-rules/CommissionRules'))
const Invoices = lazy(() => import('./pages/invoices/Invoices'))
const Promotions = lazy(() => import('./pages/promotions/Promotions'))
const Reviews = lazy(() => import('./pages/reviews/Reviews'))
const SellerReviews = lazy(() => import('./pages/seller-reviews/SellerReviews'))
const Questions = lazy(() => import('./pages/questions/Questions'))
const SettingsPage = lazy(() => import('./pages/settings/Settings'))
const WarehouseInventory = lazy(() => import('./pages/inventory/WarehouseInventory'))
const StockMovements = lazy(() => import('./pages/stock-movements/StockMovements'))

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
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/returns" element={<Returns />} />
                    <Route path="/customers" element={<RoleGuard><Customers /></RoleGuard>} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/sellers" element={<RoleGuard><Sellers /></RoleGuard>} />
                    <Route path="/sellers/:id" element={<RoleGuard><SellerDetail /></RoleGuard>} />
                    <Route path="/seller-scorecards" element={<RoleGuard><SellerScorecards /></RoleGuard>} />
                    <Route path="/seller-campaigns" element={<RoleGuard><SellerCampaigns /></RoleGuard>} />
                    <Route path="/cargo-tariff" element={<RoleGuard><CargoTariff /></RoleGuard>} />
                    <Route path="/product-approvals" element={<RoleGuard><ProductApprovals /></RoleGuard>} />
                    <Route path="/categories" element={<RoleGuard><Categories /></RoleGuard>} />
                    <Route path="/commission-rules" element={<RoleGuard><CommissionRules /></RoleGuard>} />
                    <Route path="/invoices" element={<RoleGuard><Invoices /></RoleGuard>} />
                    <Route path="/resellers" element={<RoleGuard><Resellers /></RoleGuard>} />
                    <Route path="/havar-requests" element={<RoleGuard><HavarRequests /></RoleGuard>} />
                    <Route path="/promotions" element={<RoleGuard><Promotions /></RoleGuard>} />
                    <Route path="/reviews" element={<Reviews />} />
                    <Route path="/seller-reviews" element={<RoleGuard><SellerReviews /></RoleGuard>} />
                    <Route path="/product-questions" element={<RoleGuard><Questions /></RoleGuard>} />
                    <Route path="/seller-contracts" element={<RoleGuard><SellerContracts /></RoleGuard>} />
                    <Route path="/inventory" element={<WarehouseInventory />} />
                    <Route path="/stock-movements" element={<StockMovements />} />
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
