import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type RequireUserProps = {
  children: ReactNode;
};

export function RequireUser({ children }: RequireUserProps) {
  const location = useLocation();
  const { user, loading, firebaseConfigured, sessionSyncing, backendProfile } = useAuth();

  if (!firebaseConfigured) {
    return <Navigate to="/" replace state={{ from: location.pathname, needFirebase: true }} />;
  }

  if (loading || (user && sessionSyncing && !backendProfile)) {
    return (
      <div className="authWait">
        <div className="authWait__card" role="status" aria-live="polite">
          <div className="authWait__spinner" aria-hidden="true" />
          <p className="authWait__title">{user && sessionSyncing ? 'Syncing your account…' : 'Checking your session…'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}
