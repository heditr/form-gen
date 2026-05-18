/**
 * Side-effect wrappers for descriptor-driven document uploads.
 *
 * Pure URL helpers accept `{id}` placeholders (percent-encoded) so server templates stay safe when
 * file ids contain reserved characters.
 */

import type { DocumentCardConfig, UploadedFileMeta } from '@/types/form-descriptor';

/** Default Next route used when {@link DocumentCardConfig.file.uploadUrl} is omitted. */
export const defaultUploadUrl = '/api/upload';

/**
 * Resolves descriptor `deleteUrl` templates; substitutes first `{id}` with an encoded reference
 * (`UploadedFileMeta.id`, falling back to `url` elsewhere in callers).
 */
export function resolveDeleteUrl(deleteUrl: string, fileReference: string): string {
  return deleteUrl.includes('{id}')
    ? deleteUrl.replace('{id}', encodeURIComponent(fileReference))
    : deleteUrl;
}

/** Same templating rule as {@link resolveDeleteUrl} for optional `metadataPatchUrl`. */
export function resolveMetadataPatchUrl(patchUrl: string, fileReference: string): string {
  return patchUrl.includes('{id}')
    ? patchUrl.replace('{id}', encodeURIComponent(fileReference))
    : patchUrl;
}

/** Multipart POST of one file plus `fieldId` / `docType`; maps JSON into {@link UploadedFileMeta}. */
export async function uploadDocumentFile(
  file: File,
  fieldId: string,
  config: DocumentCardConfig,
  fetchImpl: typeof fetch = fetch
): Promise<UploadedFileMeta> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fieldId', fieldId);
  formData.append('docType', config.docType);

  const response = await fetchImpl(config.file?.uploadUrl ?? defaultUploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(
      typeof error.error === 'string' ? error.error : `Upload failed with status ${response.status}`
    );
  }

  const result = await response.json();
  const url = result.url ?? result.fileUrl ?? result.path ?? '';

  return {
    id: result.id ?? url ?? file.name,
    url,
    filename: result.filename ?? file.name,
    uploadedAt: result.uploadedAt ?? new Date().toISOString(),
    sizeBytes: result.sizeBytes ?? file.size,
    contentType: result.contentType ?? file.type,
    clientConfirmationRequested: result.clientConfirmationRequested,
    frontOfficeName: result.frontOfficeName,
  };
}

/** DELETE when `config.file.deleteUrl` is defined; otherwise no-op (caller may still drop from form state). */
export async function deleteDocumentFile(
  file: UploadedFileMeta,
  config: DocumentCardConfig,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (!config.file?.deleteUrl) {
    return;
  }

  const response = await fetchImpl(
    resolveDeleteUrl(config.file.deleteUrl, file.id || file.url),
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(
      typeof error.error === 'string' ? error.error : `Delete failed with status ${response.status}`
    );
  }
}

/** Subset persisted via optional PATCH (see descriptor `metadataPatchUrl`). */
export interface FileMetadataPatch {
  clientConfirmationRequested?: boolean;
  frontOfficeName?: string;
}

/** PATCH JSON metadata when `config.file.metadataPatchUrl` is present; skips when omitted. */
export async function patchDocumentFileMetadata(
  fileId: string,
  patch: FileMetadataPatch,
  config: DocumentCardConfig,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const rawUrl = config.file?.metadataPatchUrl;
  if (!rawUrl) {
    return;
  }

  const url = resolveMetadataPatchUrl(rawUrl, fileId);
  const response = await fetchImpl(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Metadata update failed' }));
    throw new Error(
      typeof error.error === 'string'
        ? error.error
        : `Metadata update failed with status ${response.status}`
    );
  }
}
