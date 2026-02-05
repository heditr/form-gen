/**
 * Tests for Sub-Form Resolver Utility
 * 
 * Tests the server-side sub-form resolution and merging logic.
 */

import { describe, test, expect } from 'vitest';
import { resolveSubForms } from './sub-form-resolver';
import type { GlobalFormDescriptor, SubFormDescriptor } from '@/types/form-descriptor';

describe('sub-form-resolver', () => {
  describe('resolveSubForms', () => {
    test('given a GlobalFormDescriptor with no sub-form references, should return descriptor unchanged', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'field1',
                type: 'text',
                label: 'Field 1',
                validation: [],
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const result = resolveSubForms(descriptor, new Map());

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].id).toBe('block1');
      expect(result.blocks[0].subFormRef).toBeUndefined();
    });

    test('given a GlobalFormDescriptor with subFormRef, should resolve and merge sub-form blocks', () => {
      const addressSubForm: SubFormDescriptor = {
        id: 'address',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [
              {
                id: 'line1',
                type: 'text',
                label: 'Address Line 1',
                validation: [],
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                validation: [],
              },
            ],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'personal-info',
            title: 'Personal Information',
            fields: [
              {
                id: 'name',
                type: 'text',
                label: 'Name',
                validation: [],
              },
            ],
          },
          {
            id: 'address-container',
            title: 'Address',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'home',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([['address', addressSubForm]]);
      const result = resolveSubForms(descriptor, subFormMap);

      // Should have original block + merged sub-form blocks
      expect(result.blocks.length).toBeGreaterThan(1);
      // Original block should be preserved
      expect(result.blocks.find((b) => b.id === 'personal-info')).toBeDefined();
      // Sub-form blocks should be merged with prefixed IDs
      const addressBlock = result.blocks.find((b) => b.id.includes('address-block'));
      expect(addressBlock).toBeDefined();
      expect(addressBlock?.id).toContain('address');
      expect(addressBlock?.id).toContain('home');
    });

    test('given sub-form blocks, should prefix block IDs with sub-form ID and instance ID', () => {
      const addressSubForm: SubFormDescriptor = {
        id: 'address',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'incorporation',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([['address', addressSubForm]]);
      const result = resolveSubForms(descriptor, subFormMap);

      const mergedBlock = result.blocks.find((b) => b.id.includes('address-block'));
      expect(mergedBlock?.id).toBe('address_incorporation_address-block');
    });

    test('given sub-form fields, should prefix field IDs with instance ID', () => {
      const addressSubForm: SubFormDescriptor = {
        id: 'address',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [
              {
                id: 'line1',
                type: 'text',
                label: 'Line 1',
                validation: [],
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                validation: [],
              },
            ],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'home',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([['address', addressSubForm]]);
      const result = resolveSubForms(descriptor, subFormMap);

      const mergedBlock = result.blocks.find((b) => b.id.includes('address-block'));
      expect(mergedBlock?.fields).toHaveLength(2);
      expect(mergedBlock?.fields[0].id).toBe('home.line1');
      expect(mergedBlock?.fields[1].id).toBe('home.city');
    });

    test('given nested sub-forms, should recursively resolve sub-forms', () => {
      const countrySubForm: SubFormDescriptor = {
        id: 'country-info',
        title: 'Country Info',
        version: '1.0.0',
        blocks: [
          {
            id: 'country-block',
            title: 'Country',
            fields: [
              {
                id: 'country',
                type: 'text',
                label: 'Country',
                validation: [],
              },
            ],
          },
        ],
      };

      const addressSubForm: SubFormDescriptor = {
        id: 'address',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [
              {
                id: 'line1',
                type: 'text',
                label: 'Line 1',
                validation: [],
              },
            ],
            subFormRef: 'country-info',
            subFormInstanceId: 'address-country',
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'home',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([
        ['address', addressSubForm],
        ['country-info', countrySubForm],
      ]);

      const result = resolveSubForms(descriptor, subFormMap);

      // Should have nested sub-form blocks resolved
      const countryBlock = result.blocks.find((b) => b.id.includes('country-block'));
      expect(countryBlock).toBeDefined();
      expect(countryBlock?.id).toContain('country-info');
      expect(countryBlock?.id).toContain('address-country');
    });

    test('given missing sub-form, should throw descriptive error', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'missing-subform',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>();

      expect(() => resolveSubForms(descriptor, subFormMap)).toThrow(
        /missing-subform.*not found/i
      );
    });

    test('given circular dependency, should detect and throw error', () => {
      const subFormA: SubFormDescriptor = {
        id: 'subform-a',
        title: 'Sub-Form A',
        version: '1.0.0',
        blocks: [
          {
            id: 'block-a',
            title: 'Block A',
            fields: [],
            subFormRef: 'subform-b',
          },
        ],
      };

      const subFormB: SubFormDescriptor = {
        id: 'subform-b',
        title: 'Sub-Form B',
        version: '1.0.0',
        blocks: [
          {
            id: 'block-b',
            title: 'Block B',
            fields: [],
            subFormRef: 'subform-a',
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'subform-a',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([
        ['subform-a', subFormA],
        ['subform-b', subFormB],
      ]);

      expect(() => resolveSubForms(descriptor, subFormMap)).toThrow(/circular.*dependency/i);
    });

    test('given resolved descriptor, should be JSON-serializable', () => {
      const addressSubForm: SubFormDescriptor = {
        id: 'address',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [
              {
                id: 'line1',
                type: 'text',
                label: 'Line 1',
                validation: [],
              },
            ],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'home',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([['address', addressSubForm]]);
      const result = resolveSubForms(descriptor, subFormMap);

      // Should be able to serialize to JSON
      expect(() => JSON.stringify(result)).not.toThrow();
      const serialized = JSON.parse(JSON.stringify(result));
      expect(serialized.blocks).toBeDefined();
      expect(serialized.submission).toBeDefined();
    });

    test('given block without instance ID, should prefix block IDs with sub-form ID only', () => {
      const addressSubForm: SubFormDescriptor = {
        id: 'address',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'address',
            // No subFormInstanceId
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([['address', addressSubForm]]);
      const result = resolveSubForms(descriptor, subFormMap);

      const mergedBlock = result.blocks.find((b) => b.id.includes('address-block'));
      expect(mergedBlock?.id).toBe('address_address-block');
    });

    test('given field without instance ID, should not prefix field IDs', () => {
      const addressSubForm: SubFormDescriptor = {
        id: 'address',
        title: 'Address Sub-Form',
        version: '1.0.0',
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [
              {
                id: 'line1',
                type: 'text',
                label: 'Line 1',
                validation: [],
              },
            ],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'container',
            title: 'Container',
            fields: [],
            subFormRef: 'address',
            // No subFormInstanceId
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const subFormMap = new Map<string, SubFormDescriptor>([['address', addressSubForm]]);
      const result = resolveSubForms(descriptor, subFormMap);

      const mergedBlock = result.blocks.find((b) => b.id.includes('address-block'));
      expect(mergedBlock?.fields[0].id).toBe('line1');
    });
  });
});
