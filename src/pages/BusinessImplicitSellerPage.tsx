import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { patchUser } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { resolvePostLoginDestination } from '../auth/postLoginRoute';
import { navigateInSplitApp, urlForBusinessPath, urlForCustomerPath } from '../config/appOrigins';
import { useAuthFlash } from '../auth/AuthFlashContext';
import { getBackendUserId } from '../auth/session';

async function resolveBackendUserId(refresh: () => Promise<unknown>): Promise<string | null> {
  let bid = getBackendUserId();
  if (bid) return bid;
  await refresh();
  return getBackendUserId();
}

/**
 * Business subdomain only: no customer/seller picker — new accounts become sellers and go to
 * onboarding or the seller hub; buyer-only accounts are sent to the customer app.
 */
export function BusinessImplicitSellerPage() {
  const navigate = useNavigate();
  const { backendProfile, sessionSyncing, refreshBackendSession } = useAuth();
  const { showFlash } = useAuthFlash();
  const assignStartedRef = useRef(false);

  useEffect(() => {
    if (sessionSyncing || !backendProfile) return;

    if (backendProfile.isSeller) {
      navigateInSplitApp(navigate, resolvePostLoginDestination(backendProfile), { replace: true });
      return;
    }

    if (backendProfile.isCustomer) {
      navigateInSplitApp(navigate, urlForCustomerPath('/app/customer'), { replace: true });
      return;
    }

    if (assignStartedRef.current) return;
    assignStartedRef.current = true;

    void (async () => {
      try {
        const bid = await resolveBackendUserId(refreshBackendSession);
        if (!bid) {
          assignStartedRef.current = false;
          showFlash({
            title: 'Could not set up seller',
            message: 'Your account is not synced with the server yet. Check the API is running and try again.',
            variant: 'error',
          });
          return;
        }
        await patchUser(bid, { isSeller: true });
        const profile = await refreshBackendSession();
        const goSellerApp = profile?.isSeller && profile.sellerOnboardingComplete;
        navigateInSplitApp(
          navigate,
          urlForBusinessPath(goSellerApp ? '/app/seller' : '/onboarding/seller'),
          { replace: true },
        );
      } catch (e) {
        assignStartedRef.current = false;
        showFlash({
          title: 'Could not set up seller',
          message: e instanceof Error ? e.message : 'Request failed',
          variant: 'error',
        });
      }
    })();
  }, [sessionSyncing, backendProfile, navigate, refreshBackendSession, showFlash]);

  return (
    <div className="authWait">
      <div className="authWait__card" role="status" aria-live="polite">
        <div className="authWait__spinner" aria-hidden="true" />
        <p className="authWait__title">Preparing your seller workspace…</p>
      </div>
    </div>
  );
}
