import { motion } from 'framer-motion';
import { useCallback, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getUserId } from '../auth/session';
import {
  acceptBid,
  bidCountForDemand,
  closeDemand,
  createDemand,
  listBidsForDemand,
  listDemandsForCustomer,
  MAX_RECEIPT_IMAGE_BYTES,
  MIN_ORDER_TO_POST_RUPEES,
  type Demand,
} from '../demands/demandsStorage';
import '../demands/demands.css';
import { CustomerDemandsServerView } from './customer/CustomerDemandsServerView';
import { useCustomerCart } from './customer/cartContext';
import './customer/customer-app.css';

function formatInrRupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}

function DemandCustomerCard({
  demand,
  userId,
  onChange,
  version,
}: {
  demand: Demand;
  userId: string;
  onChange: () => void;
  version: number;
}) {
  const bids = useMemo(() => listBidsForDemand(demand.id), [demand.id, demand.status, version]);
  const [open, setOpen] = useState(false);
  const hasReceipt = Boolean(demand.receiptImageDataUrl);
  const orderLine =
    demand.orderTotalRupees >= MIN_ORDER_TO_POST_RUPEES
      ? formatInrRupees(demand.orderTotalRupees)
      : null;

  return (
    <article className="dm__card">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
        <span
          className={`dm__tag ${demand.status === 'open' ? 'dm__tag--open' : demand.status === 'awarded' ? 'dm__tag--won' : 'dm__tag--closed'}`}
        >
          {demand.status === 'open' ? 'Open' : demand.status === 'awarded' ? 'Awarded' : 'Closed'}
        </span>
        <span className="dm__cardMeta" style={{ margin: 0 }}>
          {bidCountForDemand(demand.id)} bid{bidCountForDemand(demand.id) === 1 ? '' : 's'}
        </span>
      </div>
      <h3 className="dm__cardTitle">{demand.title}</h3>
      {orderLine ? (
        <p className="dm__cardMeta" style={{ marginBottom: '0.35rem' }}>
          Receipt order total: <strong>{orderLine}</strong>
        </p>
      ) : (
        <p className="dm__cardMeta" style={{ marginBottom: '0.35rem' }}>
          Older request — no receipt total on file.
        </p>
      )}
      {demand.budgetHint ? <p className="dm__cardMeta">Budget hint: {demand.budgetHint}</p> : null}
      {hasReceipt ? (
        <div className="dm__receiptPreview" style={{ marginBottom: '0.65rem' }}>
          <img src={demand.receiptImageDataUrl!} alt="Receipt you uploaded" />
        </div>
      ) : null}
      <p className="dm__cardBody">{demand.details}</p>

      {demand.status === 'awarded' && demand.awardedBidId ? (
        <div className="dm__panel" style={{ marginTop: '0.5rem', marginBottom: 0, padding: '0.75rem 1rem' }}>
          <p className="dm__cardMeta" style={{ margin: 0 }}>
            You chose:{' '}
            <strong>{bids.find((b) => b.id === demand.awardedBidId)?.shopName ?? '—'}</strong> at{' '}
            <strong>INR {bids.find((b) => b.id === demand.awardedBidId)?.amount.toFixed(2) ?? '—'}</strong>
          </p>
        </div>
      ) : null}

      <button type="button" className="dm__btn dm__btn--ghost dm__btn--sm" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide bids' : 'See bids & pick a shop'}
      </button>

      {open ? (
        <div style={{ marginTop: '0.75rem' }}>
          {bids.length === 0 ? (
            <p className="dm__cardMeta">No bids yet — sellers will see your request on their demand board.</p>
          ) : (
            bids.map((b) => (
              <div key={b.id} className="dm__bidRow">
                <div>
                  <div className="dm__bidShop">{b.shopName}</div>
                  {b.note ? <p className="dm__bidNote">{b.note}</p> : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="dm__bidAmt">INR {b.amount.toFixed(2)}</div>
                  {demand.status === 'open' ? (
                    <button
                      type="button"
                      className="dm__btn dm__btn--good dm__btn--sm"
                      style={{ marginTop: '0.35rem' }}
                      onClick={() => {
                        if (acceptBid(demand.id, b.id, userId)) onChange();
                      }}
                    >
                      Buy from this shop
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {demand.status === 'open' ? (
            <button
              type="button"
              className="dm__btn dm__btn--ghost dm__btn--sm"
              style={{ marginTop: '0.5rem' }}
              onClick={() => {
                if (window.confirm('Close this request without choosing a seller?')) {
                  closeDemand(demand.id, userId);
                  onChange();
                }
              }}
            >
              Close without buying
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function CustomerDemandsPage() {
  const userId = getUserId();
  const { subtotal } = useCustomerCart();
  const { backendProfile } = useAuth();
  const [v, setV] = useState(0);
  const refresh = useCallback(() => setV((x) => x + 1), []);

  const nameId = useId();
  const titleId = useId();
  const detailsId = useId();
  const budgetId = useId();
  const orderTotalId = useId();
  const receiptInputId = useId();

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [budgetHint, setBudgetHint] = useState('');
  const [orderTotalInput, setOrderTotalInput] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receiptKey, setReceiptKey] = useState(0);

  const myDemands = useMemo(() => (userId ? listDemandsForCustomer(userId) : []), [userId, v]);

  const orderTotalNum = useMemo(() => {
    const t = orderTotalInput.trim().replace(/,/g, '');
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }, [orderTotalInput]);

  const orderMeetsMin = orderTotalNum != null && orderTotalNum >= MIN_ORDER_TO_POST_RUPEES;
  const canSubmit =
    Boolean(userId) &&
    title.trim().length > 0 &&
    details.trim().length > 0 &&
    orderMeetsMin &&
    Boolean(receiptPreview);

  if (!userId) {
    return (
      <div className="cust__panel">
        <p className="cust__sub" style={{ marginBottom: '1rem' }}>
          Sign in to post a request.
        </p>
        <Link to="/" className="cust__btn cust__btn--primary cust__btn--block">
          Go to login
        </Link>
      </div>
    );
  }

  function onReceiptFile(file: File | null) {
    setReceiptError(null);
    setReceiptPreview(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setReceiptError('Use a photo file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
      setReceiptError(`Keep the image under ${Math.round(MAX_RECEIPT_IMAGE_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (!url.startsWith('data:image/')) {
        setReceiptError('Could not read this image.');
        return;
      }
      setReceiptPreview(url);
    };
    reader.onerror = () => setReceiptError('Could not read this file.');
    reader.readAsDataURL(file);
  }

  function submitDemand(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!userId || !title.trim() || !details.trim()) return;
    if (!receiptPreview) {
      setSubmitError('Add a clear photo of your receipt.');
      return;
    }
    if (!orderMeetsMin || orderTotalNum == null) {
      setSubmitError(
        `Order total on the receipt must be at least ${formatInrRupees(MIN_ORDER_TO_POST_RUPEES)}.`,
      );
      return;
    }
    try {
      createDemand({
        customerUserId: userId,
        customerName: name.trim() || 'Customer',
        title: title.trim(),
        details: details.trim(),
        budgetHint: budgetHint.trim(),
        orderTotalRupees: orderTotalNum,
        receiptImageDataUrl: receiptPreview,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save request.');
      return;
    }
    setTitle('');
    setDetails('');
    setBudgetHint('');
    setOrderTotalInput('');
    setReceiptPreview(null);
    setReceiptKey((k) => k + 1);
    refresh();
  }

  if (backendProfile?.id) {
    return <CustomerDemandsServerView serverUserId={backendProfile.id} />;
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

      <h2 className="cust__pageTitle">Request &amp; compare bids</h2>
      <p className="cust__sub">
        Post what you need after a <strong>₹{MIN_ORDER_TO_POST_RUPEES.toLocaleString('en-IN')}+</strong> purchase — upload
        your receipt so sellers can trust the request. They quote on their board; you pick a shop. For cart checkout, use
        the <strong>Shops</strong> tab.
      </p>

      <div className="dm__banner">
        Stored on this device only. Same login elsewhere uses the same user id for requests.
      </div>

      <div className="dm__gate" role="note">
        <strong>Rule:</strong> only orders of {formatInrRupees(MIN_ORDER_TO_POST_RUPEES)} or more qualify. Enter the{' '}
        <strong>total from your receipt</strong> and attach a <strong>photo of that receipt</strong> before posting.
      </div>

      <form className="dm__panel" onSubmit={submitDemand} style={{ marginBottom: '1.5rem' }}>
        <h2 className="dm__panelTitle">New request</h2>

        {subtotal > 0 && subtotal < MIN_ORDER_TO_POST_RUPEES ? (
          <p className="dm__hint">
            Your basket is {formatInrRupees(subtotal)} — still below the posting minimum. This form uses your{' '}
            <strong>receipt total</strong>, not the live basket.
          </p>
        ) : null}

        <label className="dm__label" htmlFor={nameId}>
          Your name (shown to sellers)
        </label>
        <input
          id={nameId}
          className="dm__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rahul"
        />

        <label className="dm__label" htmlFor={orderTotalId}>
          Order total on receipt (₹) — min {formatInrRupees(MIN_ORDER_TO_POST_RUPEES)}
        </label>
        <input
          id={orderTotalId}
          className="dm__input"
          inputMode="decimal"
          autoComplete="off"
          value={orderTotalInput}
          onChange={(e) => setOrderTotalInput(e.target.value)}
          placeholder={`e.g. ${MIN_ORDER_TO_POST_RUPEES + 500}`}
          aria-invalid={orderTotalNum != null && !orderMeetsMin}
        />
        {orderTotalNum != null && !orderMeetsMin ? (
          <p className="dm__err">Must be at least {formatInrRupees(MIN_ORDER_TO_POST_RUPEES)}.</p>
        ) : null}

        <label className="dm__label" htmlFor={receiptInputId}>
          Receipt photo
        </label>
        <p className="dm__hint" style={{ marginTop: 0 }}>
          One clear image (max {Math.round(MAX_RECEIPT_IMAGE_BYTES / (1024 * 1024))} MB). Sellers see this on their board.
        </p>
        <div className="dm__fileWrap">
          <input
            key={receiptKey}
            id={receiptInputId}
            className="dm__fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            onChange={(e) => onReceiptFile(e.target.files?.[0] ?? null)}
          />
          <label htmlFor={receiptInputId} className="dm__fileBtn">
            📷 Choose receipt image
          </label>
          {receiptError ? <p className="dm__err">{receiptError}</p> : null}
          {receiptPreview ? (
            <>
              <div className="dm__receiptPreview">
                <img src={receiptPreview} alt="Receipt preview" />
              </div>
              <div className="dm__receiptActions">
                <button
                  type="button"
                  className="dm__btn dm__btn--ghost dm__btn--sm"
                  onClick={() => {
                    setReceiptPreview(null);
                    setReceiptKey((k) => k + 1);
                    setReceiptError(null);
                  }}
                >
                  Remove photo
                </button>
              </div>
            </>
          ) : null}
        </div>

        <label className="dm__label" htmlFor={titleId}>
          What do you need?
        </label>
        <input
          id={titleId}
          className="dm__input"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Same order next week — 10kg atta + 5L oil"
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
          placeholder="Brand preferences, delivery area, timing, link to items on the receipt…"
        />

        <label className="dm__label" htmlFor={budgetId}>
          Budget hint (optional)
        </label>
        <input
          id={budgetId}
          className="dm__input"
          value={budgetHint}
          onChange={(e) => setBudgetHint(e.target.value)}
          placeholder="e.g. hoping to stay near last bill"
        />

        {submitError ? <p className="dm__err">{submitError}</p> : null}

        <button type="submit" className="dm__btn dm__btn--primary" disabled={!canSubmit}>
          Post to sellers
        </button>
        {!canSubmit ? (
          <p className="dm__hint" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
            Fill title, details, receipt total ≥ {formatInrRupees(MIN_ORDER_TO_POST_RUPEES)}, and upload a receipt photo
            to enable posting.
          </p>
        ) : null}
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
        My requests
      </h3>
      {myDemands.length === 0 ? (
        <p className="dm__empty dm__panel">You have not posted anything yet.</p>
      ) : (
        myDemands.map((d: Demand) => (
          <DemandCustomerCard key={d.id} demand={d} userId={userId} onChange={refresh} version={v} />
        ))
      )}
    </motion.div>
  );
}
