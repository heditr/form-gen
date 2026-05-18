import { describe, test, expect } from 'vitest';
import {
  buildAcceptAttributeFromFormats,
  fileMatchesAcceptedFormats,
  parseAcceptedFormatTokens,
} from './accepted-file-formats';

describe('parseAcceptedFormatTokens', () => {
  test('given MIME types and extensions, should partition both', () => {
    expect(
      parseAcceptedFormatTokens(['application/pdf', '.PNG', 'jpeg'])
    ).toEqual({
      mimeTypes: ['application/pdf'],
      extensions: ['png', 'jpeg'],
    });
  });
});

describe('buildAcceptAttributeFromFormats', () => {
  test('given MIME-only formats, should emit MIME tokens for the file picker', () => {
    expect(buildAcceptAttributeFromFormats(['application/pdf', 'image/png'])).toBe(
      'application/pdf,image/png'
    );
  });

  test('given extension-only formats, should emit dotted extensions', () => {
    expect(buildAcceptAttributeFromFormats(['pdf', '.png'])).toBe('.pdf,.png');
  });

  test('given mixed MIME and extensions, should concatenate both styles', () => {
    expect(buildAcceptAttributeFromFormats(['application/pdf', 'png'])).toBe('application/pdf,.png');
  });
});

describe('fileMatchesAcceptedFormats', () => {
  test('given MIME whitelist and a PDF file with matching type, should accept', () => {
    const file = new File(['%PDF'], 'report.pdf', { type: 'application/pdf' });
    expect(fileMatchesAcceptedFormats(file, ['application/pdf'])).toBe(true);
  });

  test('given MIME whitelist and matching extension when type is empty, should accept via fallback map', () => {
    const file = new File(['x'], 'scan.png', { type: '' });
    expect(fileMatchesAcceptedFormats(file, ['image/png'])).toBe(true);
  });

  test('given extension whitelist, should accept by filename suffix', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/octet-stream' });
    expect(fileMatchesAcceptedFormats(file, ['pdf'])).toBe(true);
  });

  test('given MIME whitelist and wrong extension and non-matching type, should reject', () => {
    const file = new File(['x'], 'evil.exe', { type: 'application/octet-stream' });
    expect(fileMatchesAcceptedFormats(file, ['application/pdf'])).toBe(false);
  });
});
