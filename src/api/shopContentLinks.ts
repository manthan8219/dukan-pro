import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export async function attachShopContentLink(
  shopId: string,
  contentId: string,
  sortOrder?: number,
): Promise<void> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}/content-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentId,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
}
