import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type UploadVisibility = 'public' | 'private';

export type PresignUploadResponse = {
  method: string;
  url: string;
  headers: Record<string, string>;
  storageUrl: string;
  bucket: string;
  objectKey: string;
};

export async function fetchStorageUploadEnabled(): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/storage/status`);
  if (!res.ok) {
    return false;
  }
  const j = (await res.json()) as { uploadsEnabled?: boolean };
  return Boolean(j.uploadsEnabled);
}

export async function presignUpload(payload: {
  visibility: UploadVisibility;
  fileName: string;
  contentType: string;
}): Promise<PresignUploadResponse> {
  const res = await fetch(`${getApiBase()}/storage/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as PresignUploadResponse;
}

export async function putFileToPresignedUrl(
  presign: PresignUploadResponse,
  file: File,
): Promise<void> {
  const res = await fetch(presign.url, {
    method: presign.method as 'PUT',
    body: file,
    headers: presign.headers,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `Upload failed (${res.status})`);
  }
}
