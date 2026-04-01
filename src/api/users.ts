import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type PatchUserPayload = {
  isCustomer?: boolean;
  isSeller?: boolean;
  sellerOnboardingComplete?: boolean;
};

export async function patchUser(userId: string, payload: PatchUserPayload): Promise<void> {
  const res = await fetch(`${getApiBase()}/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
}
