import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { fetchDiscoverableShops, type ShopNearbySummary } from '../../api/shop';
import {
  FALLBACK_MAP_CENTER,
  getCachedDeviceCoordinates,
  requestDeviceCoordinates,
} from '../../geo/deviceLocation';
import { useCustomerCart } from './cartContext';
import { useCustomerDeliveryAddresses } from './customerDeliveryAddressesContext';
import { resolveAddressBookMapPin } from './customerDeliveryTypes';
import {
  DEFAULT_SHOP_FILTERS,
  type ShopCategory,
  type ShopFilters,
} from './customerMockData';

const CATEGORIES: { id: ShopCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'grocery', label: 'Grocery' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'bakery', label: 'Bakery' },
];

function shopInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'DP';
}

function dealInMatchesCategory(dealIn: string[], cat: ShopCategory | 'all'): boolean {
  if (cat === 'all') return true;
  const text = dealIn.join(' ').toLowerCase();
  if (cat === 'grocery') {
    return /groc|staple|rice|dal|kirana|provision|food|general|retail|wholesale|vegetable/.test(
      text,
    );
  }
  if (cat === 'dairy') return /dairy|milk|curd|paneer/.test(text);
  if (cat === 'pharmacy') return /pharm|med|drug|health|chemist/.test(text);
  if (cat === 'bakery') return /baker|bread|cake|biscuit/.test(text);
  return false;
}

