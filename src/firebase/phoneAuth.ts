import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { formatPhoneAuthError } from './authErrors';
import { getFirebaseAuth, isFirebaseAuthConfigured } from './config';

/** E.164, e.g. +919876543210 */
export function normalizeToE164(raw: string, defaultCountryCode = '91'): string {
  let s = raw.replace(/[\s-]/g, '');
  if (s.startsWith('+')) return s;
  if (s.startsWith('0')) s = s.slice(1);
  if (/^\d{10}$/.test(s)) return `+${defaultCountryCode}${s}`;
  if (/^\d+$/.test(s)) return `+${s}`;
  return s.startsWith('+') ? s : `+${s}`;
}

export function mapPhoneAuthError(code: string): string {
  return formatPhoneAuthError(code).message;
}

export function createInvisibleRecaptcha(containerId: string): RecaptchaVerifier {
  if (!isFirebaseAuthConfigured()) {
    throw new Error('Firebase is not configured.');
  }
  const auth = getFirebaseAuth();
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
  });
}

export async function requestPhoneOtp(phoneE164: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth();
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}
