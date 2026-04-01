import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  createDeliveryRadiusRule,
  deleteDeliveryRadiusRule,
  fetchDeliveryRadiusRules,
  updateDeliveryRadiusRule,
  type ShopDeliveryRadiusRule,
} from '../../api/deliveryRadiusRule';
import { fetchShop, updateShop } from '../../api/shop';
import { GoogleMapsEmbedMapPicker } from '../../components/GoogleMapsEmbedMapPicker';
import { MapPinAddressSelect } from '../../components/map/MapPinAddressSelect';
import {
  FALLBACK_MAP_CENTER,
  rememberDeviceCoordinates,
  resolveDefaultMapCoordinates,
} from '../../geo/deviceLocation';
import type { MapLocateEvent } from '../../components/map';
import type { SellerOutletContext } from './SellerLayout';
import './seller-shop-settings.css';

const PRODUCT_PRESETS = [
  'Groceries',
  'Staples & grains',
  'Dairy & eggs',
  'Fresh produce',
  'Beverages',
  'Snacks & packaged',
  'Household',
  'Personal care',
  'Electronics',
  'Fashion & apparel',
  'Pharmacy',
  'Hardware & tools',
  'Gifts & stationery',
];

const MAX_RADIUS_TIERS = 5;

type RadiusTierRow = {
  clientKey: string;
  ruleId?: string;
  minRupee: string;
  maxKm: string;
};

function rulesToTierRows(rules: ShopDeliveryRadiusRule[]): RadiusTierRow[] {
  return rules.map((r) => ({
    clientKey: r.id,
    ruleId: r.id,
    minRupee: trimMoneyDisplay(r.minOrderAmount),
    maxKm: String(r.maxServiceRadiusKm),
  }));
}

function trimMoneyDisplay(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : '';
}

