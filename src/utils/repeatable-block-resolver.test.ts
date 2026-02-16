/**
 * Tests for Repeatable Block Reference Resolver
 * 
 * Following TDD: Tests verify that repeatable block references are resolved correctly,
 * validating existence, preventing circular references, and merging fields properly.
 */

import { describe, test, expect } from 'vitest';
import type { GlobalFormDescriptor, BlockDescriptor } from '@/types/form-descriptor';
import {
  resolveRepeatableBlockRef,
  resolveAllRepeatableBlockRefs,
} from './repeatable-block-resolver';

describe('repeatable block resolver', () => {
  describe('resolveRepeatableBlockRef', () => {
    test('given valid repeatableBlockRef, should find and return referenced block', () => {
      const referencedBlock: BlockDescriptor = {
        id: 'address-block',
        title: 'Address',
        fields: [
          {
            id: 'street',
            type: 'text',
            label: 'Street',
            validation: [],
          },
          {
            id: 'city',
            type: 'text',
            label: 'City',
            validation: [],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          referencedBlock,
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            repeatableBlockRef: 'address-block',
            fields: [], // Fields will come from referenced block
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const result = resolveRepeatableBlockRef('addresses-block', descriptor);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('address-block');
      expect(result?.fields).toEqual(referencedBlock.fields);
    });

    test('given non-existent repeatableBlockRef, should return null', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            repeatableBlockRef: 'non-existent-block',
            fields: [], // Fields will come from referenced block
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const result = resolveRepeatableBlockRef('addresses-block', descriptor);

      expect(result).toBeNull();
    });

    test('given referenced block that is itself repeatable, should return null', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            repeatable: true,
            fields: [
              {
                id: 'street',
                type: 'text',
                label: 'Street',
                validation: [],
              },
            ],
          },
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            repeatableBlockRef: 'address-block',
            fields: [], // Fields will come from referenced block
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const result = resolveRepeatableBlockRef('addresses-block', descriptor);

      expect(result).toBeNull();
    });

    test('given block without repeatableBlockRef, should return null', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            fields: [
              {
                id: 'street',
                type: 'text',
                label: 'Street',
                repeatableGroupId: 'addresses',
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

      const result = resolveRepeatableBlockRef('addresses-block', descriptor);

      expect(result).toBeNull();
    });

    test('given non-repeatable block with repeatableBlockRef, should return null', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'address-block',
            title: 'Address',
            fields: [
              {
                id: 'street',
                type: 'text',
                label: 'Street',
                validation: [],
              },
            ],
          },
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatableBlockRef: 'address-block', // Missing repeatable: true
            fields: [], // Fields will come from referenced block
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const result = resolveRepeatableBlockRef('addresses-block', descriptor);

      expect(result).toBeNull();
    });
  });

  describe('resolveAllRepeatableBlockRefs', () => {
    test('given descriptor with repeatableBlockRef, should resolve all references', () => {
      const referencedBlock: BlockDescriptor = {
        id: 'address-block',
        title: 'Address',
        fields: [
          {
            id: 'street',
            type: 'text',
            label: 'Street',
            validation: [],
          },
          {
            id: 'city',
            type: 'text',
            label: 'City',
            validation: [],
          },
        ],
      };

      const descriptor: GlobalFormDescriptor = {
        blocks: [
          referencedBlock,
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            repeatableBlockRef: 'address-block',
            fields: [], // Fields will come from referenced block
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const result = resolveAllRepeatableBlockRefs(descriptor);

      // Should have resolved the reference
      const addressesBlock = result.blocks.find(b => b.id === 'addresses-block');
      expect(addressesBlock).toBeDefined();
      expect(addressesBlock?.repeatableBlockRef).toBeUndefined(); // Should be resolved
      expect(addressesBlock?.fields).toBeDefined();
      expect(addressesBlock?.fields?.length).toBe(2);
    });

    test('given circular reference, should throw error', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block-a',
            title: 'Block A',
            repeatable: true,
            repeatableBlockRef: 'block-b',
            fields: [], // Fields will come from referenced block
          },
          {
            id: 'block-b',
            title: 'Block B',
            repeatable: true,
            repeatableBlockRef: 'block-a',
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

      // Should throw error because block-b is repeatable (cannot be referenced)
      // OR circular dependency if both are valid
      expect(() => resolveAllRepeatableBlockRefs(descriptor)).toThrow();
    });

    test('given self-reference, should throw error', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            repeatableBlockRef: 'addresses-block', // References itself
            fields: [], // Fields will come from referenced block
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      expect(() => resolveAllRepeatableBlockRefs(descriptor)).toThrow(/circular/i);
    });
  });
});
