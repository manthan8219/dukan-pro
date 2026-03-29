import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listNotifications,
  markOneNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  type NotificationListItem,
  type NotificationType,
} from '../api/notifications';
import './NotificationBell.css';

type NotificationBellProps = {
  userId: string;
  types: NotificationType[];
  badgeCount: number;
  /** customer = bell in buyer header; seller = seller top bar */
  variant: 'customer' | 'seller';
  /** e.g. close seller drawer when opening the popover */
  onPopoverOpen?: () => void;
};

function contextStr(ctx: Record<string, unknown> | null, key: string): string {
  if (!ctx) return '';
  const v = ctx[key];
  return typeof v === 'string' ? v : '';
}

function typeLabel(t: NotificationListItem['type']): string {
  switch (t) {
    case 'CUSTOMER_NEW_QUOTATION':
      return 'New quotation';
    case 'CUSTOMER_ORDER_UPDATE':
      return 'Order update';
    case 'SELLER_NEW_ORDER':
      return 'New order';
    case 'SELLER_MONTHLY_INSIGHTS':
      return 'Monthly summary';
    case 'INVITATION':
      return 'Invitation';
    case 'SELLER_DEMAND_INVITATION':
      return 'Buyer request';
    default:
      return 'Update';
  }
}

function navigateForNotification(
  navigate: ReturnType<typeof useNavigate>,
  item: NotificationListItem,
): void {
  if (item.type === 'CUSTOMER_NEW_QUOTATION') {
    const demandId = contextStr(item.context, 'demandId');
    navigate(
      demandId
        ? `/app/customer/demands?quotes=${encodeURIComponent(demandId)}`
        : '/app/customer/demands',
    );
    return;
  }
  if (item.type === 'CUSTOMER_ORDER_UPDATE') {
    navigate('/app/customer');
    return;
  }
  if (item.type === 'SELLER_NEW_ORDER') {
    const orderId = contextStr(item.context, 'orderId');
    navigate(
      orderId
        ? `/app/seller/orders?order=${encodeURIComponent(orderId)}`
        : '/app/seller/orders',
    );
    return;
  }
  if (item.type === 'SELLER_MONTHLY_INSIGHTS') {
    navigate('/app/seller');
    return;
  }
  if (item.type === 'SELLER_DEMAND_INVITATION') {
    const inv = item.invitationId ?? '';
    navigate(
      inv ? `/app/seller/demands?invite=${encodeURIComponent(inv)}` : '/app/seller/demands',
    );
    return;
  }
  if (item.type === 'INVITATION') {
    const kind = contextStr(item.context, 'invitationKind');
    if (kind === 'DEMAND_SHOP') {
      const inv =
        (item.invitationId ?? contextStr(item.context, 'invitationId')).trim() || '';
      navigate(
        inv ? `/app/seller/demands?invite=${encodeURIComponent(inv)}` : '/app/seller/demands',
      );
      return;
    }
    navigate('/app/seller');
    return;
  }
}

export function NotificationBell({
  userId,
  types,
  badgeCount,
  variant,
  onPopoverOpen,
}: NotificationBellProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const typesRef = useRef(types);
  typesRef.current = types;

  const loadList = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await listNotifications(userId, {
        types: typesRef.current,
        limit: 30,
        unreadOnly: true,
      });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    onPopoverOpen?.();
    void loadList();
  }, [open, loadList, onPopoverOpen]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onPick(item: NotificationListItem) {
    try {
      await markOneNotificationRead(userId, item.id);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch {
      /* still navigate */
    }
    setOpen(false);
    navigateForNotification(navigate, item);
  }

  const triggerClass = variant === 'customer' ? 'cust__iconBtn' : 'sdash__notifBtn';

  return (
    <div className={`nb ${variant === 'customer' ? 'nb--cust' : 'nb--seller'}`} ref={wrapRef}>
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="dialog"
        aria-label={
          badgeCount > 0
            ? `Notifications, ${badgeCount} unread. Open list`
            : 'Notifications. Open list'
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className={variant === 'customer' ? 'cust__notifGlyph' : 'sdash__notifGlyph'} aria-hidden>
          🔔
        </span>
        {badgeCount > 0 ? (
          <span className={variant === 'customer' ? 'cust__cartBadge' : 'sdash__notifBadge'}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="nb__popover" id={listId} role="dialog" aria-label="Notifications">
          <h2 className="nb__popoverTitle">Your notifications</h2>
          {loading ? <p className="nb__hint">Loading…</p> : null}
          {error ? <p className="nb__err">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="nb__empty">No new notifications right now.</p>
          ) : null}
          {!loading && !error && rows.length > 0 ? (
            <ul className="nb__list" role="list">
              {rows.map((item) => (
                <li key={item.id}>
                  <button type="button" className="nb__item" onClick={() => void onPick(item)}>
                    <span className="nb__itemKind">{typeLabel(item.type)}</span>
                    <span className="nb__itemTitle">{item.title}</span>
                    {item.body ? <span className="nb__itemBody">{item.body}</span> : null}
                    <span className="nb__itemTime">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
