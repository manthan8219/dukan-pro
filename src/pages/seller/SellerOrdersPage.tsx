import { useEffect, useState } from 'react';
import { listShopOrders, updateShopOrderStatus, type OrderDto, type OrderStatus } from '../../api/orders';
import { useAuth } from '../../auth/AuthContext';
import { getLastShopId } from '../../auth/session';

const STATUS_OPTIONS: OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

function formatInrMinor(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function SellerOrdersPage() {
  const { backendProfile } = useAuth();
  const shopId = getLastShopId();
  const ownerUserId = backendProfile?.id ?? null;
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerUserId || !shopId) {
      setLoading(false);
      setOrders([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const rows = await listShopOrders(ownerUserId, shopId);
        if (!cancelled) setOrders(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load orders');
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerUserId, shopId]);

  async function onStatusChange(orderId: string, status: OrderStatus) {
    if (!ownerUserId || !shopId) return;
    setUpdatingId(orderId);
    setError(null);
    try {
      const updated = await updateShopOrderStatus(ownerUserId, shopId, orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  }

  if (!shopId) {
    return (
      <div className="sdash__panel">
        <h2>Order desk</h2>
        <p>Open shop settings and finish onboarding so a shop is linked to this hub.</p>
      </div>
    );
  }

  return (
    <div className="sdash__panel">
      <h2>Order desk</h2>
      <p style={{ marginTop: '0.35rem', opacity: 0.9 }}>
        New customer checkouts appear here. Update status as you pack and deliver.
      </p>
      {error ? (
        <p style={{ color: '#b91c1c', marginTop: '0.75rem', fontWeight: 600 }}>{error}</p>
      ) : null}
      {loading ? (
        <p style={{ marginTop: '1rem' }}>Loading…</p>
      ) : orders.length === 0 ? (
        <p style={{ marginTop: '1rem', opacity: 0.85 }}>No orders yet.</p>
      ) : (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {orders.map((o) => (
            <div
              key={o.id}
              style={{
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 12,
                padding: '0.85rem 1rem',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong>{formatInrMinor(o.totalMinor)}</strong>
                  <span style={{ opacity: 0.8, marginLeft: '0.5rem', fontSize: '0.88rem' }}>
                    {new Date(o.createdAt).toLocaleString()}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                  Status
                  <select
                    value={o.status}
                    disabled={updatingId === o.id}
                    onChange={(e) => void onStatusChange(o.id, e.target.value as OrderStatus)}
                    style={{ padding: '0.25rem 0.5rem', borderRadius: 8 }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', fontSize: '0.88rem', lineHeight: 1.45 }}>
                {o.items.map((i) => (
                  <li key={i.id}>
                    {i.productNameSnapshot} × {i.quantity} — {formatInrMinor(i.lineTotalMinor)}
                  </li>
                ))}
              </ul>
              {o.paymentMethod ? (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', opacity: 0.75 }}>
                  Payment: {o.paymentMethod.toUpperCase()}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
