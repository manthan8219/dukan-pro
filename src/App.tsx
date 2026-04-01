import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isAbsoluteHttpUrl, urlForCustomerPath } from './config/appOrigins';
import { getAppSurface } from './config/appSurface';
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
import { BusinessImplicitSellerPage } from './pages/BusinessImplicitSellerPage';
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
import { ExternalRedirect } from './routes/ExternalRedirect';
import { RequireUser } from './routes/RequireUser';
function SubdomainCatchAll() {
  const location = useLocation();
  const surface = getAppSurface();
  const pathWithQuery = `${location.pathname}${location.search}`;
  if (surface === 'business' && location.pathname.startsWith('/app/customer')) {
    const href = urlForCustomerPath(pathWithQuery);
    if (isAbsoluteHttpUrl(href)) {
      return <ExternalRedirect href={href} />;
    }
  }
  /* Seller routes are not mounted on customer.* — stay on the buyer host instead of jumping to the hub. */
  if (
    surface === 'customer' &&
    (location.pathname.startsWith('/app/seller') || location.pathname.startsWith('/onboarding/seller'))
  ) {
    return <Navigate to="/app/customer" replace />;
  }
  return <Navigate to="/" replace />;
}

function customerRoutes() {
  return (
    <>
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
    </>
  );
}

function sellerRoutes() {
  return (
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
  );
}

function baseAuthRouteElements() {
  return [
    <Route key="login" path="/" element={<LoginPage />} />,
    <Route key="signup" path="/signup" element={<SignUpPage />} />,
    <Route key="scan" path="/scan" element={<BarcodeScanPage />} />,
  ];
}

function roleSelectRoute() {
  return (
    <Route
      key="role"
      path="/welcome/role"
      element={
        <RequireUser>
          <RoleSelectPage />
        </RequireUser>
      }
    />
  );
}

function businessImplicitSellerRoute() {
  return (
    <Route
      key="role"
      path="/welcome/role"
      element={
        <RequireUser>
          <BusinessImplicitSellerPage />
        </RequireUser>
      }
    />
  );
}

export function App() {
  const surface = getAppSurface();

  if (surface === 'business') {
    return (
      <Routes>
        {baseAuthRouteElements()}
        {businessImplicitSellerRoute()}
        <Route
          path="/onboarding/seller"
          element={
            <RequireUser>
              <SellerOnboardingPage />
            </RequireUser>
          }
        />
        {sellerRoutes()}
        <Route path="*" element={<SubdomainCatchAll />} />
      </Routes>
    );
  }

  if (surface === 'customer') {
    return (
      <Routes>
        {baseAuthRouteElements()}
        {roleSelectRoute()}
        {customerRoutes()}
        <Route path="*" element={<SubdomainCatchAll />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {baseAuthRouteElements()}
      {roleSelectRoute()}
      <Route
        path="/onboarding/seller"
        element={
          <RequireUser>
            <SellerOnboardingPage />
          </RequireUser>
        }
      />
      {customerRoutes()}
      {sellerRoutes()}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
