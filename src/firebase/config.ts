import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const REQUIRED_FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/** Names of required env vars that are missing or blank (for UI hints; no values exposed). */
export function getMissingFirebaseAuthEnvKeys(): string[] {
  return REQUIRED_FIREBASE_ENV.filter((key) => {
    const v = import.meta.env[key as keyof ImportMetaEnv];
    return !v || !String(v).trim();
  });
}

export function isFirebaseAuthConfigured(): boolean {
  return getMissingFirebaseAuthEnvKeys().length === 0;
}

function firebaseConfig() {
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    ...(measurementId && String(measurementId).trim()
      ? { measurementId: String(measurementId).trim() }
      : {}),
  };
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseAuthConfigured()) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID in .env',
    );
  }
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig());
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
