import type { ShopResponse } from './createShop';
import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export async function listShopsForUser(userId: string): Promise<ShopResponse[]> {
  const res = await fetch(`${getApiBase()}/users/${userId}/shops`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopResponse[];
}
