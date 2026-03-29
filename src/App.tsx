import { Navigate, Route, Routes } from 'react-router-dom';
import { CustomerBasketPage } from './pages/customer/CustomerBasketPage';
import { CustomerAddressesPage } from './pages/customer/CustomerAddressesPage';
import { CustomerCheckoutPage } from './pages/customer/CustomerCheckoutPage';
import { CustomerDiscoverPage } from './pages/customer/CustomerDiscoverPage';
import { CustomerPaymentPage } from './pages/customer/CustomerPaymentPage';
import { CustomerProfilePage } from './pages/customer/CustomerProfilePage';
import { CustomerRouteShell } from './pages/customer/CustomerLayout';
import { CustomerShopPage } from './pages/customer/CustomerShopPage';
import { CustomerDemandsPage } from './pages/CustomerDemandsPage';
import { LoginPage } from './pages/LoginPage';
import { RoleSelectPage } from './pages/RoleSelectPage';
import { SellerBillingPage } from './pages/seller/SellerBillingPage';
import { SellerDemandBoardPage } from './pages/seller/SellerDemandBoardPage';
import { SellerDashboardHome } from './pages/seller/SellerDashboardHome';
import { SellerInventoryPage } from './pages/seller/SellerInventoryPage';
import { SellerLayout } from './pages/seller/SellerLayout';
import { SellerOrdersPage } from './pages/seller/SellerOrdersPage';
import { SellerShopSettingsPage } from './pages/seller/SellerShopSettingsPage';
import { SellerOnboardingPage } from './pages/SellerOnboardingPage';
import { BarcodeScanPage } from './pages/BarcodeScanPage';
import { SignUpPage } from './pages/SignUpPage';
import { RequireUser } from './routes/RequireUser';

export function App() {
  return (
    <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/scan" element={<BarcodeScanPage />} />
        <Route
          path="/welcome/role"
          element={
            <RequireUser>
              <RoleSelectPage />
            </RequireUser>
          }
        />
        <Route
          path="/onboarding/seller"
          element={
            <RequireUser>
              <SellerOnboardingPage />
            </RequireUser>
          }
        />
        <Route
          path="/app/customer/checkout/payment"
          element={
            <CustomerRouteShell>
              <CustomerPaymentPage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/customer/checkout"
          element={
            <CustomerRouteShell>
              <CustomerCheckoutPage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/customer/addresses"
          element={
            <CustomerRouteShell>
              <CustomerAddressesPage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/customer/shop/:shopId"
          element={
            <CustomerRouteShell>
              <CustomerShopPage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/customer/basket"
          element={
            <CustomerRouteShell>
              <CustomerBasketPage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/customer/demands"
          element={
            <CustomerRouteShell>
              <CustomerDemandsPage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/customer/profile"
          element={
            <CustomerRouteShell>
              <CustomerProfilePage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/customer"
          element={
            <CustomerRouteShell>
              <CustomerDiscoverPage />
            </CustomerRouteShell>
          }
        />
        <Route
          path="/app/seller"
          element={
            <RequireUser>
              <SellerLayout />
            </RequireUser>
          }
        >
          <Route index element={<SellerDashboardHome />} />
          <Route path="billing" element={<SellerBillingPage />} />
          <Route path="orders" element={<SellerOrdersPage />} />
          <Route path="inventory" element={<SellerInventoryPage />} />
          <Route path="shop" element={<SellerShopSettingsPage />} />
          <Route path="demands" element={<SellerDemandBoardPage />} />
        </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
