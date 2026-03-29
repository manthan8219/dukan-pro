import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

/** Fire after any notification read/mutate so shell badges refetch. */
export const NOTIFICATIONS_CHANGED_EVENT = 'dukaanpro-notifications-changed';

/** Matches backend UserNotificationType. */
export type NotificationType =
  | 'INVITATION'
  | 'SELLER_DEMAND_INVITATION'
  | 'CUSTOMER_NEW_QUOTATION'
  | 'SELLER_NEW_ORDER'
  | 'SELLER_MONTHLY_INSIGHTS'
  | 'CUSTOMER_ORDER_UPDATE';

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  invitationId: string | null;
  dedupeKey?: string | null;
  context: Record<string, unknown> | null;
};

export type NotificationSummary = {
  totalUnread: number;
  sellerHubUnread: number;
  customerAppUnread: number;
  sellerDemandInvitesUnread: number;
  customerNewQuotationsUnread: number;
  unreadByType?: Record<string, number>;
};

export type MarkNotificationsReadPayload = {
  all?: boolean;
  types?: NotificationType[];
  demandId?: string;
};

export async function listNotifications(
  userId: string,
  opts?: { limit?: number; unreadOnly?: boolean; types?: string[] },
): Promise<NotificationListItem[]> {
  const p = new URLSearchParams();
  if (opts?.limit != null) p.set('limit', String(opts.limit));
  if (opts?.unreadOnly === false) p.set('unreadOnly', 'false');
  if (opts?.types?.length) p.set('types', opts.types.join(','));
  const qs = p.toString();
  const url = `${getApiBase()}/users/${userId}/notifications${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as NotificationListItem[];
}

export async function markOneNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationSummary> {
  const res = await fetch(
    `${getApiBase()}/users/${userId}/notifications/${notificationId}/read`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as NotificationSummary;
}

export async function getNotificationSummary(userId: string): Promise<NotificationSummary> {
  const res = await fetch(`${getApiBase()}/users/${userId}/notifications/summary`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as NotificationSummary;
}

export async function markNotificationsRead(
  userId: string,
  payload: MarkNotificationsReadPayload = {},
): Promise<NotificationSummary> {
  const res = await fetch(`${getApiBase()}/users/${userId}/notifications/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as NotificationSummary;
}
