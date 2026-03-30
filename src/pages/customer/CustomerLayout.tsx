import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { BackendSession } from '../../api/authSync';
import { NotificationBell } from '../../components/NotificationBell';
import { useCustomerDemandAttentionCount } from '../../hooks/useCustomerDemandAttentionCount';
import { useAuth } from '../../auth/AuthContext';
import { CustomerDeliveryAddressesProvider, useCustomerDeliveryAddresses } from './customerDeliveryAddressesContext';
import { deliverySummaryLineFromSaved } from './customerDeliveryTypes';
import { CustomerCartProvider, useCustomerCart } from './cartContext';
import './customer-app.css';

function titleFromPath(pathname: string): string {
  if (pathname.includes('/checkout/payment')) return 'Payment';
  if (pathname.includes('/addresses')) return 'Addresses';
  if (pathname.includes('/checkout')) return 'Checkout';
  if (pathname.includes('/basket')) return 'Basket';
  if (pathname.includes('/profile')) return 'Profile';
  if (pathname.includes('/demands')) return 'Requests';
  if (pathname.includes('/shop/')) return 'Shop';
  return 'Nearby shops';
}

function HeaderCart() {
  const { itemCount } = useCustomerCart();
  return (
    <Link to="/app/customer/basket" className="cust__iconBtn" aria-label={`Basket, ${itemCount} items`}>
      🛒
      {itemCount > 0 ? <span className="cust__cartBadge">{itemCount > 99 ? '99+' : itemCount}</span> : null}
    </Link>
  );
}

function CustomerShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { backendProfile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const demandsRouteActive = location.pathname.includes('/app/customer/demands');
  const requestAttention = useCustomerDemandAttentionCount(
    backendProfile?.id ?? null,
    demandsRouteActive,
  );
  const pageTitle = useMemo(() => titleFromPath(location.pathname), [location.pathname]);
  const { getSelectedSavedAddress, loading: deliveryLoading } = useCustomerDeliveryAddresses();
  const selectedAddr = getSelectedSavedAddress();
  const deliveryLine = deliveryLoading
    ? 'Loading…'
    : selectedAddr
      ? deliverySummaryLineFromSaved(selectedAddr)
      : 'Add delivery address';

  return (
    <div className="cust">
      <header className="cust__header">
        <div className="cust__headerInner">
          <div className="cust__headerTop">
            <h1 className="cust__brand">DukaanPro</h1>
            <div className="cust__headerActions">
              {backendProfile?.id ? (
                <NotificationBell
                  userId={backendProfile.id}
                  types={['CUSTOMER_NEW_QUOTATION', 'CUSTOMER_ORDER_UPDATE']}
                  badgeCount={requestAttention}
                  variant="customer"
                />
              ) : null}
              <button
                type="button"
                className="cust__iconBtn cust__iconBtn--signOut"
                aria-label="Sign out"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await signOut();
                    navigate('/', { replace: true });
                  } finally {
                    setSigningOut(false);
                  }
                }}
              >
                <span aria-hidden>🚪</span>
              </button>
              <HeaderCart />
            </div>
          </div>
          <button
            type="button"
            className="cust__deliveryTap"
          onClick={() => navigate('/app/customer/addresses')}
          aria-label="Manage delivery addresses"
          >
            <span className="cust__deliveryIcon" aria-hidden>
              📍
            </span>
            <span className="cust__deliveryText">
              <span className="cust__deliveryLabel">Deliver to</span>
              <span className="cust__deliveryLine">{deliveryLine}</span>
            </span>
            <span className="cust__deliveryChev" aria-hidden>
              ›
            </span>
          </button>
          <p className="cust__pageCrumb">{pageTitle}</p>
        </div>
      </header>

      <main className="cust__main">{children}</main>

      <nav className="cust__tabbar" aria-label="Customer navigation">
        <div className="cust__tabbarInner">
        <NavLink
          to="/app/customer"
          end
          className={({ isActive }) => `cust__tab${isActive ? ' cust__tab--active' : ''}`}
        >
          <span className="cust__tabIcon" aria-hidden>
            🏪
          </span>
          Shops
        </NavLink>
        <NavLink
          to="/app/customer/demands"
          className={({ isActive }) => `cust__tab${isActive ? ' cust__tab--active' : ''}`}
        >
          <span className="cust__tabIconWrap">
            <span className="cust__tabIcon" aria-hidden>
              📋
            </span>
            {backendProfile?.id && requestAttention > 0 ? (
              <span className="cust__tabBadge" aria-hidden>
                {requestAttention > 99 ? '99+' : requestAttention}
              </span>
            ) : null}
          </span>
          Requests
        </NavLink>
        <NavLink
          to="/app/customer/basket"
          className={({ isActive }) => `cust__tab${isActive ? ' cust__tab--active' : ''}`}
        >
          <span className="cust__tabIcon" aria-hidden>
            🧺
          </span>
          Basket
        </NavLink>
        <NavLink
          to="/app/customer/profile"
          className={({ isActive }) => `cust__tab${isActive ? ' cust__tab--active' : ''}`}
        >
          <span className="cust__tabIcon" aria-hidden>
            👤
          </span>
          Profile
        </NavLink>
        </div>
      </nav>
    </div>
  );
}

/**
 * Wraps each customer route with auth, cart, and chrome. Flat routes avoid nested-Outlet issues
 * with some React Router 7 + BrowserRouter combinations (blank main area).
 */
function sellerPrimaryPath(profile: BackendSession): string {
  return profile.sellerOnboardingComplete ? '/app/seller' : '/onboarding/seller';
}

export function CustomerRouteShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, loading, firebaseConfigured, sessionSyncing, backendProfile } = useAuth();

  if (!firebaseConfigured) {
    return <Navigate to="/" replace state={{ from: location.pathname, needFirebase: true }} />;
  }

  // Only gate the shell until we have a backend profile once. Otherwise a second Firebase
  // auth tick or overlapping /auth/sync keeps sessionSyncing true and hides the whole app.
  if (loading || (user && sessionSyncing && !backendProfile)) {
    return (
      <div className="authWait">
        <div className="authWait__card" role="status" aria-live="polite">
          <div className="authWait__spinner" aria-hidden="true" />
          <p className="authWait__title">{user && sessionSyncing ? 'Syncing your account…' : 'Checking your session…'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (backendProfile?.role == null) {
    return <Navigate to="/welcome/role" replace />;
  }

  if (backendProfile?.role === 'SELLER') {
    return <Navigate to={sellerPrimaryPath(backendProfile)} replace />;
  }
  return (
    <CustomerCartProvider>
      <CustomerDeliveryAddressesProvider userId={backendProfile.id}>
        <CustomerShell>{children}</CustomerShell>
      </CustomerDeliveryAddressesProvider>
    </CustomerCartProvider>
  );
}
