import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { registerContent } from '../../api/content';
import {
  listShopDemandInvitations,
  rejectDemandInvitation,
  submitDemandQuotation,
  type ShopDemandInvitation,
} from '../../api/demandInvitations';
import { NOTIFICATIONS_CHANGED_EVENT } from '../../api/notifications';
import { SELLER_PENDING_INVITES_CHANGED_EVENT } from '../../hooks/useSellerNotificationCounts';
import { loadBillingProfile } from './billingStorage';
import type { SellerOutletContext } from './SellerLayout';
import '../../demands/demands.css';

function formatMinorInr(minor: number | null): string {
  if (minor == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function SellerDemandBoardPage() {
  const { shopId } = useOutletContext<SellerOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [rows, setRows] = useState<ShopDemandInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState<Record<string, string>>({});
  const [billUrl, setBillUrl] = useState<Record<string, string>>({});

  const shopNameDefault = loadBillingProfile().businessName.trim() || 'My shop';

  const refresh = useCallback(() => {
    if (!shopId) return;
    setError(null);
    setLoading(true);
    void listShopDemandInvitations(shopId)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load invitations'))
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const inviteId = searchParams.get('invite');
    if (!inviteId || rows.length === 0) return;
    const t = window.setTimeout(() => {
      const el = cardRefs.current[inviteId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.classList.add('dm__card--flash');
        window.setTimeout(() => el.classList.remove('dm__card--flash'), 2200);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('invite');
      setSearchParams(next, { replace: true });
    }, 120);
    return () => window.clearTimeout(t);
  }, [searchParams, rows, setSearchParams]);

  async function onReject(inv: ShopDemandInvitation) {
    const reason = window.prompt('Optional reason for declining (or leave blank)') ?? '';
    setBusyId(inv.invitationId);
    setError(null);
    try {
      await rejectDemandInvitation(shopId!, inv.invitationId, reason.trim() || null);
      refresh();
      window.dispatchEvent(new Event(SELLER_PENDING_INVITES_CHANGED_EVENT));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onSubmitQuote(inv: ShopDemandInvitation) {
    const text = (quoteText[inv.invitationId] ?? '').trim();
    if (!text) {
      setError('Enter quotation details for the customer.');
      return;
    }
    setBusyId(inv.invitationId);
    setError(null);
    try {
      let docId: string | null = null;
      const url = (billUrl[inv.invitationId] ?? '').trim();
      if (url) {
        if (!url.startsWith('http')) {
          setError('Attachment must be a public http(s) URL.');
          setBusyId(null);
          return;
        }
        const isPdf = /\.pdf(\?|$)/i.test(url);
        const c = await registerContent({
          storageUrl: url,
          kind: isPdf ? 'DOCUMENT' : 'IMAGE',
          mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
        });
        docId = c.id;
      }
      await submitDemandQuotation(shopId!, inv.invitationId, {
        quotationText: text,
        quotationDocumentContentId: docId,
      });
      setQuoteText((q) => ({ ...q, [inv.invitationId]: '' }));
      setBillUrl((b) => ({ ...b, [inv.invitationId]: '' }));
      refresh();
      window.dispatchEvent(new Event(SELLER_PENDING_INVITES_CHANGED_EVENT));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!shopId) {
    return (
      <div className="dm">
        <div className="sdash__panel">
          <h2 className="dm__title" style={{ marginBottom: '0.5rem' }}>
            Demand board
          </h2>
          <p className="dm__lead">
            Link a shop on this device first (shop setup), then you can respond to customer requests you are in range
            for.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dm" style={{ maxWidth: 800 }}>
      <div className="sdash__panel" style={{ marginBottom: '1rem' }}>
        <h2 className="dm__title" style={{ marginBottom: '0.35rem' }}>
          Demand board
        </h2>
        <p className="dm__lead" style={{ marginBottom: 0 }}>
          Customer requests published near <strong>{shopNameDefault}</strong> (you were inside their delivery radius).
          Reject or send a quotation with optional bill/PDF link.
        </p>
      </div>

      {error ? <p className="dm__err" style={{ marginBottom: '0.75rem' }}>{error}</p> : null}

      {loading ? (
        <div className="dm__panel">
          <p className="dm__empty">Loading invitations…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="dm__panel">
          <p className="dm__empty">
            No open invitations. When a customer publishes a request and your shop is in range, it appears here.
          </p>
        </div>
      ) : (
        rows.map((inv) => (
          <article
            key={inv.invitationId}
            className="dm__card"
            ref={(el) => {
              cardRefs.current[inv.invitationId] = el;
            }}
          >
            <h3 className="dm__cardTitle">{inv.demandTitle}</h3>
            <p className="dm__cardMeta">
              Receipt order: <strong>{formatMinorInr(inv.receiptOrderTotalMinor)}</strong>
              {inv.demandBudgetHint ? <> · Budget: {inv.demandBudgetHint}</> : null}
            </p>
            {inv.customerReceiptImageUrl ? (
              <div className="dm__receiptPreview" style={{ marginBottom: '0.65rem' }}>
                <img src={inv.customerReceiptImageUrl} alt="Customer receipt" />
              </div>
            ) : null}
            <p className="dm__cardBody">{inv.demandDetails}</p>

            <p className="dm__cardMeta">
              Your status:{' '}
              <strong>
                {inv.responseKind === 'PENDING'
                  ? 'Action needed'
                  : inv.responseKind === 'REJECTED'
                    ? 'Declined'
                    : 'Quotation sent'}
              </strong>
            </p>

            {inv.responseKind === 'REJECTED' && inv.rejectReason ? (
              <p className="dm__cardMeta">Reason: {inv.rejectReason}</p>
            ) : null}

            {inv.responseKind === 'QUOTED' ? (
              <div className="dm__panel" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                <p className="dm__cardBody" style={{ marginBottom: '0.35rem' }}>
                  {inv.quotationText}
                </p>
                {inv.quotationDocumentUrl ? (
                  <a href={inv.quotationDocumentUrl} className="dm__link" target="_blank" rel="noreferrer">
                    Attached bill / PDF
                  </a>
                ) : null}
              </div>
            ) : null}

            {inv.responseKind === 'PENDING' ? (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <button
                    type="button"
                    className="dm__btn dm__btn--ghost dm__btn--sm"
                    disabled={busyId === inv.invitationId}
                    onClick={() => void onReject(inv)}
                  >
                    Reject
                  </button>
                </div>
                <label className="dm__label">Your quotation (required)</label>
                <textarea
                  className="dm__textarea"
                  style={{ minHeight: '4.5rem' }}
                  placeholder="Price breakdown, delivery time, brands…"
                  value={quoteText[inv.invitationId] ?? ''}
                  onChange={(e) =>
                    setQuoteText((q) => ({ ...q, [inv.invitationId]: e.target.value }))
                  }
                />
                <label className="dm__label">Bill, PDF, or quote image URL (optional)</label>
                <input
                  className="dm__input"
                  placeholder="https://…/quote.pdf or .jpg"
                  value={billUrl[inv.invitationId] ?? ''}
                  onChange={(e) =>
                    setBillUrl((b) => ({ ...b, [inv.invitationId]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="dm__btn dm__btn--primary"
                  style={{ marginTop: '0.35rem' }}
                  disabled={busyId === inv.invitationId}
                  onClick={() => void onSubmitQuote(inv)}
                >
                  Submit quotation
                </button>
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
