import { describe, test, expect, vi } from 'vitest';
import {
  resolveDeleteUrl,
  resolveMetadataPatchUrl,
  uploadDocumentFile,
  deleteDocumentFile,
  patchDocumentFileMetadata,
} from './document-card-api';

describe('resolveDeleteUrl', () => {
  test('given a templated delete URL, should encode the id placeholder', () => {
    expect(resolveDeleteUrl('/api/files/{id}', 'a/b')).toBe('/api/files/a%2Fb');
  });

  test('given a non-templated delete URL, should return it unchanged', () => {
    expect(resolveDeleteUrl('/api/remove', 'x')).toBe('/api/remove');
  });
});

describe('resolveMetadataPatchUrl', () => {
  test('given a PATCH URL with placeholder, should substitute encoded id', () => {
    expect(resolveMetadataPatchUrl('/meta/{id}', 'id:with')).toBe('/meta/id%3Awith');
  });
});

describe('uploadDocumentFile', () => {
  test('given a successful upload response, should map fields to UploadedFileMeta', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'uploaded-1',
        url: 'https://ex/u.pdf',
        filename: 'u.pdf',
        uploadedAt: '2026-01-01T00:00:00.000Z',
      }),
    })) as unknown as typeof fetch;

    const config = {
      docType: 'id_doc',
      category: 'uploadableByProspect' as const,
      layout: 'single' as const,
    };

    const file = new File(['x'], 'local.pdf', { type: 'application/pdf' });

    const meta = await uploadDocumentFile(file, 'fieldA', config, fetchMock);

    expect(meta.id).toBe('uploaded-1');
    expect(meta.filename).toBe('u.pdf');
    expect(fetchMock).toHaveBeenCalledWith('/api/upload', expect.objectContaining({ method: 'POST' }));
  });
});

describe('deleteDocumentFile', () => {
  test('given no delete URL, should no-op without calling fetch', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    await deleteDocumentFile(
      {
        id: 'f1',
        url: '',
        filename: 'a',
        uploadedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        docType: 'd',
        category: 'prefilledOnly',
        layout: 'single',
      },
      fetchMock
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('given delete URL, should call DELETE with resolved URL', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    await deleteDocumentFile(
      {
        id: '99',
        url: '',
        filename: 'a',
        uploadedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        docType: 'd',
        category: 'prefilledOnly',
        layout: 'single',
        file: { deleteUrl: '/api/f/{id}' },
      },
      fetchMock
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/f/99', { method: 'DELETE' });
  });
});

describe('patchDocumentFileMetadata', () => {
  test('given no metadata URL, should not fetch', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    await patchDocumentFileMetadata(
      'f',
      { frontOfficeName: 'x' },
      {
        docType: 'd',
        category: 'prefilledOnly',
        layout: 'single',
      },
      fetchMock
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('given metadata URL with placeholder, should PATCH JSON body', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    await patchDocumentFileMetadata(
      'f-1',
      { clientConfirmationRequested: true, frontOfficeName: 'Title' },
      {
        docType: 'd',
        category: 'prefilledOnly',
        layout: 'single',
        file: { metadataPatchUrl: '/api/meta/{id}' },
      },
      fetchMock
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meta/f-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          clientConfirmationRequested: true,
          frontOfficeName: 'Title',
        }),
      })
    );
  });
});
