/**
 * Tests for document-card-builder — maps documents API payloads to FieldDescriptors.
 */

import { describe, test, expect } from 'vitest';
import { buildDocumentCardFields } from './document-card-builder';
import type { FieldDescriptor } from '@/types/form-descriptor';

describe('buildDocumentCardFields', () => {
  test('given a single-layout document with main slot files, should produce a document field with matching config and defaultValue', () => {
    const fields = buildDocumentCardFields([
      {
        documentType: 'proof_of_address',
        label: 'Proof of address',
        description: 'Recent utility bill',
        category: 'uploadableByProspect',
        subcategory: 'KYC',
        requiredByAgent: true,
        requestedDefault: true,
        optionalDefault: false,
        allowComment: true,
        file: { acceptedFormats: ['pdf'], multiple: false },
        slots: {
          main: {
            requested: true,
            optional: false,
            files: [
              {
                id: 'f1',
                url: 'https://example.com/bill.pdf',
                filename: 'bill.pdf',
                uploadedAt: '2026-05-01T12:00:00.000Z',
              },
            ],
          },
        },
      },
    ]);

    expect(fields).toHaveLength(1);
    expect(fields[0].id).toBe('proof_of_address');
    expect(fields[0].type).toBe('document');
    expect(fields[0].document?.layout).toBe('single');
    expect(fields[0].document?.docType).toBe('proof_of_address');
    expect(fields[0].document?.category).toBe('uploadableByProspect');
    expect(fields[0].document?.subcategory).toBe('KYC');
    expect(fields[0].document?.requiredByAgent).toBe(true);
    expect(fields[0].document?.allowOptional).toBe(true);
    expect(fields[0].document?.file).toEqual({ acceptedFormats: ['pdf'], multiple: false });
    expect(fields[0].defaultValue).toEqual({
      requested: true,
      optional: false,
      files: [
        {
          id: 'f1',
          url: 'https://example.com/bill.pdf',
          filename: 'bill.pdf',
          uploadedAt: '2026-05-01T12:00:00.000Z',
        },
      ],
    });
  });

  test('given only documentType, category, and empty main slot, should default to single layout and empty files', () => {
    const fields = buildDocumentCardFields([
      {
        documentType: 'passport',
        category: 'nominativeUploadableByProspect',
        slots: { main: {} },
      },
    ]);

    expect(fields[0].document?.layout).toBe('single');
    expect(fields[0].label).toBe('passport');
    expect(fields[0].defaultValue).toEqual({
      requested: false,
      files: [],
    });
  });

  test('given multiple slots without explicit layout, should infer perProspect and seed prospects config from slots', () => {
    const fields = buildDocumentCardFields([
      {
        documentType: 'identity_document',
        label: 'Identity',
        category: 'nominativeUploadableByProspect',
        slots: {
          'person-1': {
            label: 'Jane Doe',
            requested: true,
            optional: false,
            files: [{ id: 'a', url: 'https://ex.com/a.pdf', filename: 'a.pdf', uploadedAt: '2026-05-01T00:00:00.000Z' }],
          },
          'person-2': {
            label: 'John Smith',
            requested: false,
            optional: true,
            files: [],
          },
        },
      },
    ]);

    expect(fields[0].document?.layout).toBe('perProspect');
    expect(fields[0].document?.prospects).toEqual([
      { id: 'person-1', name: 'Jane Doe', requestedDefault: true, optionalDefault: false, defaultFiles: [{ id: 'a', url: 'https://ex.com/a.pdf', filename: 'a.pdf', uploadedAt: '2026-05-01T00:00:00.000Z' }] },
      { id: 'person-2', name: 'John Smith', requestedDefault: false, optionalDefault: true, defaultFiles: [] },
    ]);
    expect(fields[0].defaultValue).toEqual({
      requested: false,
      files: [],
      prospects: {
        'person-1': {
          requested: true,
          optional: false,
          files: [{ id: 'a', url: 'https://ex.com/a.pdf', filename: 'a.pdf', uploadedAt: '2026-05-01T00:00:00.000Z' }],
        },
        'person-2': {
          requested: false,
          optional: true,
          files: [],
        },
      },
    });
  });

  test('given prospectSource, should keep perProspect layout without deriving static prospects from slots', () => {
    const fields = buildDocumentCardFields([
      {
        documentType: 'id_doc',
        label: 'ID',
        category: 'nominativeUploadableByProspect',
        prospectSource: 'persons',
        requestedDefault: true,
        slots: {
          'p-1': { files: [{ id: 'x', url: 'https://ex.com/x.pdf', filename: 'x.pdf', uploadedAt: '2026-05-01T00:00:00.000Z' }] },
        },
      },
    ]);

    expect(fields[0].document?.layout).toBe('perProspect');
    expect(fields[0].document?.prospectSource).toBe('persons');
    expect(fields[0].document?.prospects).toBeUndefined();
    expect(fields[0].defaultValue).toMatchObject({
      requested: true,
      files: [],
      prospects: {
        'p-1': { requested: false, files: [{ id: 'x', url: 'https://ex.com/x.pdf', filename: 'x.pdf', uploadedAt: '2026-05-01T00:00:00.000Z' }] },
      },
    });
  });

  test('given fieldOverrides for a documentType, should shallow-merge onto the built field', () => {
    const override: Partial<FieldDescriptor> = {
      label: 'Overridden label',
      validation: [{ type: 'required', message: 'Required' }],
    };

    const fields = buildDocumentCardFields(
      [{ documentType: 'tax', category: 'agnostic', slots: { main: {} } }],
      { fieldOverrides: { tax: override } }
    );

    expect(fields[0].label).toBe('Overridden label');
    expect(fields[0].validation).toEqual([{ type: 'required', message: 'Required' }]);
  });
});
