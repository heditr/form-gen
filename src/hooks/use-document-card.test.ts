import { describe, test, expect } from 'vitest';
import {
  applyRequestedToSlot,
  canTurnOffRequestedForSlot,
  reconcileDocumentProspectsForConfig,
} from './use-document-card';
import type { DocumentCardData, DocumentCardProspectConfig } from '@/types/form-descriptor';
import { getSlotDescriptors } from '@/utils/document-card-slots';

describe('use-document-card helpers', () => {
  test('given a slot with files, cannot turn off requested via applyRequestedToSlot', () => {
    const data: DocumentCardData = {
      requested: true,
      files: [{ id: 'f1', url: '', filename: 'a.txt', uploadedAt: '' }],
    };
    const slot = getSlotDescriptors({
      docType: 'd',
      category: 'uploadableByProspect',
      layout: 'single',
    })[0];
    expect(applyRequestedToSlot({ data, slot, requested: false })).toBeNull();
  });

  test('given an empty slot, should apply requested toggle', () => {
    const data: DocumentCardData = {
      requested: true,
      files: [],
    };
    const slot = getSlotDescriptors({
      docType: 'd',
      category: 'uploadableByProspect',
      layout: 'single',
    })[0];
    const next = applyRequestedToSlot({ data, slot, requested: false });
    expect(next?.requested).toBe(false);
  });

  test('given prospect config adds one id, should keep existing rows and append default slot', () => {
    const cfg: DocumentCardProspectConfig[] = [
      { id: 'p1', name: 'One', requestedDefault: true },
      { id: 'p2', name: 'Two' },
    ];
    const value: DocumentCardData = {
      requested: false,
      files: [],
      prospects: {
        p1: { requested: true, files: [{ id: 'f', url: '', filename: 'a', uploadedAt: '' }] },
      },
    };
    const next = reconcileDocumentProspectsForConfig(value, cfg);
    expect(Object.keys(next.prospects ?? {})).toEqual(['p1', 'p2']);
    expect(next.prospects?.p1.files).toHaveLength(1);
    expect(next.prospects?.p2.requested).toBe(false);
  });

  test('canTurnOffRequestedForSlot should be false when there are files', () => {
    expect(canTurnOffRequestedForSlot(2)).toBe(false);
    expect(canTurnOffRequestedForSlot(0)).toBe(true);
  });
});
