import confetti from 'canvas-confetti';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from '../../components/NotificationBell';
import { useSellerNotificationCounts } from '../../hooks/useSellerNotificationCounts';
import { useAuth } from '../../auth/AuthContext';
import { getLastShopId, isSellerOnboardingComplete, setSellerOnboardingComplete } from '../../auth/session';
import './seller-dashboard.css';

export type SellerOutletContext = { shopId: string | null };

type SellerLocationState = { launched?: boolean; tierWarning?: string };

let launchCelebrationLock = false;

const NAV = [
  {
    to: '/app/seller',
    end: true,
    icon: '📊',
    label: 'Dashboard',
    caption: 'Overview & pulse',
  },
  {
    to: '/app/seller/billing',
    icon: '💳',
    label: 'Billing & payouts',
    caption: 'Invoices, GST, settlements',
  },
  {
    to: '/app/seller/orders',
    icon: '📦',
    label: 'Order desk',
    caption: 'Incoming & in progress',
  },
  {
    to: '/app/seller/inventory',
    icon: '📋',
    label: 'Stock & catalog',
    caption: 'Products & quantities',
  },
  {
    to: '/app/seller/demands',
    icon: '🎯',
    label: 'Demand board',
    caption: 'Buyer requests & bids',
  },
  {
    to: '/app/seller/shop',
    icon: '⚙️',
    label: 'Shop settings',
    caption: 'Name, pin & delivery',
  },
] as const;

function titleFromPath(pathname: string): string {
  if (pathname.includes('/billing')) return 'Billing & payouts';
  if (pathname.includes('/orders')) return 'Order desk';
  if (pathname.includes('/inventory')) return 'Stock & catalog';
  if (pathname.includes('/demands')) return 'Demand board';
  if (pathname.includes('/shop')) return 'Shop settings';
  return 'Dashboard';
}

export function SellerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, backendProfile, sessionSyncing } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const shopId = getLastShopId();
  const onboardingDone = isSellerOnboardingComplete();
  const sellerUserId = backendProfile?.id ?? null;
  const { demandInvitesUnread: pendingDemandInvites, sellerHubUnread } =
    useSellerNotificationCounts(sellerUserId);
  const pageTitle = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  const tierWarning = (location.state as SellerLocationState | null)?.tierWarning;

  useEffect(() => {
    if (getLastShopId() && !isSellerOnboardingComplete()) {
      setSellerOnboardingComplete();
    }
  }, []);

  useEffect(() => {
    if (sessionSyncing) return;
    if (!backendProfile) {
      navigate('/welcome/role', { replace: true });
      return;
    }
    if (backendProfile.role === 'PENDING') {
      navigate('/welcome/role', { replace: true });
      return;
    }
    if (backendProfile.role !== 'SELLER') {
      navigate('/app/customer', { replace: true });
    }
  }, [sessionSyncing, backendProfile, navigate]);

  useEffect(() => {
    const state = location.state as SellerLocationState | null;
    if (!state?.launched) return;
    if (launchCelebrationLock) return;
    launchCelebrationLock = true;

    const tw = state.tierWarning;
    navigate('.', { replace: true, state: tw ? { tierWarning: tw } : {} });

    window.setTimeout(() => {
      void confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.62 },
        colors: ['#14b8a6', '#5eead4', '#99f6e4', '#ffffff'],
      });
    }, 80);
    window.setTimeout(() => {
      void confetti({
        particleCount: 70,
        spread: 100,
        origin: { x: 0.2, y: 0.55 },
        startVelocity: 32,
        colors: ['#fcd34d', '#fbbf24', '#5eead4', '#a78bfa'],
      });
    }, 280);
    window.setTimeout(() => {
      void confetti({
        particleCount: 55,
        spread: 120,
        origin: { x: 0.82, y: 0.58 },
        startVelocity: 28,
        colors: ['#2dd4bf', '#0d9488', '#ecfdf5'],
      });
    }, 450);
    window.setTimeout(() => {
      launchCelebrationLock = false;
    }, 4000);
  }, [location.state, navigate]);

  return (
    <div className={`sdash ${navOpen ? 'sdash--navOpen' : ''}`}>
      <button
        type="button"
        className="sdash__overlay"
        aria-label="Close menu"
        onClick={() => setNavOpen(false)}
      />

      <aside className="sdash__sidebar" aria-label="Seller navigation">
        <div className="sdash__brand">
          <span className="sdash__logo">D</span>
          <div>
            <span className="sdash__brandText">DukaanPro</span>
            <span className="sdash__brandSub">Seller hub</span>
          </div>
        </div>

        <nav className="sdash__nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `sdash__navLink ${isActive ? 'sdash__navLink--active' : ''}`
              }
              onClick={() => setNavOpen(false)}
            >
              <span className="sdash__navIconCell">
                <span className="sdash__navIcon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.to === '/app/seller/demands' && pendingDemandInvites > 0 ? (
                  <span className="sdash__navBadge" aria-hidden="true">
                    {pendingDemandInvites > 99 ? '99+' : pendingDemandInvites}
                  </span>
                ) : null}
              </span>
              <span>
                {item.label}
                <span className="sdash__navMeta">{item.caption}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sdash__footer">
          {!(onboardingDone && shopId) ? (
            <NavLink className="sdash__footerLink" to="/onboarding/seller" onClick={() => setNavOpen(false)}>
              Shop setup wizard
            </NavLink>
          ) : null}
          <button
            type="button"
            className="sdash__footerLink"
            style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={async () => {
              setNavOpen(false);
              await signOut();
              navigate('/', { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="sdash__main">
        <header className="sdash__topbar">
          <button
            type="button"
            className="sdash__menuBtn"
            aria-expanded={navOpen}
            aria-label="Open menu"
            onClick={() => setNavOpen((o) => !o)}
          >
            ☰
          </button>
          <h1 className="sdash__pageTitle">{pageTitle}</h1>
          {sellerUserId ? (
            <NotificationBell
              userId={sellerUserId}
              types={[
                'INVITATION',
                'SELLER_DEMAND_INVITATION',
                'SELLER_NEW_ORDER',
                'SELLER_MONTHLY_INSIGHTS',
              ]}
              badgeCount={sellerHubUnread}
              variant="seller"
              onPopoverOpen={() => setNavOpen(false)}
            />
          ) : null}
        </header>

        <main className="sdash__content">
          {tierWarning ? (
            <div className="sdash__alert" role="status">
              {tierWarning}
            </div>
          ) : null}
          <Outlet context={{ shopId }} />
        </main>
      </div>
    </div>
  );
}
