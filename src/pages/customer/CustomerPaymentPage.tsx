import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { checkoutOrders, type OrderPaymentMethod } from '../../api/orders';
import { useAuth } from '../../auth/AuthContext';
import { useCustomerCart } from './cartContext';
import { useCustomerDeliveryAddresses } from './customerDeliveryAddressesContext';

const DELIVERY_FEE = 40;
const FREE_ABOVE = 499;

type PayMethod = OrderPaymentMethod;

const OPTIONS: { id: PayMethod; icon: string; title: string; sub: string }[] = [
  { id: 'upi', icon: '⚡', title: 'UPI', sub: 'PhonePe, GPay, Paytm — mock' },
  { id: 'card', icon: '💳', title: 'Debit / credit card', sub: 'Saved cards later via API' },
  { id: 'wallet', icon: '👛', title: 'Wallet', sub: 'DukaanPro balance (demo)' },
  { id: 'cod', icon: '💵', title: 'Cash on delivery', sub: 'Pay when you receive' },
];

type PaymentLocationState = { deliveryAddressId?: string; demandInvitationId?: string };

export function CustomerPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { backendProfile } = useAuth();
  const { getSelectedSavedAddress } = useCustomerDeliveryAddresses();
  const { lines, subtotal, clearCart } = useCustomerCart();
  const [method, setMethod] = useState<PayMethod>('upi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fee = useMemo(() => (subtotal >= FREE_ABOVE ? 0 : DELIVERY_FEE), [subtotal]);
  const total = subtotal + fee;

  const locState = location.state as PaymentLocationState | null;
  const deliveryAddressId =
    locState?.deliveryAddressId ?? getSelectedSavedAddress()?.id ?? null;
  const demandInvitationId = locState?.demandInvitationId;

  async function placeOrder() {
    setError(null);
    const userId = backendProfile?.id;
    if (!userId) {
      setError('Your account is still syncing. Try again in a moment.');
      return;
    }
    if (!deliveryAddressId) {
      setError('No delivery address. Go back to checkout and save your address.');
      return;
    }
    const missingListing = lines.filter((l) => !l.shopProductId);
    if (missingListing.length > 0) {
      setError(
        'Some basket lines are from an older format. Clear the basket and add items again from the shop page.',
      );
      return;
    }
    setBusy(true);
    try {
      await checkoutOrders(userId, {
        deliveryAddressId,
        paymentMethod: method,
        items: lines.map((l) => ({
          shopProductId: l.shopProductId!,
          quantity: l.qty,
        })),
        ...(demandInvitationId ? { demandInvitationId } : {}),
      });
      clearCart();
      navigate('/app/customer', { replace: true, state: { orderPlaced: true } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place order');
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <>
        <h2 className="cust__pageTitle">Payment</h2>
        <p className="cust__sub">Nothing to pay for — your basket is empty.</p>
        <Link to="/app/customer" className="cust__btn cust__btn--primary cust__btn--block">
          Browse shops
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="cust__mockPill">Checkout API</span>
      <h2 className="cust__pageTitle">Payment</h2>
      <p className="cust__sub">
        Pick a method. Orders are created on the server (one order per shop if your basket has multiple shops).
        {demandInvitationId ? (
          <>
            {' '}
            This payment completes your <strong>quotation order</strong> and closes the request.
          </>
        ) : null}
      </p>

      {!deliveryAddressId ? (
        <p className="cust__sub" style={{ color: 'var(--cust-warn, #b45309)', marginBottom: '0.75rem' }}>
          Delivery address missing — use checkout first so we can save where to ship.
        </p>
      ) : null}

      {error ? (
        <p className="cust__sub" style={{ color: 'var(--cust-danger, #b91c1c)', marginBottom: '0.75rem' }}>
          {error}
        </p>
      ) : null}

      <div className="cust__panel" style={{ marginBottom: '1rem' }}>
        <div className="cust__summaryRow cust__summaryRow--total" style={{ border: 'none', margin: 0, padding: 0 }}>
          <span>Amount due (app estimate)</span>
          <span>₹{total}</span>
        </div>
        <p className="cust__sub" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
          Charged totals are computed on the server from live listing prices and delivery rules.
        </p>
      </div>

      <p className="cust__sectionLabel">Pay with</p>
      <div className="cust__payGrid">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`cust__payOption${method === o.id ? ' cust__payOption--selected' : ''}`}
            onClick={() => setMethod(o.id)}
          >
            <span className="cust__payIcon" aria-hidden>
              {o.icon}
            </span>
            <span>
              <p className="cust__payTitle">{o.title}</p>
              <p className="cust__paySub">{o.sub}</p>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="cust__btn cust__btn--primary cust__btn--block"
        style={{ marginTop: '1.25rem' }}
        disabled={busy || !deliveryAddressId}
        onClick={() => void placeOrder()}
      >
        {busy ? 'Placing order…' : method === 'cod' ? 'Place order (COD)' : 'Pay & place order'}
      </button>

      <Link to="/app/customer/checkout" className="cust__link" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
        ← Edit address or items
      </Link>
    </>
  );
}
