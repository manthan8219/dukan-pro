import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchShop } from '../../api/shop';
import { listShopProducts, type ShopProductListing } from '../../api/shopProducts';
import { useCustomerCart } from './cartContext';

function formatInrFromMinor(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function CustomerShopPage() {
  const { shopId } = useParams();
  const { lines, addItem, setQty } = useCustomerCart();
  const [shopName, setShopName] = useState<string | null>(null);
  const [listings, setListings] = useState<ShopProductListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [shop, products] = await Promise.all([
          fetchShop(shopId),
          listShopProducts(shopId, ac.signal, true),
        ]);
        if (ac.signal.aborted) return;
        setShopName(shop.displayName);
        setListings(products);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Could not load shop');
        setShopName(null);
        setListings([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [shopId]);

  if (!shopId) {
    return (
      <>
        <Link to="/app/customer" className="cust__back">
          ← Back to shops
        </Link>
        <p className="cust__empty">Invalid shop link.</p>
      </>
    );
  }

  const activeShopId = shopId;

  function qtyFor(productId: string) {
    return lines.find((l) => l.shopId === activeShopId && l.productId === productId)?.qty ?? 0;
  }

  if (loading) {
    return (
      <>
        <Link to="/app/customer" className="cust__back">
          ← Nearby shops
        </Link>
        <p className="cust__empty">Loading shop…</p>
      </>
    );
  }

  if (error || !shopName) {
    return (
      <>
        <Link to="/app/customer" className="cust__back">
          ← Back to shops
        </Link>
        <p className="cust__empty">{error ?? 'Shop not found.'}</p>
      </>
    );
  }

  return (
    <>
      <Link to="/app/customer" className="cust__back">
        ← Nearby shops
      </Link>
      <span className="cust__mockPill">Live menu</span>
      <h2 className="cust__pageTitle">{shopName}</h2>
      <p className="cust__sub">Prices and stock from this shop’s listing on the server.</p>

      <div className="cust__panel">
        {listings.length === 0 ? (
          <p className="cust__empty">No listed products in this shop yet.</p>
        ) : (
          listings.map((p) => {
            const q = qtyFor(p.productId);
            const unitPrice = p.priceMinor / 100;
            return (
              <div key={p.id} className="cust__product">
                <div>
                  {p.displayImageUrl ? (
                    <img
                      src={p.displayImageUrl}
                      alt=""
                      style={{
                        width: '3.25rem',
                        height: '3.25rem',
                        objectFit: 'cover',
                        borderRadius: 10,
                        marginBottom: '0.35rem',
                      }}
                    />
                  ) : null}
                  <p className="cust__productName">{p.productName}</p>
                  <p className="cust__productUnit">Per {p.unit}</p>
                  <p className="cust__price" style={{ marginTop: '0.35rem' }}>
                    {formatInrFromMinor(p.priceMinor)}
                  </p>
                </div>
                {q === 0 ? (
                  <button
                    type="button"
                    className="cust__btn cust__btn--primary cust__btn--sm"
                    onClick={() =>
                      addItem({
                        shopId: activeShopId,
                        shopName,
                        shopProductId: p.id,
                        productId: p.productId,
                        title: p.productName,
                        unitPrice,
                        unit: p.unit,
                        qty: 1,
                      })
                    }
                  >
                    Add
                  </button>
                ) : (
                  <div className="cust__qtyRow">
                    <button
                      type="button"
                      className="cust__qtyBtn"
                      aria-label="Decrease quantity"
                      onClick={() => setQty(activeShopId, p.productId, q - 1)}
                    >
                      −
                    </button>
                    <span className="cust__qtyVal">{q}</span>
                    <button
                      type="button"
                      className="cust__qtyBtn"
                      aria-label="Increase quantity"
                      onClick={() => setQty(activeShopId, p.productId, q + 1)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Link to="/app/customer/basket" className="cust__btn cust__btn--teal cust__btn--block" style={{ marginTop: '0.5rem' }}>
        View basket
      </Link>
    </>
  );
}
