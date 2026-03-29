import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type ContentKind = 'IMAGE' | 'DOCUMENT' | 'BILL' | 'OTHER';

export type ContentRecord = {
  id: string;
  storageUrl: string;
  kind: ContentKind;
  mimeType: string | null;
};

export async function registerContent(payload: {
  storageUrl: string;
  kind: ContentKind;
  mimeType?: string | null;
  originalFileName?: string | null;
  ownerUserId?: string | null;
}): Promise<ContentRecord> {
  const res = await fetch(`${getApiBase()}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storageUrl: payload.storageUrl,
      kind: payload.kind,
      mimeType: payload.mimeType ?? null,
      originalFileName: payload.originalFileName ?? null,
      ownerUserId: payload.ownerUserId ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ContentRecord;
}
