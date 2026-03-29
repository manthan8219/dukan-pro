import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getFirebaseApp, isFirebaseAuthConfigured } from './config';

let analytics: Analytics | null = null;

/** Call once on startup; no-ops if Analytics isn’t supported (e.g. SSR) or not configured. */
export async function initFirebaseAnalytics(): Promise<void> {
  if (!isFirebaseAuthConfigured()) return;
  const mid = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
  if (!mid || typeof window === 'undefined') return;
  if (!(await isSupported())) return;
  try {
    analytics = getAnalytics(getFirebaseApp());
  } catch {
    analytics = null;
  }
}

export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}
