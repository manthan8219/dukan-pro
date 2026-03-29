import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerCart } from './cartContext';

const DELIVERY_FEE = 40;
const FREE_ABOVE = 499;

type PayMethod = 'upi' | 'card' | 'cod' | 'wallet';

const OPTIONS: { id: PayMethod; icon: string; title: string; sub: string }[] = [
  { id: 'upi', icon: '⚡', title: 'UPI', sub: 'PhonePe, GPay, Paytm — mock' },
  { id: 'card', icon: '💳', title: 'Debit / credit card', sub: 'Saved cards later via API' },
  { id: 'wallet', icon: '👛', title: 'Wallet', sub: 'DukaanPro balance (demo)' },
  { id: 'cod', icon: '💵', title: 'Cash on delivery', sub: 'Pay when you receive' },
];

export function CustomerPaymentPage() {
  const navigate = useNavigate();
  const { lines, subtotal, clearCart } = useCustomerCart();
  const [method, setMethod] = useState<PayMethod>('upi');
  const [busy, setBusy] = useState(false);

  const fee = useMemo(() => (subtotal >= FREE_ABOVE ? 0 : DELIVERY_FEE), [subtotal]);
  const total = subtotal + fee;

  function placeOrder() {
    setBusy(true);
    window.setTimeout(() => {
      clearCart();
      setBusy(false);
      navigate('/app/customer', { replace: true, state: { orderPlaced: true } });
    }, method === 'cod' ? 400 : 900);
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
      <span className="cust__mockPill">No real charges</span>
      <h2 className="cust__pageTitle">Payment</h2>
      <p className="cust__sub">Pick a method. This only clears the demo cart — no gateway yet.</p>

      <div className="cust__panel" style={{ marginBottom: '1rem' }}>
        <div className="cust__summaryRow cust__summaryRow--total" style={{ border: 'none', margin: 0, padding: 0 }}>
          <span>Amount due</span>
          <span>₹{total}</span>
        </div>
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
        disabled={busy}
        onClick={placeOrder}
      >
        {busy ? 'Placing order…' : method === 'cod' ? 'Place order (COD)' : 'Pay & place order'}
      </button>

      <Link to="/app/customer/checkout" className="cust__link" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
        ← Edit address or items
      </Link>
    </>
  );
}