export function SellerShopSettingsPage() {
  const { shopId } = useOutletContext<SellerOutletContext>();
  const nameId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [billingName, setBillingName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [latitude, setLatitude] = useState(FALLBACK_MAP_CENTER.latitude);
  const [longitude, setLongitude] = useState(FALLBACK_MAP_CENTER.longitude);
  const skipAccuracyResetCountRef = useRef(0);
  const [shopType, setShopType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [dealIn, setDealIn] = useState<Set<string>>(() => new Set());
  const [serviceRadiusKm, setServiceRadiusKm] = useState(8);
  const [radiusTiers, setRadiusTiers] = useState<RadiusTierRow[]>([]);
  const [ruleIdsToDelete, setRuleIdsToDelete] = useState<Set<string>>(() => new Set());

  const onMapCenterChange = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    if (skipAccuracyResetCountRef.current > 0) {
      skipAccuracyResetCountRef.current -= 1;
      return;
    }
  }, []);

  const onShopMapDeviceLocation = useCallback((ev: MapLocateEvent) => {
    if (ev.kind !== 'success') return;
    skipAccuracyResetCountRef.current = 4;
    setLatitude(ev.latitude);
    setLongitude(ev.longitude);
    rememberDeviceCoordinates(ev.latitude, ev.longitude);
  }, []);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([fetchShop(shopId), fetchDeliveryRadiusRules(shopId)])
      .then(([shop, rules]) => {
        if (cancelled) return;
        setName(shop.name);
        setDisplayName(shop.displayName);
        setBillingName(shop.billingName);
        setAddressText(shop.location.addressText ?? '');
        const lat = shop.location.coordinates.latitude;
        const lng = shop.location.coordinates.longitude;
        const hasServerPin =
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          Number.isFinite(lat) &&
          Number.isFinite(lng);
        if (hasServerPin) {
          skipAccuracyResetCountRef.current += 1;
          setLatitude(lat);
          setLongitude(lng);
        } else {
          void resolveDefaultMapCoordinates({ preferHighAccuracy: true }).then((p) => {
            if (cancelled) return;
            skipAccuracyResetCountRef.current += 1;
            setLatitude(p.latitude);
            setLongitude(p.longitude);
          });
        }
        setShopType(shop.offering.shopType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL');
        setDealIn(new Set(shop.offering.dealIn.length ? shop.offering.dealIn : ['Groceries']));
        setServiceRadiusKm(shop.offering.serviceRadiusKm);
        setRadiusTiers(rulesToTierRows(rules));
        setRuleIdsToDelete(new Set());
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load shop.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const dealInList = useMemo(() => Array.from(dealIn), [dealIn]);

  function addRadiusTier() {
    setRadiusTiers((prev) => {
      if (prev.length >= MAX_RADIUS_TIERS) return prev;
      return [...prev, { clientKey: crypto.randomUUID(), minRupee: '', maxKm: '' }];
    });
  }

  function removeRadiusTier(index: number) {
    setRadiusTiers((prev) => {
      const row = prev[index];
      if (row?.ruleId) {
        setRuleIdsToDelete((d) => new Set(d).add(row.ruleId!));
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateRadiusTier(index: number, patch: Partial<Pick<RadiusTierRow, 'minRupee' | 'maxKm'>>) {
    setRadiusTiers((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function validateRadiusTiers(baseKm: number): string | null {
    for (const t of radiusTiers) {
      const hasMin = t.minRupee.trim() !== '';
      const hasMax = t.maxKm.trim() !== '';
      if (hasMin !== hasMax) {
        return 'Each order-based rule needs both a minimum order amount (₹) and a max radius (km).';
      }
    }
    const filled = radiusTiers.filter((t) => t.minRupee.trim() !== '' && t.maxKm.trim() !== '');
    if (filled.length > MAX_RADIUS_TIERS) {
      return `At most ${MAX_RADIUS_TIERS} order-based rules.`;
    }
    const mins = new Set<number>();
    for (const t of filled) {
      const min = Number(t.minRupee.trim());
      const km = Number(t.maxKm.trim());
      if (!Number.isFinite(min) || min <= 0) {
        return 'Minimum order amounts must be positive numbers.';
      }
      if (!Number.isFinite(km) || km <= baseKm) {
        return `Each extended radius must be greater than your default (${baseKm} km).`;
      }
      if (mins.has(min)) {
        return 'Two rules cannot use the same minimum order amount.';
      }
      mins.add(min);
    }
    return null;
  }

  function toggleCategory(label: string) {
    setDealIn((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        if (next.size <= 1) return prev;
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) return;
    setError(null);
    const tierErr = validateRadiusTiers(serviceRadiusKm);
    if (tierErr) {
      setError(tierErr);
      return;
    }
    setSaving(true);
    setSavedHint(false);
    try {
      const n = name.trim();
      const dn = displayName.trim() || n;
      const bn = billingName.trim() || `${n} (Business)`;
      await updateShop(shopId, {
        name: n,
        displayName: dn,
        billingName: bn,
        location: {
          coordinates: { latitude, longitude },
          addressText: addressText.trim() || null,
        },
        offering: {
          shopType,
          dealIn: dealInList,
          serviceRadiusKm,
        },
      });

      for (const id of ruleIdsToDelete) {
        await deleteDeliveryRadiusRule(id);
      }
      setRuleIdsToDelete(new Set());

      const filled = radiusTiers.filter((t) => t.minRupee.trim() !== '' && t.maxKm.trim() !== '');
      for (const t of filled) {
        const minOrderAmount = Number(t.minRupee.trim());
        const maxServiceRadiusKm = Number(t.maxKm.trim());
        if (t.ruleId) {
          await updateDeliveryRadiusRule(t.ruleId, { minOrderAmount, maxServiceRadiusKm });
        } else {
          await createDeliveryRadiusRule(shopId, { minOrderAmount, maxServiceRadiusKm });
        }
      }

      const rules = await fetchDeliveryRadiusRules(shopId);
      setRadiusTiers(rulesToTierRows(rules));

      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  if (!shopId) {
    return (
      <div className="sdash__panel sshop__panel">
        <h2>Shop settings</h2>
        <p>No shop is linked on this device yet.</p>
        <p>
          <Link to="/onboarding/seller" className="sshop__link">
            Run shop setup
          </Link>{' '}
          to create one.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sdash__panel sshop__panel">
        <p className="sshop__muted">Loading your shop…</p>
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="sdash__panel sshop__panel">
        <p className="sshop__error">{error}</p>
      </div>
    );
  }

  return (
    <form className="sshop" onSubmit={onSave}>
      <div className="sdash__panel sshop__panel">
        <h2>Shop settings</h2>
        <p className="sshop__lead">Update how buyers see your dukaan and where you deliver.</p>
        {error ? <p className="sshop__error">{error}</p> : null}
        {savedHint ? (
          <p className="sshop__ok" role="status">
            Saved.
          </p>
        ) : null}

        <label className="sshop__label" htmlFor={nameId}>
          Shop name
        </label>
        <input
          id={nameId}
          className="sshop__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
          maxLength={200}
        />

        <label className="sshop__label" htmlFor="sshop-display">
          Display name
        </label>
        <input
          id="sshop-display"
          className="sshop__input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={200}
        />

        <label className="sshop__label" htmlFor="sshop-billing">
          Billing / legal name
        </label>
        <input
          id="sshop-billing"
          className="sshop__input"
          value={billingName}
          onChange={(e) => setBillingName(e.target.value)}
          maxLength={255}
        />

        <label className="sshop__label" htmlFor="sshop-address">
          Address note
        </label>
        <textarea
          id="sshop-address"
          className="sshop__textarea"
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder="Landmark, street, area…"
        />

        <p className="sshop__label">Shop pin</p>
        <p className="sshop__hint" style={{ marginTop: '-0.2rem' }}>
          Drag the map so the centre pin is on your shop, or tap <strong>Use my location</strong> on the map.
        </p>
        <GoogleMapsEmbedMapPicker
          latitude={latitude}
          longitude={longitude}
          onCenterChange={onMapCenterChange}
          className="sshop__map"
          onDeviceLocation={onShopMapDeviceLocation}
        />
        <MapPinAddressSelect className="sshop__mapPick" variant="sshop" latitude={latitude} longitude={longitude} />

        <p className="sshop__label">Shop type</p>
        <div className="sshop__segRow">
          <button
            type="button"
            className={`sshop__seg ${shopType === 'RETAIL' ? 'sshop__seg--on' : ''}`}
            onClick={() => setShopType('RETAIL')}
          >
            Retail
          </button>
          <button
            type="button"
            className={`sshop__seg ${shopType === 'WHOLESALE' ? 'sshop__seg--on' : ''}`}
            onClick={() => setShopType('WHOLESALE')}
          >
            Wholesale
          </button>
        </div>

        <p className="sshop__label">Categories you deal in</p>
        <div className="sshop__chips">
          {PRODUCT_PRESETS.map((label) => (
            <button
              key={label}
              type="button"
              className={`sshop__chip ${dealIn.has(label) ? 'sshop__chip--on' : ''}`}
              onClick={() => toggleCategory(label)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="sshop__label" htmlFor="sshop-radius">
          Default delivery radius (km)
        </label>
        <input
          id="sshop-radius"
          className="sshop__input sshop__input--narrow"
          type="number"
          min={0}
          max={20000}
          step={0.5}
          value={serviceRadiusKm}
          onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
        />
        <p className="sshop__hint">
          This is the base radius for every order. Add rules below only if larger carts should unlock a longer distance.
        </p>

        <div className="sshop__sectionHead">
          <p className="sshop__label sshop__label--section">Order-based delivery (optional)</p>
          <p className="sshop__sectionSub">
            When cart total reaches an amount you set, you can deliver farther — same logic as checkout.
          </p>
        </div>

        <div className="sshop__callout" role="note">
          <span className="sshop__calloutEmoji" aria-hidden="true">
            💡
          </span>
          <div>
            <p className="sshop__calloutTitle">How it works</p>
            <p className="sshop__calloutText">
              Your base radius is <strong>{serviceRadiusKm} km</strong>. Each rule must use a max distance{' '}
              <strong>greater than {serviceRadiusKm} km</strong>. The app picks the best matching tier by order value.
            </p>
          </div>
        </div>

        {radiusTiers.length === 0 ? (
          <p className="sshop__tierEmpty">No extra rules — one radius for all order sizes.</p>
        ) : (
          <ul className="sshop__tierList">
            {radiusTiers.map((tier, index) => (
              <li key={tier.clientKey} className="sshop__tierRow">
                <div className="sshop__tierFields">
                  <label className="sshop__tierLabel">
                    When order is at least (₹)
                    <input
                      className="sshop__tierInput"
                      inputMode="decimal"
                      placeholder="2000"
                      value={tier.minRupee}
                      onChange={(e) => updateRadiusTier(index, { minRupee: e.target.value })}
                      autoComplete="off"
                    />
                  </label>
                  <label className="sshop__tierLabel">
                    Deliver up to (km)
                    <input
                      className="sshop__tierInput"
                      inputMode="decimal"
                      placeholder={`${serviceRadiusKm + 5}`}
                      value={tier.maxKm}
                      onChange={(e) => updateRadiusTier(index, { maxKm: e.target.value })}
                      autoComplete="off"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="sshop__tierRemove"
                  onClick={() => removeRadiusTier(index)}
                  aria-label="Remove this rule"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {radiusTiers.length < MAX_RADIUS_TIERS ? (
          <button type="button" className="sshop__tierAdd" onClick={addRadiusTier}>
            + Add a bigger-radius rule
          </button>
        ) : (
          <p className="sshop__tierCap">Five rules max — plenty for now.</p>
        )}

        <div className="sshop__actions">
          <button type="submit" className="sshop__submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
