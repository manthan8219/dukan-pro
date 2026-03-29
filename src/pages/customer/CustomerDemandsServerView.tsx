import { motion } from 'framer-motion';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  closeCustomerDemand,
  createCustomerDemand,
  listCustomerDemands,
  listDemandQuotations,
  publishCustomerDemand,
  type CustomerDemandQuotation,
  type CustomerDemandRecord,
} from '../../api/customerDemands';
import { registerContent } from '../../api/content';
import { GoogleMapsEmbedMapPicker } from '../../components/GoogleMapsEmbedMapPicker';
import {
  FALLBACK_MAP_CENTER,
  getCachedDeviceCoordinates,
  requestDeviceCoordinates,
  rememberDeviceCoordinates,
} from '../../geo/deviceLocation';
import { MIN_ORDER_TO_POST_RUPEES } from '../../demands/demandsStorage';
import '../../demands/demands.css';
import '../customer/customer-app.css';

function formatInrRupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}

function statusClass(s: CustomerDemandRecord['status']): string {
  if (s === 'LIVE') return 'dm__tag--open';
  if (s === 'DRAFT') return 'dm__tag--closed';
  if (s === 'AWARDED') return 'dm__tag--won';
  return 'dm__tag--closed';
}

export function CustomerDemandsServerView({ serverUserId }: { serverUserId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const titleId = useId();
  const detailsId = useId();
  const budgetId = useId();
  const orderTotalId = useId();
  const receiptUrlId = useId();

  const [demands, setDemands] = useState<CustomerDemandRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [budgetHint, setBudgetHint] = useState('');
  const [orderTotalInput, setOrderTotalInput] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptContentId, setReceiptContentId] = useState<string | null>(null);
  const [deliveryPinLat, setDeliveryPinLat] = useState(
    () => getCachedDeviceCoordinates()?.latitude ?? FALLBACK_MAP_CENTER.latitude,
  );
  const [deliveryPinLng, setDeliveryPinLng] = useState(
    () => getCachedDeviceCoordinates()?.longitude ?? FALLBACK_MAP_CENTER.longitude,
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [locAccuracyM, setLocAccuracyM] = useState<number | null>(null);
  const skipAccuracyResetCountRef = useRef(0);

  const [quotesOpenFor, setQuotesOpenFor] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<CustomerDemandQuotation[]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoadError(null);
    void listCustomerDemands(serverUserId)
      .then(setDemands)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load demands'));
  }, [serverUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openQuotesForDemand = useCallback(
    async (demandId: string) => {
      setQuotesOpenFor(demandId);
      setQuotesError(null);
      setQuotes([]);
      try {
        const rows = await listDemandQuotations(serverUserId, demandId);
        setQuotes(rows);
      } catch (e) {
        setQuotesError(e instanceof Error ? e.message : 'Could not load quotes');
      }
    },
    [serverUserId],
  );

  useEffect(() => {
    const q = searchParams.get('quotes');
    if (!q || demands.length === 0) return;
    if (!demands.some((d) => d.id === q)) return;
    void openQuotesForDemand(q);
    const next = new URLSearchParams(searchParams);
    next.delete('quotes');
    setSearchParams(next, { replace: true });
  }, [demands, searchParams, openQuotesForDemand, setSearchParams]);

  /** Best-effort: refresh map centre from GPS when available. */
  useEffect(() => {
    let cancelled = false;
    void requestDeviceCoordinates({ preferHighAccuracy: false }).then((p) => {
      if (cancelled || !p) return;
      skipAccuracyResetCountRef.current = 4;
      setDeliveryPinLat(p.latitude);
      setDeliveryPinLng(p.longitude);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onDeliveryMapCenterChange = useCallback((lat: number, lng: number) => {
    setDeliveryPinLat(lat);
    setDeliveryPinLng(lng);
    if (skipAccuracyResetCountRef.current > 0) {
      skipAccuracyResetCountRef.current -= 1;
      return;
    }
    setLocAccuracyM(null);
  }, []);

  function useMyLocationForDelivery() {
    if (!navigator.geolocation) {
      setGeoHint('This browser does not support GPS. Drag the map so the pin is on your delivery address.');
      return;
    }
    setGeoLoading(true);
    setGeoHint('Allow location when prompted — we only use it to centre this map.');
    skipAccuracyResetCountRef.current = 4;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryPinLat(pos.coords.latitude);
        setDeliveryPinLng(pos.coords.longitude);
        rememberDeviceCoordinates(pos.coords.latitude, pos.coords.longitude);
        const acc = pos.coords.accuracy;
        setLocAccuracyM(typeof acc === 'number' && Number.isFinite(acc) && acc > 0 ? acc : null);
        setGeoLoading(false);
        setGeoHint('Map centred on you — drag to fine-tune the exact drop point.');
      },
      (err) => {
        setGeoLoading(false);
        skipAccuracyResetCountRef.current = 0;
        setLocAccuracyM(null);
        const code = err?.code;
        if (code === 1) {
          setGeoHint('Location blocked. Allow it in the browser lock icon, or drag the map manually.');
        } else if (code === 2) {
          setGeoHint('Position unavailable. Drag the map to your delivery point.');
        } else if (code === 3) {
          setGeoHint('Location timed out. Try again or drag the map.');
        } else {
          setGeoHint('Could not read location. Drag the map to your delivery address.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 18_000 },
    );
  }

  const orderTotalNum = useMemo(() => {
    const t = orderTotalInput.trim().replace(/,/g, '');
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }, [orderTotalInput]);

  const orderMeetsMin = orderTotalNum != null && orderTotalNum >= MIN_ORDER_TO_POST_RUPEES;
  const canCreateDraft =
    title.trim().length > 0 &&
    details.trim().length > 0 &&
    orderMeetsMin &&
    Boolean(receiptContentId);

  async function onRegisterReceiptUrl() {
    setFormError(null);
    const url = receiptUrl.trim();
    if (!url.startsWith('http')) {
      setFormError('Paste a direct https URL to your receipt image (host the file or use a CDN).');
      return;
    }
    setBusy(true);
    try {
      const c = await registerContent({
        storageUrl: url,
        kind: 'IMAGE',
        mimeType: 'image/jpeg',
        ownerUserId: serverUserId,
      });
      setReceiptContentId(c.id);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not register content');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!canCreateDraft || orderTotalNum == null || !receiptContentId) return;
    setBusy(true);
    try {
      await createCustomerDemand(serverUserId, {
        title: title.trim(),
        details: details.trim(),
        budgetHint: budgetHint.trim() || null,
        receiptContentId,
        receiptOrderTotalMinor: Math.round(orderTotalNum * 100 + Number.EPSILON),
        deliveryLatitude: deliveryPinLat,
        deliveryLongitude: deliveryPinLng,
      });
      setTitle('');
      setDetails('');
      setBudgetHint('');
      setOrderTotalInput('');
      setReceiptUrl('');
      setReceiptContentId(null);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onPublish(d: CustomerDemandRecord) {
    setFormError(null);
    const lat = d.deliveryLatitude ?? deliveryPinLat;
    const lng = d.deliveryLongitude ?? deliveryPinLng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setFormError('Set the delivery point on the map (or open the draft after saving coordinates) before publishing.');
      return;
    }
    setBusy(true);
    try {
      await publishCustomerDemand(serverUserId, d.id, {
        deliveryLatitude: lat,
        deliveryLongitude: lng,
      });
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  async function onClose(d: CustomerDemandRecord) {
    if (!window.confirm('Close this request? Shops will stop seeing it as open.')) return;
    setBusy(true);
    try {
      await closeCustomerDemand(serverUserId, d.id);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Close failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleQuotes(demandId: string) {
    if (quotesOpenFor === demandId) {
      setQuotesOpenFor(null);
      setQuotes([]);
      return;
    }
    setQuotesOpenFor(demandId);
    setQuotesError(null);
    setQuotes([]);
    try {
      const rows = await listDemandQuotations(serverUserId, demandId);
      setQuotes(rows);
    } catch (e) {
      setQuotesError(e instanceof Error ? e.message : 'Could not load quotes');
    }
  }

  return (
    <motion.div
      className="cust__demandsEmbed"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <Link to="/app/customer" className="cust__back">
        ← Nearby shops
      </Link>

      <h2 className="cust__pageTitle">Request shop quotations</h2>
      <p className="cust__sub">
        Your request is saved securely. Pick the delivery spot on the map; when you publish, nearby shops that can reach
        that point can reply with a quotation. Receipt total must be ≥{' '}
        {formatInrRupees(MIN_ORDER_TO_POST_RUPEES)}.
      </p>

      <div className="dm__banner">
        Receipt image: paste a direct <strong>https</strong> link to the picture (for example from your cloud storage),
        then tap <strong>Link receipt</strong>. Very long links may not work.
      </div>

      {loadError ? <p className="dm__err">{loadError}</p> : null}
      {formError ? <p className="dm__err">{formError}</p> : null}

      <form className="dm__panel" onSubmit={onCreateDraft} style={{ marginBottom: '1.5rem' }}>
        <h2 className="dm__panelTitle">New draft</h2>

        <label className="dm__label" htmlFor={receiptUrlId}>
          Receipt image URL (https)
        </label>
        <div className="dm__row2">
          <input
            id={receiptUrlId}
            className="dm__input"
            style={{ marginBottom: 0 }}
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            placeholder="https://…/receipt.jpg"
          />
          <button
            type="button"
            className="dm__btn dm__btn--ghost"
            style={{ marginBottom: 0 }}
            disabled={busy}
            onClick={() => void onRegisterReceiptUrl()}
          >
            Link receipt
          </button>
        </div>
        {receiptContentId ? (
          <p className="dm__hint" style={{ marginBottom: '0.85rem' }}>
            Content id: <code>{receiptContentId.slice(0, 8)}…</code>
          </p>
        ) : null}

        <label className="dm__label" htmlFor={orderTotalId}>
          Receipt total (₹) — min {formatInrRupees(MIN_ORDER_TO_POST_RUPEES)}
        </label>
        <input
          id={orderTotalId}
          className="dm__input"
          inputMode="decimal"
          value={orderTotalInput}
          onChange={(e) => setOrderTotalInput(e.target.value)}
        />

        <p className="dm__label">Delivery location (map)</p>
        <p className="dm__hint" style={{ marginTop: '-0.35rem', marginBottom: '0.5rem' }}>
          Drag the map so the centre pin sits on your door or lane — we use that point to match shop delivery circles.
        </p>
        <div
          className="cust__mapWrap"
          style={{
            height: 280,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: '0.65rem',
            border: '1px solid rgba(15, 118, 110, 0.22)',
          }}
        >
          <GoogleMapsEmbedMapPicker
            className="cust__mapPicker"
            latitude={deliveryPinLat}
            longitude={deliveryPinLng}
            onCenterChange={onDeliveryMapCenterChange}
            accuracyMeters={locAccuracyM}
            initialZoom={16}
            mapAriaLabel="Map: drag so the centre pin is on your delivery address"
            hintText="Drag the map — pin marks delivery point · pinch or controls to zoom"
          />
        </div>
        <div className="dm__row2" style={{ marginBottom: '0.5rem' }}>
          <button
            type="button"
            className="dm__btn dm__btn--ghost"
            style={{ marginBottom: 0 }}
            disabled={busy || geoLoading}
            onClick={() => useMyLocationForDelivery()}
          >
            {geoLoading ? 'Locating…' : 'Use my location'}
          </button>
          <p className="dm__hint" style={{ margin: 0, alignSelf: 'center' }}>
            <code className="cust__code">
              {deliveryPinLat.toFixed(6)}, {deliveryPinLng.toFixed(6)}
            </code>
          </p>
        </div>
        {geoHint ? <p className="dm__hint">{geoHint}</p> : null}

        <label className="dm__label" htmlFor={titleId}>
          Title
        </label>
        <input
          id={titleId}
          className="dm__input"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className="dm__label" htmlFor={detailsId}>
          Details
        </label>
        <textarea
          id={detailsId}
          className="dm__textarea"
          required
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />

        <label className="dm__label" htmlFor={budgetId}>
          Budget hint (optional)
        </label>
        <input
          id={budgetId}
          className="dm__input"
          value={budgetHint}
          onChange={(e) => setBudgetHint(e.target.value)}
        />

        <button type="submit" className="dm__btn dm__btn--primary" disabled={!canCreateDraft || busy}>
          Save draft on server
        </button>
      </form>

      <h3
        style={{
          margin: '1.5rem 0 0.65rem',
          fontSize: '1.05rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--cust-teal-dark)',
        }}
      >
        My requests (server)
      </h3>

      {demands.length === 0 ? (
        <p className="dm__empty dm__panel">No drafts or published requests yet.</p>
      ) : (
        demands.map((d) => (
          <article key={d.id} className="dm__card">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.35rem',
              }}
            >
              <span className={`dm__tag ${statusClass(d.status)}`}>{d.status}</span>
              <span className="dm__cardMeta" style={{ margin: 0 }}>
                {d.notifiedShopCount} shop{d.notifiedShopCount === 1 ? '' : 's'} notified · {d.quotationCount} quote
                {d.quotationCount === 1 ? '' : 's'}
              </span>
            </div>
            <h3 className="dm__cardTitle">{d.title}</h3>
            {d.receiptOrderTotalMinor != null ? (
              <p className="dm__cardMeta">
                Receipt total:{' '}
                <strong>{formatInrRupees(d.receiptOrderTotalMinor / 100)}</strong>
              </p>
            ) : null}
            {d.budgetHint ? <p className="dm__cardMeta">Budget hint: {d.budgetHint}</p> : null}
            {d.receiptImageUrl ? (
              <div className="dm__receiptPreview" style={{ marginBottom: '0.65rem' }}>
                <img src={d.receiptImageUrl} alt="" />
              </div>
            ) : null}
            <p className="dm__cardBody">{d.details}</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {d.status === 'DRAFT' ? (
                <button
                  type="button"
                  className="dm__btn dm__btn--primary dm__btn--sm"
                  disabled={busy}
                  onClick={() => void onPublish(d)}
                >
                  Publish to nearby shops
                </button>
              ) : null}
              {d.status === 'LIVE' ? (
                <button
                  type="button"
                  className="dm__btn dm__btn--ghost dm__btn--sm"
                  disabled={busy}
                  onClick={() => void onClose(d)}
                >
                  Close request
                </button>
              ) : null}
              {d.quotationCount > 0 ? (
                <button
                  type="button"
                  className="dm__btn dm__btn--ghost dm__btn--sm"
                  onClick={() => void toggleQuotes(d.id)}
                >
                  {quotesOpenFor === d.id ? 'Hide' : 'View'} quotations ({d.quotationCount})
                </button>
              ) : null}
            </div>

            {quotesOpenFor === d.id ? (
              <div style={{ marginTop: '0.75rem' }}>
                {quotesError ? <p className="dm__err">{quotesError}</p> : null}
                {quotes.length === 0 && !quotesError ? (
                  <p className="dm__cardMeta">Loading…</p>
                ) : (
                  quotes.map((q) => (
                    <div key={q.invitationId} className="dm__panel" style={{ marginBottom: '0.5rem' }}>
                      <p className="dm__bidShop">{q.shopDisplayName}</p>
                      <p className="dm__cardBody" style={{ marginBottom: '0.35rem' }}>
                        {q.quotationText}
                      </p>
                      {q.quotationDocumentUrl ? (
                        <a href={q.quotationDocumentUrl} className="dm__link" target="_blank" rel="noreferrer">
                          View attached bill / PDF
                        </a>
                      ) : null}
                      <p className="dm__cardMeta" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                        {new Date(q.respondedAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </article>
        ))
      )}
    </motion.div>
  );
}
