/**
 * Tests for documents-rehydration-merge — surgical descriptor + formData updates.
 */

import { describe, test, expect } from 'vitest';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import {
  collectDocumentFieldIds,
  mergeDocumentsIntoDescriptor,
  mergeDocumentsIntoFormData,
  applyDocumentsRehydrationMerge,
  defaultDocumentsBlockId,
} from './documents-rehydration-merge';

const baseDescriptor = (): GlobalFormDescriptor => ({
  version: '1',
  blocks: [
    {
      id: 'identity',
      title: 'Identity',
      fields: [
        { id: 'country', type: 'text', label: 'Country', validation: [] },
        {
          id: 'old_doc',
          type: 'document',
          label: 'Old',
          validation: [],
          document: {
            docType: 'old_doc',
            category: 'agnostic',
            layout: 'single',
            allowOptional: true,
          },
          defaultValue: { requested: true, files: [{ id: 'x', url: '', filename: 'a.pdf', uploadedAt: '' }] },
        },
      ],
    },
    {
      id: defaultDocumentsBlockId,
      title: 'Documents',
      fields: [{ id: 'notes', type: 'text', label: 'Notes', validation: [] }],
    },
  ],
  submission: { url: '/api/submit', method: 'POST' },
});

describe('documents-rehydration-merge', () => {
  test('given replacement documents list, should strip prior document fields and append built fields to target block', () => {
    const descriptor = baseDescriptor();
    const next = mergeDocumentsIntoDescriptor(descriptor, [
      {
        documentType: 'passport',
        category: 'nominativeUploadableByProspect',
        targetBlockId: defaultDocumentsBlockId,
        slots: {
          main: {
            files: [{ id: 'p1', url: 'https://ex/p.pdf', filename: 'p.pdf', uploadedAt: '2026-05-01T00:00:00.000Z' }],
          },
        },
      },
    ]);

    const docFields = next.blocks.flatMap((b) => (b.fields ?? []).filter((f) => f.type === 'document'));
    expect(docFields.map((f) => f.id)).toEqual(['passport']);
    const docsBlock = next.blocks.find((b) => b.id === defaultDocumentsBlockId);
    expect(docsBlock?.fields?.some((f) => f.id === 'notes')).toBe(true);
    expect(docsBlock?.fields?.some((f) => f.id === 'passport')).toBe(true);
    const identityBlock = next.blocks.find((b) => b.id === 'identity');
    expect(identityBlock?.fields?.some((f) => f.type === 'document')).toBe(false);
  });

  test('given merge helper with formData, should drop removed document ids and seed new defaults', () => {
    const descriptor = baseDescriptor();
    const formData = {
      country: 'FR',
      old_doc: { requested: false, files: [] },
    };

    const { formData: nextFormData } = applyDocumentsRehydrationMerge({
      descriptor,
      formData,
      documents: [
        {
          documentType: 'passport',
          category: 'agnostic',
          slots: { main: {} },
        },
      ],
    });

    expect(nextFormData.old_doc).toBeUndefined();
    expect(nextFormData.passport).toEqual({ requested: false, files: [] });
    expect(nextFormData.country).toBe('FR');
  });

  test('collectDocumentFieldIds should list every document field id', () => {
    expect(collectDocumentFieldIds(baseDescriptor())).toEqual(new Set(['old_doc']));
  });

  test('mergeDocumentsIntoFormData preserves unrelated keys', () => {
    const built = [
      {
        id: 'a',
        type: 'document' as const,
        label: 'A',
        validation: [],
        document: { docType: 'a', category: 'agnostic' as const, layout: 'single' as const, allowOptional: true },
        defaultValue: { requested: false, files: [] },
      },
    ];
    const next = mergeDocumentsIntoFormData({ email: 'x@y.com' }, new Set(['gone']), built);
    expect(next.email).toBe('x@y.com');
    expect(next.gone).toBeUndefined();
    expect(next.a).toEqual({ requested: false, files: [] });
  });
});
