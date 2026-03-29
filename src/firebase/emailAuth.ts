import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import { type AuthErrorIntent, formatEmailAuthError } from './authErrors';
import { getFirebaseAuth, isFirebaseAuthConfigured } from './config';

export type { AuthErrorIntent };

/** Plain message only (e.g. legacy inline). Prefer `formatEmailAuthError` + toast for UX. */
export function mapEmailAuthError(code: string, intent: AuthErrorIntent = 'signin'): string {
  return formatEmailAuthError(code, intent).message;
}

export async function firebaseSignInWithEmail(email: string, password: string): Promise<UserCredential> {
  if (!isFirebaseAuthConfigured()) throw new Error('Firebase is not configured.');
  const auth = getFirebaseAuth();
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function firebaseRegisterWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<UserCredential> {
  if (!isFirebaseAuthConfigured()) throw new Error('Firebase is not configured.');
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const name = displayName?.trim();
  if (name && cred.user) {
    await updateProfile(cred.user, { displayName: name });
  }
  return cred;
}

export async function firebaseSendPasswordReset(email: string): Promise<void> {
  if (!isFirebaseAuthConfigured()) throw new Error('Firebase is not configured.');
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email.trim());
}
