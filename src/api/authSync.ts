import type { User } from 'firebase/auth';
import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type BackendSession = {
  id: string;
  role: 'CUSTOMER' | 'SELLER';
  sellerOnboardingComplete: boolean;
};

export async function syncAuthWithBackend(firebaseUser: User): Promise<BackendSession> {
  const dev = import.meta.env.VITE_SYNC_AUTH_DEV === 'true';
  const body: Record<string, string | undefined> = dev
    ? {
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email ?? undefined,
        displayName: firebaseUser.displayName ?? undefined,
        phoneNumber: firebaseUser.phoneNumber ?? undefined,
      }
    : { idToken: await firebaseUser.getIdToken() };

  const res = await fetch(`${getApiBase()}/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return (await res.json()) as BackendSession;
}
