import { registerContent, type ContentKind, type ContentRecord } from './content';
import { presignUpload, putFileToPresignedUrl, type UploadVisibility } from './storage';

export async function uploadFileAndRegisterContent(
  file: File,
  opts: {
    visibility: UploadVisibility;
    kind: ContentKind;
    ownerUserId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<ContentRecord> {
  const contentType = file.type || 'application/octet-stream';
  const presign = await presignUpload({
    visibility: opts.visibility,
    fileName: file.name,
    contentType,
  });
  await putFileToPresignedUrl(presign, file);
  return registerContent({
    storageUrl: presign.storageUrl,
    kind: opts.kind,
    mimeType: file.type || null,
    originalFileName: file.name,
    ownerUserId: opts.ownerUserId ?? null,
    byteSize: String(file.size),
    metadata: opts.metadata ?? null,
  });
}
