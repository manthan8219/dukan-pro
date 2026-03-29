import { useCallback, useEffect, useState } from 'react';
import { getNotificationSummary, NOTIFICATIONS_CHANGED_EVENT } from '../api/notifications';

const POLL_MS = 55_000;

/** Fire after the seller responds so badges refresh without waiting for the poll. */
export const SELLER_PENDING_INVITES_CHANGED_EVENT = 'dukaanpro-pending-invites-changed';

/**
 * Backend-driven counts: demand-board invitations vs full seller hub bell (orders, insights, …).
 */
export function useSellerNotificationCounts(sellerUserId: string | null): {
  demandInvitesUnread: number;
  sellerHubUnread: number;
} {
  const [demandInvitesUnread, setDemandInvitesUnread] = useState(0);
  const [sellerHubUnread, setSellerHubUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!sellerUserId) {
      setDemandInvitesUnread(0);
      setSellerHubUnread(0);
      return;
    }
    try {
      const s = await getNotificationSummary(sellerUserId);
      setDemandInvitesUnread(s.sellerDemandInvitesUnread);
      setSellerHubUnread(s.sellerHubUnread);
    } catch {
      /* keep last counts */
    }
  }, [sellerUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sellerUserId) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onCustom = () => void refresh();
    const onNotif = () => void refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(SELLER_PENDING_INVITES_CHANGED_EVENT, onCustom);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotif);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(SELLER_PENDING_INVITES_CHANGED_EVENT, onCustom);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotif);
    };
  }, [sellerUserId, refresh]);

  return { demandInvitesUnread, sellerHubUnread };
}
