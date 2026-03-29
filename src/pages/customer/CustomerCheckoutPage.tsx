import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCustomerDeliveryAddresses } from './customerDeliveryAddressesContext';
import type { DeliveryAddress, SavedAddress } from './customerDeliveryTypes';
import { useCustomerCart } from './cartContext';

export type CustomerCheckoutLocationState = {
  demandInvitationId?: string;
};

const DELIVERY_FEE = 40;
const FREE_ABOVE = 499;

function addressComplete(a: DeliveryAddress): boolean {
  return Boolean(
    a.fullName.trim() && a.phone.trim() && a.line1.trim() && a.city.trim() && a.pin.trim() && /^\d{6}$/.test(a.pin),
  );
}

function stripSaved(s: SavedAddress): DeliveryAddress {
  const { id: _i, tag: _t, label: _l, ...rest } = s;
  return rest;
}

export function CustomerCheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const demandInvitationId =
    (location.state as CustomerCheckoutLocationState | null)?.demandInvitationId ?? undefined;
  const { lines, subtotal } = useCustomerCart();
  const { book, updateSavedAddress, saveDeliveryAddress } = useCustomerDeliveryAddresses();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addr, setAddr] = useState<DeliveryAddress>({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    pin: '',
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    const sel = book.selectedId
      ? book.addresses.find((a) => a.id === book.selectedId)
      : book.addresses[0];
    if (sel) {
      setSelectedId(sel.id);
      setAddr(stripSaved(sel));
    }
  }, [book]);

  const fee = useMemo(() => (subtotal >= FREE_ABOVE ? 0 : DELIVERY_FEE), [subtotal]);
  const total = subtotal + fee;
  const canPay = lines.length > 0 && addressComplete(addr);

  function update<K extends keyof DeliveryAddress>(key: K, value: DeliveryAddress[K]) {
    setAddr((prev) => ({ ...prev, [key]: value }));
  }

  async function persistAndGoPayment() {
    let deliveryAddressId: string;
    if (selectedId) {
      await updateSavedAddress(selectedId, addr);
      deliveryAddressId = selectedId;
    } else {
      deliveryAddressId = await saveDeliveryAddress(addr);
    }
    navigate('/app/customer/checkout/payment', {
      state: {
        deliveryAddressId,
        ...(demandInvitationId ? { demandInvitationId } : {}),
      },
    });
  }

  if (lines.length === 0) {
    return (
      <>
        <h2 className="cust__pageTitle">Checkout</h2>
        <p className="cust__sub">Your basket is empty.</p>
        <Link to="/app/customer/basket" className="cust__btn cust__btn--ghost cust__btn--block">
          Back to basket
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="cust__mockPill">Sample checkout</span>
      {demandInvitationId ? (
        <p
          className="cust__sub"
          style={{
            marginBottom: '0.75rem',
            padding: '0.65rem 0.85rem',
            borderRadius: 10,
            background: 'rgba(13, 148, 136, 0.1)',
            border: '1px solid rgba(13, 148, 136, 0.25)',
          }}
        >
          You’re checking out from an <strong>accepted shop quotation</strong>. Your basket matches the quoted items —
          complete payment on the next step.
        </p>
      ) : null}
      <h2 className="cust__pageTitle">Delivery details</h2>
      <p className="cust__sub">
        Editing here updates your <strong>active</strong> saved address. Add Home, Office, or custom tags from the address
        book.
      </p>
      <p style={{ margin: '0 0 1rem' }}>
        <Link to="/app/customer/addresses" className="cust__link">
          Manage saved addresses
        </Link>
      </p>

      <div className="cust__panel">
        <label className="cust__label" htmlFor="cx-name">
          Full name
        </label>
        <input
          id="cx-name"
          className="cust__input"
          value={addr.fullName}
          onChange={(e) => update('fullName', e.target.value)}
          placeholder="Name on doorbell"
          autoComplete="name"
        />
        <label className="cust__label" htmlFor="cx-phone">
          Phone
        </label>
        <input
          id="cx-phone"
          className="cust__input"
          value={addr.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="10-digit mobile"
          inputMode="tel"
          autoComplete="tel"
        />
        <label className="cust__label" htmlFor="cx-line1">
          Flat / house &amp; street
        </label>
        <input
          id="cx-line1"
          className="cust__input"
          value={addr.line1}
          onChange={(e) => update('line1', e.target.value)}
          placeholder="e.g. 12th Main, 4th Cross"
          autoComplete="street-address"
        />
        <label className="cust__label" htmlFor="cx-line2">
          Area (optional)
        </label>
        <input
          id="cx-line2"
          className="cust__input"
          value={addr.line2}
          onChange={(e) => update('line2', e.target.value)}
          placeholder="Neighbourhood"
        />
        <label className="cust__label" htmlFor="cx-landmark">
          Landmark (optional)
        </label>
        <input
          id="cx-landmark"
          className="cust__input"
          value={addr.landmark}
          onChange={(e) => update('landmark', e.target.value)}
          placeholder="Near park / metro"
        />
        <div className="cust__row2">
          <div>
            <label className="cust__label" htmlFor="cx-city">
              City
            </label>
            <input
              id="cx-city"
              className="cust__input"
              value={addr.city}
              onChange={(e) => update('city', e.target.value)}
              autoComplete="address-level2"
            />
          </div>
          <div>
            <label className="cust__label" htmlFor="cx-pin">
              PIN
            </label>
            <input
              id="cx-pin"
              className="cust__input"
              value={addr.pin}
              onChange={(e) => update('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="postal-code"
            />
          </div>
        </div>
      </div>

      <div className="cust__panel">
        <p className="cust__sectionLabel" style={{ marginBottom: '0.5rem' }}>
          Order summary
        </p>
        <div className="cust__summaryRow">
          <span>Items ({lines.reduce((s, l) => s + l.qty, 0)})</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="cust__summaryRow">
          <span>Delivery</span>
          <span>{fee === 0 ? 'FREE' : `₹${fee}`}</span>
        </div>
        <div className="cust__summaryRow cust__summaryRow--total">
          <span>Payable</span>
          <span>₹{total}</span>
        </div>
      </div>

      <button
        type="button"
        className="cust__btn cust__btn--primary cust__btn--block"
        disabled={!canPay}
        onClick={() => void persistAndGoPayment()}
      >
        Choose payment
      </button>
      {!addressComplete(addr) ? (
        <p className="cust__sub" style={{ marginTop: '0.65rem', textAlign: 'center' }}>
          Fill name, phone, address line, city, and a 6-digit PIN to continue.
        </p>
      ) : null}
    </>
  );
}
