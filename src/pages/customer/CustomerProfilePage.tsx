import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listCustomerOrders, type OrderDto } from '../../api/orders';
import { useAuth } from '../../auth/AuthContext';
import { loadCustomerProfile, saveCustomerProfile } from './customerProfileStorage';
import { useCustomerDeliveryAddresses } from './customerDeliveryAddressesContext';
import { deliverySummaryLineFromSaved } from './customerDeliveryTypes';

function initials(name: string, fallback: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatInrMinor(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function CustomerProfilePage() {
  const navigate = useNavigate();
  const { user, signOut, backendProfile } = useAuth();
  const userId = user?.uid ?? null;
  const backendUserId = backendProfile?.id ?? null;
  const { getSelectedSavedAddress } = useCustomerDeliveryAddresses();
  const savedAddr = getSelectedSavedAddress();
  const [name, setName] = useState(() => loadCustomerProfile().displayName || user?.displayName || '');
  const [email, setEmail] = useState(() => loadCustomerProfile().email || user?.email || '');
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  function saveProfile() {
    saveCustomerProfile({ displayName: name.trim(), email: email.trim() });
  }

  useEffect(() => {
    if (!user) return;
    const saved = loadCustomerProfile();
    if (!saved.displayName.trim() && user.displayName) setName(user.displayName);
    if (!saved.email.trim() && user.email) setEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (!backendUserId) return;
    let cancelled = false;
    setOrdersLoading(true);
    setOrdersError(null);
    void (async () => {
      try {
        const rows = await listCustomerOrders(backendUserId);
        if (!cancelled) setOrders(rows);
      } catch (e) {
        if (!cancelled) {
          setOrdersError(e instanceof Error ? e.message : 'Failed to load orders');
          setOrders([]);
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendUserId]);

  const letter = initials(name, userId ?? 'Me');

  return (
    <>
      <span className="cust__mockPill">Local profile</span>
      <h2 className="cust__pageTitle">Profile</h2>
      <p className="cust__sub">
        You’re signed in with Google. Extra fields below are stored on this device for the UI until your API syncs.
      </p>

      <div className="cust__profileHead">
        <div className="cust__avatar" aria-hidden>
          {letter}
        </div>
        <div>
          <p className="cust__profileName">{name.trim() || 'Customer'}</p>
          <p className="cust__profileMeta">
            {user?.email ?? '—'}
            <br />
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>uid {userId ?? '—'}</span>
          </p>
        </div>
      </div>

      <div className="cust__panel">
        <label className="cust__label" htmlFor="pf-name">
          Display name
        </label>
        <input
          id="pf-name"
          className="cust__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="How sellers see you"
        />
        <label className="cust__label" htmlFor="pf-email">
          Email (optional)
        </label>
        <input
          id="pf-email"
          className="cust__input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <button type="button" className="cust__btn cust__btn--teal cust__btn--block" onClick={saveProfile}>
          Save profile
        </button>
      </div>

      <div className="cust__panel">
        <p className="cust__sectionLabel" style={{ marginBottom: '0.35rem' }}>
          Default delivery
        </p>
        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.45 }}>
          {savedAddr ? deliverySummaryLineFromSaved(savedAddr) : 'No address selected — add one from the address book.'}
        </p>
        <Link to="/app/customer/addresses" className="cust__link" style={{ marginTop: '0.65rem', display: 'inline-block' }}>
          Manage addresses →
        </Link>
      </div>

      <div className="cust__panel">
        <p className="cust__sectionLabel" style={{ marginBottom: '0.35rem' }}>
          Orders
        </p>
        {ordersLoading ? (
          <p className="cust__sub" style={{ margin: 0 }}>
            Loading orders…
          </p>
        ) : ordersError ? (
          <p className="cust__sub" style={{ margin: 0, color: 'var(--cust-danger, #b91c1c)' }}>
            {ordersError}
          </p>
        ) : orders.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--cust-muted)', fontWeight: 600 }}>
            No orders yet — browse shops and checkout to see them here.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {orders.map((o) => (
              <li
                key={o.id}
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  padding: '0.65rem 0.75rem',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                  {o.shopDisplayName ?? 'Shop'} · {o.status.replaceAll('_', ' ')}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', opacity: 0.85 }}>
                  {formatInrMinor(o.totalMinor)} · {new Date(o.createdAt).toLocaleString()}
                </p>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', lineHeight: 1.4 }}>
                  {o.items.map((i) => `${i.productNameSnapshot} × ${i.quantity}`).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cust__panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <Link to="/app/customer/demands" className="cust__btn cust__btn--ghost cust__btn--block" style={{ textAlign: 'center' }}>
          Request quotes from sellers
        </Link>
        <button
          type="button"
          className="cust__btn cust__btn--ghost cust__btn--block"
          onClick={async () => {
            await signOut();
            navigate('/', { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}
