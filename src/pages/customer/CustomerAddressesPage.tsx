import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleMapsEmbedMapPicker } from '../../components/GoogleMapsEmbedMapPicker';
import type { MapLocateEvent } from '../../components/map';
import { MapPinAddressSelect } from '../../components/map/MapPinAddressSelect';
import {
  FALLBACK_MAP_CENTER,
  getCachedDeviceCoordinates,
  rememberDeviceCoordinates,
  requestDeviceCoordinates,
} from '../../geo/deviceLocation';
import { useCustomerDeliveryAddresses } from './customerDeliveryAddressesContext';
import type { AddressTag, DeliveryAddress, SavedAddress } from './customerDeliveryTypes';
import { deliverySummaryLine } from './customerDeliveryTypes';
import './customer-app.css';

const emptyAddr: DeliveryAddress = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  pin: '',
  latitude: null,
  longitude: null,
};

function toFields(s: SavedAddress): DeliveryAddress {
  const { id: _i, tag: _t, label: _l, ...rest } = s;
  return rest;
}

export function CustomerAddressesPage() {
  const formId = useId();
  const { book, loading, error, addSavedAddress, updateSavedAddress, removeSavedAddress, setSelectedAddressId } =
    useCustomerDeliveryAddresses();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tag, setTag] = useState<AddressTag>('home');
  const [customLabel, setCustomLabel] = useState('');
  const [fields, setFields] = useState<DeliveryAddress>({ ...emptyAddr });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [mapPinLat, setMapPinLat] = useState(FALLBACK_MAP_CENTER.latitude);
  const [mapPinLng, setMapPinLng] = useState(FALLBACK_MAP_CENTER.longitude);
  const [pinLocationConfirmed, setPinLocationConfirmed] = useState(false);
  const [pinLocationLabel, setPinLocationLabel] = useState('');
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [locAccuracyM, setLocAccuracyM] = useState<number | null>(null);
  const skipAccuracyResetCountRef = useRef(0);

  const resetMapForNewAddress = useCallback(() => {
    const c = getCachedDeviceCoordinates();
    setMapPinLat(c?.latitude ?? FALLBACK_MAP_CENTER.latitude);
    setMapPinLng(c?.longitude ?? FALLBACK_MAP_CENTER.longitude);
    setPinLocationConfirmed(false);
    setPinLocationLabel('');
    setGeoHint(null);
    setLocAccuracyM(null);
  }, []);

  function openAdd() {
    setEditingId(null);
    setTag('home');
    setCustomLabel('');
    setFields({ ...emptyAddr });
    setFormError(null);
    resetMapForNewAddress();
    setShowForm(true);
  }

  function openEdit(s: SavedAddress) {
    setEditingId(s.id);
    setTag(s.tag);
    setCustomLabel(s.tag === 'other' ? s.label : '');
    setFields(toFields(s));
    setFormError(null);
    if (
      s.latitude != null &&
      s.longitude != null &&
      Number.isFinite(s.latitude) &&
      Number.isFinite(s.longitude)
    ) {
      setMapPinLat(s.latitude);
      setMapPinLng(s.longitude);
      setPinLocationConfirmed(true);
      setPinLocationLabel(s.landmark?.trim() ? s.landmark.trim() : 'Saved map pin');
    } else {
      resetMapForNewAddress();
    }
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  useEffect(() => {
    if (!showForm || editingId) return;
    let cancelled = false;
    void requestDeviceCoordinates({ preferHighAccuracy: false }).then((p) => {
      if (cancelled || !p) return;
      skipAccuracyResetCountRef.current = 4;
      setMapPinLat(p.latitude);
      setMapPinLng(p.longitude);
      setPinLocationConfirmed(false);
      setPinLocationLabel('');
    });
    return () => {
      cancelled = true;
    };
  }, [showForm, editingId]);

  const onMapCenterChange = useCallback((lat: number, lng: number) => {
    setMapPinLat(lat);
    setMapPinLng(lng);
    setPinLocationConfirmed(false);
    if (skipAccuracyResetCountRef.current > 0) {
      skipAccuracyResetCountRef.current -= 1;
      return;
    }
    setLocAccuracyM(null);
  }, []);

  const onMapDeviceLocation = useCallback((ev: MapLocateEvent) => {
    if (ev.kind === 'request') {
      setGeoHint('Allow location when prompted — we centre the map on you.');
      return;
    }
    if (ev.kind === 'success') {
      skipAccuracyResetCountRef.current = 4;
      setPinLocationConfirmed(false);
      setMapPinLat(ev.latitude);
      setMapPinLng(ev.longitude);
      rememberDeviceCoordinates(ev.latitude, ev.longitude);
      setLocAccuracyM(ev.accuracyMeters);
      setGeoHint('Map centred on you — drag so the pin sits on your door or gate.');
      return;
    }
    skipAccuracyResetCountRef.current = 0;
    setLocAccuracyM(null);
    if (ev.code === 'unsupported') {
      setGeoHint('GPS not available. Drag the map until the pin is on your address.');
      return;
    }
    if (ev.code === 1) {
      setGeoHint('Location blocked — allow it in the site settings, or drag the map manually.');
    } else if (ev.code === 2) {
      setGeoHint('Position unavailable. Drag the map to your address.');
    } else if (ev.code === 3) {
      setGeoHint('Location timed out. Drag the map to your address.');
    } else {
      setGeoHint('Could not read location. Drag the map to your address.');
    }
  }, []);

  function updateField<K extends keyof DeliveryAddress>(key: K, value: DeliveryAddress[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const submitForm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const labelForOther = customLabel.trim() || 'Other';
      setFormError(null);
      if (!pinLocationConfirmed || !Number.isFinite(mapPinLat) || !Number.isFinite(mapPinLng)) {
        setFormError('Place the pin on the map at your delivery spot, then tap Confirm pin.');
        return;
      }
      setSaving(true);
      try {
        if (editingId) {
          await updateSavedAddress(editingId, {
            ...fields,
            tag,
            label: tag === 'other' ? labelForOther : undefined,
            latitude: mapPinLat,
            longitude: mapPinLng,
          });
        } else {
          await addSavedAddress({
            tag,
            label: tag === 'other' ? labelForOther : tag === 'home' ? 'Home' : 'Office',
            ...fields,
            latitude: mapPinLat,
            longitude: mapPinLng,
          });
        }
        closeForm();
      } catch {
        setFormError('Could not save. Check your connection and try again.');
      } finally {
        setSaving(false);
      }
    },
    [
      editingId,
      fields,
      tag,
      customLabel,
      pinLocationConfirmed,
      mapPinLat,
      mapPinLng,
      updateSavedAddress,
      addSavedAddress,
    ],
  );

  async function selectForDelivery(id: string) {
    try {
      await setSelectedAddressId(id);
    } catch {
      /* ignore */
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Remove this saved address?')) return;
    try {
      await removeSavedAddress(id);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <h2 className="cust__pageTitle">Delivery addresses</h2>
      <p className="cust__sub">
        Choose a tag (Home, Office, or custom), <strong>pin the spot on the map</strong>, then fill in the details. The
        address marked <strong>Active</strong> is used at checkout and in the header.
      </p>
      {error ? (
        <p className="cust__sub" role="alert" style={{ color: 'var(--cust-danger, #c62828)' }}>
          {error}
        </p>
      ) : null}

      <div className="cust__addrList">
        {loading ? (
          <p className="cust__sub">Loading addresses…</p>
        ) : book.addresses.length === 0 ? (
          <div className="cust__panel cust__addrEmpty">
            <p className="cust__sub" style={{ marginBottom: '0.75rem' }}>
              No addresses yet. Add your first one — you’ll drop a pin on the map and save your details.
            </p>
            <button type="button" className="cust__btn cust__btn--primary cust__btn--block" onClick={openAdd}>
              Add address
            </button>
          </div>
        ) : (
          book.addresses.map((s) => {
            const active = book.selectedId === s.id;
            const hasPin =
              s.latitude != null && s.longitude != null && Number.isFinite(s.latitude) && Number.isFinite(s.longitude);
            return (
              <div key={s.id} className={`cust__addrCard${active ? ' cust__addrCard--active' : ''}`}>
                <div className="cust__addrCardTop">
                  <span className={`cust__addrBadge cust__addrBadge--${s.tag}`}>{s.label}</span>
                  {active ? <span className="cust__addrActivePill">Active for delivery</span> : null}
                </div>
                <p className="cust__addrLines">{deliverySummaryLine(toFields(s))}</p>
                {hasPin ? (
                  <p className="cust__addrMapHint" style={{ marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                    Map location saved for this address.
                  </p>
                ) : null}
                <p className="cust__addrPerson">
                  {s.fullName || '—'} · {s.phone || '—'}
                </p>
                <div className="cust__addrActions">
                  {!active ? (
                    <button
                      type="button"
                      className="cust__btn cust__btn--teal cust__btn--sm"
                      onClick={() => void selectForDelivery(s.id)}
                    >
                      Use for delivery
                    </button>
                  ) : null}
                  <button type="button" className="cust__btn cust__btn--ghost cust__btn--sm" onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  <button type="button" className="cust__btn cust__btn--ghost cust__btn--sm" onClick={() => void onDelete(s.id)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && book.addresses.length > 0 ? (
        <button type="button" className="cust__btn cust__btn--primary cust__btn--block" style={{ marginBottom: '1rem' }} onClick={openAdd}>
          Add another address
        </button>
      ) : null}

      {showForm ? (
        <form className="cust__panel" onSubmit={(e) => void submitForm(e)}>
          <p className="cust__sectionLabel" style={{ marginBottom: '0.65rem' }}>
            {editingId ? 'Edit address' : 'New address'}
          </p>

          <p className="cust__label">Tag</p>
          <div className="cust__tagPick" role="group" aria-label="Address tag">
            {(
              [
                ['home', 'Home'],
                ['office', 'Office'],
                ['other', 'Other'],
              ] as const
            ).map(([value, lab]) => (
              <button
                key={value}
                type="button"
                className={`cust__tagPickBtn${tag === value ? ' cust__tagPickBtn--on' : ''}`}
                onClick={() => setTag(value)}
              >
                {lab}
              </button>
            ))}
          </div>
          {tag === 'other' ? (
            <>
              <label className="cust__label" htmlFor={`${formId}-label`}>
                Label (e.g. Mom&apos;s place, Gym)
              </label>
              <input
                id={`${formId}-label`}
                className="cust__input"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Name this address"
              />
            </>
          ) : null}

          <div className="cust__addrMapSection">
            <p className="cust__addrMapTitle">Pin on map</p>
            <p className="cust__addrMapHint">
              The <strong>teal pin stays in the centre</strong> — drag the map so it marks your door or gate. Then tap{' '}
              <strong>Confirm pin</strong>.
            </p>
            <MapPinAddressSelect
              className="cust__addrMapPick"
              latitude={mapPinLat}
              longitude={mapPinLng}
              locationConfirmed={pinLocationConfirmed}
              confirmedLabel={pinLocationLabel}
              onSelectLocation={(label) => {
                setPinLocationLabel(label);
                setPinLocationConfirmed(true);
              }}
              selectButtonText="Confirm pin"
              variant="wiz"
            />
            {geoHint ? <p className="cust__addrMapHint">{geoHint}</p> : null}
            <div className="cust__addrMapWrap">
              <GoogleMapsEmbedMapPicker
                className="cust__mapPicker"
                latitude={mapPinLat}
                longitude={mapPinLng}
                accuracyMeters={locAccuracyM}
                onCenterChange={onMapCenterChange}
                initialZoom={16}
                mapAriaLabel="Map: drag so the centre pin is on your delivery address"
                hintText="Drag the map — pin marks delivery point · pinch or controls to zoom"
                useMyLocationLabel="Use my location"
                onDeviceLocation={onMapDeviceLocation}
              />
            </div>
          </div>

          {formError ? (
            <p className="cust__bannerNote cust__bannerNote--err" role="alert" style={{ marginBottom: '0.85rem' }}>
              {formError}
            </p>
          ) : null}

          <label className="cust__label" htmlFor={`${formId}-name`}>
            Full name
          </label>
          <input
            id={`${formId}-name`}
            className="cust__input"
            value={fields.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            autoComplete="name"
            required
          />
          <label className="cust__label" htmlFor={`${formId}-phone`}>
            Phone
          </label>
          <input
            id={`${formId}-phone`}
            className="cust__input"
            value={fields.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            required
          />
          <label className="cust__label" htmlFor={`${formId}-line1`}>
            Flat / house &amp; street
          </label>
          <input
            id={`${formId}-line1`}
            className="cust__input"
            value={fields.line1}
            onChange={(e) => updateField('line1', e.target.value)}
            autoComplete="street-address"
            required
          />
          <label className="cust__label" htmlFor={`${formId}-line2`}>
            Area (optional)
          </label>
          <input
            id={`${formId}-line2`}
            className="cust__input"
            value={fields.line2}
            onChange={(e) => updateField('line2', e.target.value)}
          />
          <label className="cust__label" htmlFor={`${formId}-landmark`}>
            Landmark (optional)
          </label>
          <input
            id={`${formId}-landmark`}
            className="cust__input"
            value={fields.landmark}
            onChange={(e) => updateField('landmark', e.target.value)}
          />
          <div className="cust__row2">
            <div>
              <label className="cust__label" htmlFor={`${formId}-city`}>
                City
              </label>
              <input
                id={`${formId}-city`}
                className="cust__input"
                value={fields.city}
                onChange={(e) => updateField('city', e.target.value)}
                autoComplete="address-level2"
                required
              />
            </div>
            <div>
              <label className="cust__label" htmlFor={`${formId}-pin`}>
                PIN
              </label>
              <input
                id={`${formId}-pin`}
                className="cust__input"
                value={fields.pin}
                onChange={(e) => updateField('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="postal-code"
                required
              />
            </div>
          </div>

          <div className="cust__addrFormActions">
            <button type="button" className="cust__btn cust__btn--ghost cust__btn--block" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="cust__btn cust__btn--teal cust__btn--block" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save address'}
            </button>
          </div>
        </form>
      ) : null}

      <Link to="/app/customer" className="cust__back">
        ← Back to shops
      </Link>
    </>
  );
}
