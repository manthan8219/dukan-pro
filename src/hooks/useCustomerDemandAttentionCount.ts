import { useCallback, useEffect, useState } from 'react';
import {
  getNotificationSummary,
  markNotificationsRead,
  NOTIFICATIONS_CHANGED_EVENT,
} from '../api/notifications';

const POLL_MS = 55_000;

/**
 * Backend-driven: customer app bell (quotations + future order updates).
 * Opening Requests marks quotation notifications read; other types stay until opened from the bell.
 */
export function useCustomerDemandAttentionCount(
  userId: string | null,
  demandsRouteActive: boolean,
): number {
  const [count, setCount] = useState(0);

  const refreshSummary = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    try {
      const s = await getNotificationSummary(userId);
      setCount(s.customerAppUnread);
    } catch {
      /* keep last count */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (demandsRouteActive) {
          const s = await markNotificationsRead(userId, {
            types: ['CUSTOMER_NEW_QUOTATION'],
          });
          if (!cancelled) setCount(s.customerAppUnread);
        } else {
          await refreshSummary();
        }
      } catch {
        if (!cancelled) void refreshSummary();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, demandsRouteActive, refreshSummary]);

  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(() => void refreshSummary(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshSummary();
    };
    const onCustom = () => void refreshSummary();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onCustom);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onCustom);
    };
  }, [userId, refreshSummary]);

  return count;
}
