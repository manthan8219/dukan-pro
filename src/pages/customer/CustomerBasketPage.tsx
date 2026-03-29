import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerCart } from './cartContext';

const DELIVERY_FEE = 40;
const FREE_ABOVE = 499;

export function CustomerBasketPage() {
  const { lines, subtotal, setQty, removeLine } = useCustomerCart();

  const fee = useMemo(() => (subtotal >= FREE_ABOVE ? 0 : DELIVERY_FEE), [subtotal]);
  const total = subtotal + fee;

  const byShop = useMemo(() => {
    const map = new Map<string, typeof lines>();
    for (const l of lines) {
      const cur = map.get(l.shopId) ?? [];
      cur.push(l);
      map.set(l.shopId, cur);
    }
    return map;
  }, [lines]);

  if (lines.length === 0) {
    return (
      <>
        <h2 className="cust__pageTitle">Basket</h2>
        <p className="cust__sub">Your basket is empty. Browse nearby shops and tap Add on items you need.</p>
        <Link to="/app/customer" className="cust__btn cust__btn--primary cust__btn--block">
          Find shops
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="cust__mockPill">Checkout is UI-only</span>
      <h2 className="cust__pageTitle">Basket</h2>
      <p className="cust__sub">Review quantities. Delivery fee is waived above ₹{FREE_ABOVE} in this sample.</p>

      {Array.from(byShop.entries()).map(([shopId, group]) => (
        <div key={shopId} className="cust__cartGroup">
          <h3 className="cust__cartGroupTitle">{group[0]?.shopName ?? 'Shop'}</h3>
          <div className="cust__panel" style={{ marginBottom: 0 }}>
            {group.map((l) => (
              <div key={`${l.shopId}-${l.productId}`} className="cust__cartLine">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="cust__cartLineTitle">{l.title}</p>
                  <p className="cust__cartLineMeta">
                    ₹{l.unitPrice} × {l.unit}
                  </p>
                </div>
                <div className="cust__qtyRow" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="cust__qtyBtn"
                    aria-label="Decrease"
                    onClick={() => setQty(l.shopId, l.productId, l.qty - 1)}
                  >
                    −
                  </button>
                  <span className="cust__qtyVal">{l.qty}</span>
                  <button
                    type="button"
                    className="cust__qtyBtn"
                    aria-label="Increase"
                    onClick={() => setQty(l.shopId, l.productId, l.qty + 1)}
                  >
                    +
                  </button>
                </div>
                <div style={{ textAlign: 'right', minWidth: '4.5rem' }}>
                  <p className="cust__price" style={{ margin: 0 }}>
                    ₹{l.unitPrice * l.qty}
                  </p>
                  <button
                    type="button"
                    className="cust__link"
                    style={{ fontSize: '0.72rem', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => removeLine(l.shopId, l.productId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="cust__panel">
        <div className="cust__summaryRow">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="cust__summaryRow">
          <span>Delivery</span>
          <span>{fee === 0 ? 'FREE' : `₹${fee}`}</span>
        </div>
        <div className="cust__summaryRow cust__summaryRow--total">
          <span>Total</span>
          <span>₹{total}</span>
        </div>
      </div>

      <Link to="/app/customer/checkout" className="cust__btn cust__btn--primary cust__btn--block">
        Continue to checkout
      </Link>
    </>
  );
}
