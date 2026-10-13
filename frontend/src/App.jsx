import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import Header from './components/common/Header';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';
import ConflictDialog from './components/common/ConflictDialog';

// Pages
import HomePage from './pages/HomePage';
import ShopListPage from './pages/ShopListPage';
import ShopDetailPage from './pages/ShopDetailPage';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import AddressesPage from './pages/AddressesPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentPage from './pages/PaymentPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import TrackingPage from './pages/TrackingPage';
import SupportPage from './pages/SupportPage';
import TicketDetailPage from './pages/TicketDetailPage';
import SellerRegisterPage from './pages/SellerRegisterPage';
import SellerVerificationPage from './pages/SellerVerificationPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import AdminSellersPage from './pages/AdminSellersPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Header />
            <ConflictDialog />
            <main style={{ flex: 1 }}>
              <Routes>
                {/* Public Browsing Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/shops" element={<ShopListPage />} />
                <Route path="/shops/:shopId" element={<ShopDetailPage />} />
                <Route path="/login" element={<AuthPage initialMode="login" />} />
                <Route path="/register" element={<AuthPage initialMode="register" />} />
                <Route path="/seller/register" element={<SellerRegisterPage />} />
                <Route path="/cart" element={<CartPage />} />

                {/* Seller Management Routes */}
                <Route
                  path="/seller/verification"
                  element={
                    <ProtectedRoute requiredRoles={['SELLER']}>
                      <SellerVerificationPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seller/dashboard"
                  element={
                    <ProtectedRoute requiredRoles={['SELLER']}>
                      <SellerDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Super Admin Control Center Route */}
                <Route
                  path="/super-admin/dashboard"
                  element={
                    <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
                      <SuperAdminDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/superadmin" element={<Navigate to="/super-admin/dashboard" replace />} />
                <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                {/* Admin Operations Dashboard Route */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Management Routes */}
                <Route
                  path="/admin/sellers"
                  element={
                    <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                      <AdminSellersPage />
                    </ProtectedRoute>
                  }
                />

                {/* Protected Customer Routes */}
                <Route
                  path="/addresses"
                  element={
                    <ProtectedRoute>
                      <AddressesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:orderId/pay"
                  element={
                    <ProtectedRoute>
                      <PaymentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:orderId/success"
                  element={
                    <ProtectedRoute>
                      <OrderSuccessPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute>
                      <OrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:orderId"
                  element={
                    <ProtectedRoute>
                      <OrderDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:orderId/track"
                  element={
                    <ProtectedRoute>
                      <TrackingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:orderId/tracking"
                  element={
                    <ProtectedRoute>
                      <TrackingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/support"
                  element={
                    <ProtectedRoute>
                      <SupportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/support/:ticketId"
                  element={
                    <ProtectedRoute>
                      <TicketDetailPage />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