function filterNearbyShops(shops: ShopNearbySummary[], f: ShopFilters): ShopNearbySummary[] {
  const q = f.query.trim().toLowerCase();
  return shops.filter((s) => {
    if (f.minRating != null) {
      if (s.averageRating == null || s.averageRating < f.minRating) return false;
    }
    if (f.maxDistanceKm != null && s.distanceKm > f.maxDistanceKm) return false;
    if (f.category !== 'all' && !dealInMatchesCategory(s.dealIn, f.category)) return false;
    if (q) {
      const hay =
        `${s.displayName} ${s.name} ${s.dealIn.join(' ')} ${s.addressText ?? ''} ${s.city ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function CustomerDiscoverPage() {
  const location = useLocation();
  const { user } = useAuth();
  const { book, loading: addressesLoading } = useCustomerDeliveryAddresses();
  const { subtotal } = useCustomerCart();
  const orderPlaced = (location.state as { orderPlaced?: boolean } | null)?.orderPlaced;
  const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? 'there';

  const savedDeliveryPin = useMemo(
    () => resolveAddressBookMapPin(book),
    [book.selectedId, book.addresses],
  );

  const [filters, setFilters] = useState<ShopFilters>({ ...DEFAULT_SHOP_FILTERS });
  const [shops, setShops] = useState<ShopNearbySummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const orderAmountRupees =
    subtotal > 0 ? Math.max(0, Math.round(Number(subtotal))) : undefined;

  useEffect(() => {
    if (addressesLoading) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError(null);
      setGeoHint(null);

      const finishGeo = (lat: number, lng: number, hint: string | null) => {
        if (hint !== null) setGeoHint(hint);
        void (async () => {
          if (cancelled) return;
          try {
            const rows = await fetchDiscoverableShops(
              lat,
              lng,
              ac.signal,
              orderAmountRupees,
            );
            if (cancelled || ac.signal.aborted) return;
            setShops(rows);
          } catch (e) {
            if (cancelled || ac.signal.aborted) return;
            setLoadError(e instanceof Error ? e.message : 'Could not load shops');
            setShops([]);
          } finally {
            if (!cancelled && !ac.signal.aborted) setLoading(false);
          }
        })();
      };

      if (savedDeliveryPin) {
        finishGeo(
          savedDeliveryPin.latitude,
          savedDeliveryPin.longitude,
          'Using your saved delivery map pin (Addresses). Set the pin on the map there so matches stay accurate.',
        );
        return;
      }

      const live = await requestDeviceCoordinates({ preferHighAccuracy: false });
      if (cancelled) return;
      if (live) {
        finishGeo(
          live.latitude,
          live.longitude,
          'Using this device location. Add a delivery address with a map pin to match where orders should arrive.',
        );
        return;
      }
      const cached = getCachedDeviceCoordinates();
      if (cached) {
        finishGeo(
          cached.latitude,
          cached.longitude,
          'Using a recent device location — allow location or set a delivery pin in Addresses for accuracy.',
        );
        return;
      }
      finishGeo(
        FALLBACK_MAP_CENTER.latitude,
        FALLBACK_MAP_CENTER.longitude,
        'No delivery pin or device location — showing a default area (Pune). Open Addresses to set where you receive orders.',
      );
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [addressesLoading, savedDeliveryPin, orderAmountRupees]);

  const filtered = useMemo(() => filterNearbyShops(shops, filters), [shops, filters]);

  const nearestKm = useMemo(
    () => (filtered.length ? Math.min(...filtered.map((s) => s.distanceKm)) : null),
    [filtered],
  );

  function toggleMax2km() {
    setFilters((f) => ({ ...f, maxDistanceKm: f.maxDistanceKm === 2 ? null : 2 }));
  }

  function toggleMin4star() {
    setFilters((f) => ({ ...f, minRating: f.minRating === 4 ? null : 4 }));
  }

  return (
    <>
      {orderPlaced ? (
        <div className="cust__bannerOk" role="status">
          Order placed (sample). Your cart was cleared — real tracking will show here after API integration.
        </div>
      ) : null}

      {geoHint ? <div className="cust__bannerNote" role="status">{geoHint}</div> : null}
      {loadError ? <div className="cust__bannerNote cust__bannerNote--err">{loadError}</div> : null}

      <section className="cust__discoverHero" aria-labelledby="discover-heading">
        <p className="cust__discoverKicker">Your neighbourhood</p>
        <h2 id="discover-heading" className="cust__discoverTitle">
          Hi {firstName} — what are we stocking today?
        </h2>
        <p className="cust__discoverLead">
          We list shops whose <strong>delivery radius</strong> reaches your point on the map:{' '}
          <strong>saved delivery pin</strong> first, then this device, then a fallback. Distance is straight-line (km);
          the server also uses your <strong>basket total</strong> when shops offer bigger radius for larger orders.
        </p>
        <div className="cust__statRow" role="list">
          <div className="cust__statCard" role="listitem">
            <span className="cust__statValue">{loading ? '…' : filtered.length}</span>
            <span className="cust__statLabel">Shops match</span>
          </div>
          <div className="cust__statCard" role="listitem">
            <span className="cust__statValue">{loading ? '…' : shops.length}</span>
            <span className="cust__statLabel">In delivery area</span>
          </div>
          <div className="cust__statCard" role="listitem">
            <span className="cust__statValue">
              {nearestKm != null ? `${nearestKm.toFixed(1)} km` : '—'}
            </span>
            <span className="cust__statLabel">Nearest (filtered)</span>
          </div>
        </div>
      </section>

      <div className="cust__spotlight">
        <p className="cust__sectionLabel">Quick picks</p>
        <div className="cust__spotlightTrack">
          <Link to="/app/customer/basket" className="cust__spotCard cust__spotCard--rose">
            <div className="cust__spotEmoji" aria-hidden>
              🧺
            </div>
            <p className="cust__spotTitle">Your basket</p>
            <p className="cust__spotSub">Review items &amp; fees before checkout.</p>
          </Link>
          <Link to="/app/customer/addresses" className="cust__spotCard cust__spotCard--teal">
            <div className="cust__spotEmoji" aria-hidden>
              📍
            </div>
            <p className="cust__spotTitle">Addresses</p>
            <p className="cust__spotSub">Home, Office, or custom tags — pick what delivers here.</p>
          </Link>
          <Link to="/app/customer/demands" className="cust__spotCard cust__spotCard--amber">
            <div className="cust__spotEmoji" aria-hidden>
              📋
            </div>
            <p className="cust__spotTitle">Post a request</p>
            <p className="cust__spotSub">Ask sellers for something specific.</p>
          </Link>
        </div>
      </div>

      <span className="cust__mockPill">Live catalog</span>
      <h2 className="cust__pageTitle">Nearby shops</h2>
      <p className="cust__sub">
        Search and filter below. Each shop sets a default radius and optional tiers (higher order → longer distance) on
        the server; we pass your basket subtotal so those tiers apply when relevant.
      </p>

      <input
        type="search"
        className="cust__search"
        placeholder="Search shops…"
        value={filters.query}
        onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        aria-label="Search shops"
      />

      <p className="cust__sectionLabel">Category</p>
      <div className="cust__chipRow">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cust__chip${filters.category === c.id ? ' cust__chip--on' : ''}`}
            onClick={() => setFilters((f) => ({ ...f, category: c.id }))}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="cust__sectionLabel">Quick filters</p>
      <div className="cust__chipRow">
        <button
          type="button"
          className={`cust__chip${filters.maxDistanceKm === 2 ? ' cust__chip--on' : ''}`}
          onClick={toggleMax2km}
        >
          Within 2 km
        </button>
        <button
          type="button"
          className={`cust__chip${filters.minRating === 4 ? ' cust__chip--on' : ''}`}
          onClick={toggleMin4star}
        >
          4★ &amp; up
        </button>
      </div>

      <p className="cust__sectionLabel">
        {loading ? 'Loading…' : `${filtered.length} shop${filtered.length === 1 ? '' : 's'}`}
      </p>
      <div className="cust__shopList">
        {loading ? (
          <p className="cust__empty">Finding shops that deliver to you…</p>
        ) : filtered.length === 0 ? (
          <p className="cust__empty">
            {shops.length === 0
              ? 'No shops in range — check location permission, or sellers may need to set pins and delivery radius.'
              : 'No shops match these filters. Try clearing search or filters.'}
          </p>
        ) : (
          filtered.map((s, i) => (
            <Link key={s.id} to={`/app/customer/shop/${s.id}`} className="cust__shopCard">
              <div className="cust__shopCardInner">
                <div
                  className={`cust__shopCardThumb cust__shopCardThumb--${i % 6}`}
                  aria-hidden
                >
                  <span>{shopInitials(s.displayName)}</span>
                </div>
                <div className="cust__shopCardBody">
                  <div className="cust__shopCardTop">
                    <div>
                      <h3 className="cust__shopName">{s.displayName}</h3>
                      <p className="cust__shopTag">
                        {[s.shopType, s.city].filter(Boolean).join(' · ') || 'Local shop'}
                      </p>
                    </div>
                    <span className="cust__pill cust__pill--open">Delivers here</span>
                  </div>
                  <div className="cust__shopMeta">
                    <span>
                      {s.averageRating != null ? (
                        <>
                          ★ <strong>{s.averageRating.toFixed(1)}</strong> ({s.ratingCount})
                        </>
                      ) : (
                        <span>New on DukaanPro</span>
                      )}
                    </span>
                    <span>
                      <strong>{s.distanceKm.toFixed(1)}</strong> km
                    </span>
                    <span>
                      Up to <strong>{s.effectiveMaxServiceRadiusKm.toFixed(1)}</strong> km radius
                    </span>
                    <span>{s.dealIn.slice(0, 4).join(' · ')}</span>
                  </div>
                  {s.addressText ? (
                    <p className="cust__shopTeaser">
                      <strong style={{ color: 'var(--cust-text)' }}>Area:</strong> {s.addressText}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
