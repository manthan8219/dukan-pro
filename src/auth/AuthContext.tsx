import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { syncAuthWithBackend, type BackendSession } from '../api/authSync';
import { listShopsForUser } from '../api/listShops';
import { getFirebaseAuth, isFirebaseAuthConfigured } from '../firebase/config';
import { firebaseSignInWithGoogle } from '../firebase/googleSignIn';
import {
  clearBackendUserId,
  clearPersistedRole,
  clearSession,
  setBackendUserId,
  setLastShopId,
  setRole,
  setSellerOnboardingComplete,
  setUserId,
} from './session';

type AuthContextValue = {
  user: User | null;
  /** True until the first Firebase auth state event (or immediately if Firebase is not configured). */
  loading: boolean;
  firebaseConfigured: boolean;
  /** True while POST /auth/sync is in flight for the signed-in user. */
  sessionSyncing: boolean;
  /** Server user profile after a successful sync; null if not signed in or sync failed. */
  backendProfile: BackendSession | null;
  /** Error message from the last sync attempt (cleared on success). */
  sessionError: string | null;
  /** Re-run sync with the current Firebase user (e.g. after PATCH role). Returns the new profile or null on failure. */
  refreshBackendSession: () => Promise<BackendSession | null>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionSyncing, setSessionSyncing] = useState(false);
  const [backendProfile, setBackendProfile] = useState<BackendSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const firebaseConfigured = isFirebaseAuthConfigured();
  /** Only the latest /auth/sync may update React state (avoids stale overwrites when Firebase re-emits auth). */
  const syncGenRef = useRef(0);
  const nextSyncGen = () => ++syncGenRef.current;

  const refreshBackendSession = useCallback(async (): Promise<BackendSession | null> => {
    const u = getFirebaseAuth().currentUser;
    if (!u) {
      return null;
    }
    const gen = nextSyncGen();
    setSessionSyncing(true);
    setSessionError(null);
    try {
      const profile = await syncAuthWithBackend(u);
      if (gen !== syncGenRef.current) {
        return null;
      }
      setBackendUserId(profile.id);
      setBackendProfile(profile);
      if (profile.role === 'PENDING') {
        clearPersistedRole();
      } else if (profile.role === 'SELLER') {
        setRole('seller');
      } else {
        setRole('customer');
      }
      if (profile.role === 'SELLER' && profile.sellerOnboardingComplete) {
        try {
          const shops = await listShopsForUser(profile.id);
          const first = shops[0];
          if (first) {
            setLastShopId(first.id);
            setSellerOnboardingComplete();
          }
        } catch {
          /* optional */
        }
      }
      return profile;
    } catch (e) {
      if (gen === syncGenRef.current) {
        setSessionError(e instanceof Error ? e.message : 'Sync failed');
        setBackendProfile(null);
        clearBackendUserId();
      }
      return null;
    } finally {
      if (gen === syncGenRef.current) {
        setSessionSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (next) {
        setUserId(next.uid);
        const gen = nextSyncGen();
        setSessionSyncing(true);
        setSessionError(null);
        void (async () => {
          try {
            const profile = await syncAuthWithBackend(next);
            if (gen !== syncGenRef.current) {
              return;
            }
            setBackendUserId(profile.id);
            setBackendProfile(profile);
            if (profile.role === 'PENDING') {
              clearPersistedRole();
            } else if (profile.role === 'SELLER') {
              setRole('seller');
            } else {
              setRole('customer');
            }
            if (profile.role === 'SELLER' && profile.sellerOnboardingComplete) {
              try {
                const shops = await listShopsForUser(profile.id);
                const first = shops[0];
                if (first) {
                  setLastShopId(first.id);
                  setSellerOnboardingComplete();
                }
              } catch {
                /* optional */
              }
            }
          } catch (e) {
            if (gen === syncGenRef.current) {
              setSessionError(e instanceof Error ? e.message : 'Sync failed');
              setBackendProfile(null);
              clearBackendUserId();
            }
          } finally {
            if (gen === syncGenRef.current) {
              setSessionSyncing(false);
            }
          }
        })();
      } else {
        clearSession();
        setBackendProfile(null);
        setSessionError(null);
        setSessionSyncing(false);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [firebaseConfigured]);

  const signInWithGoogle = useCallback(async () => {
    await firebaseSignInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    if (!firebaseConfigured) {
      clearSession();
      setUser(null);
      setBackendProfile(null);
      setSessionError(null);
      return;
    }
    await firebaseSignOut(getFirebaseAuth());
  }, [firebaseConfigured]);

  const value = useMemo(
    () => ({
      user,
      loading,
      firebaseConfigured,
      sessionSyncing,
      backendProfile,
      sessionError,
      refreshBackendSession,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      loading,
      firebaseConfigured,
      sessionSyncing,
      backendProfile,
      sessionError,
      refreshBackendSession,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
