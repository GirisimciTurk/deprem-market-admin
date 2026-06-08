import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/dashboard/Dashboard'
import Products from './pages/products/Products'
import Orders from './pages/orders/Orders'
import Customers from './pages/customers/Customers'
import Blog from './pages/blog/Blog'
import Resellers from './pages/resellers/Resellers'
import Reviews from './pages/reviews/Reviews'
import SettingsPage from './pages/settings/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/resellers" element={<Resellers />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
