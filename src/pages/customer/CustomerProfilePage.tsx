import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export function CustomerProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const userId = user?.uid ?? null;
  const { getSelectedSavedAddress } = useCustomerDeliveryAddresses();
  const savedAddr = getSelectedSavedAddress();
  const [name, setName] = useState(() => loadCustomerProfile().displayName || user?.displayName || '');
  const [email, setEmail] = useState(() => loadCustomerProfile().email || user?.email || '');

  function saveProfile() {
    saveCustomerProfile({ displayName: name.trim(), email: email.trim() });
  }

  useEffect(() => {
    if (!user) return;
    const saved = loadCustomerProfile();
    if (!saved.displayName.trim() && user.displayName) setName(user.displayName);
    if (!saved.email.trim() && user.email) setEmail(user.email);
  }, [user]);

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
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--cust-muted)', fontWeight: 600 }}>
          Past orders will list here after the API is connected.
        </p>
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
