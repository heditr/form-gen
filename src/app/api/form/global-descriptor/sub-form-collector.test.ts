/**
 * Tests for Sub-Form Collector Utility
 * 
 * Tests the utility that collects sub-form references from descriptors.
 */

import { describe, test, expect } from 'vitest';
import { collectSubFormReferences } from './sub-form-collector';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';

describe('sub-form-collector', () => {
  describe('collectSubFormReferences', () => {
    test('given descriptor with no sub-form references, should return empty array', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const refs = collectSubFormReferences(descriptor);
      expect(refs).toEqual([]);
    });

    test('given descriptor with sub-form references, should collect all unique refs', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [],
            subFormRef: 'address',
          },
          {
            id: 'block2',
            title: 'Block 2',
            fields: [],
            subFormRef: 'contact',
          },
          {
            id: 'block3',
            title: 'Block 3',
            fields: [],
            subFormRef: 'address', // Duplicate
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const refs = collectSubFormReferences(descriptor);
      expect(refs).toHaveLength(2);
      expect(refs).toContain('address');
      expect(refs).toContain('contact');
    });

    test('given descriptor with instance IDs, should still collect refs correctly', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'home',
          },
          {
            id: 'block2',
            title: 'Block 2',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'work',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const refs = collectSubFormReferences(descriptor);
      // Should only collect unique sub-form IDs, not instance IDs
      expect(refs).toEqual(['address']);
    });
  });
});
