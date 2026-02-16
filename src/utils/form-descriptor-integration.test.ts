/**
 * Tests for form descriptor integration utilities
 * 
 * Following TDD: Tests verify utility functions for detecting repeatable blocks
 * and grouping fields by repeatableGroupId work correctly.
 */

import { describe, test, expect } from 'vitest';
import type { BlockDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { isRepeatableBlock, groupFieldsByRepeatableGroupId } from './form-descriptor-integration';

describe('form descriptor integration', () => {
  describe('isRepeatableBlock', () => {
    test('given a block with repeatable flag set to true, should return true', () => {
      const block: BlockDescriptor = {
        id: 'addresses-block',
        title: 'Addresses',
        repeatable: true,
        fields: [],
      };

      expect(isRepeatableBlock(block)).toBe(true);
    });

    test('given a block with repeatable flag set to false, should return false', () => {
      const block: BlockDescriptor = {
        id: 'basic-info',
        title: 'Basic Information',
        repeatable: false,
        fields: [],
      };

      expect(isRepeatableBlock(block)).toBe(false);
    });

    test('given a block without repeatable flag, should return false', () => {
      const block: BlockDescriptor = {
        id: 'basic-info',
        title: 'Basic Information',
        fields: [],
      };

      expect(isRepeatableBlock(block)).toBe(false);
    });

    test('given a block with repeatableBlockRef, should return true', () => {
      const block: BlockDescriptor = {
        id: 'addresses-block',
        title: 'Addresses',
        repeatable: true,
        repeatableBlockRef: 'address-block',
        fields: [],
      };

      expect(isRepeatableBlock(block)).toBe(true);
    });
  });

  describe('groupFieldsByRepeatableGroupId', () => {
    test('given fields with same repeatableGroupId, should group them together', () => {
      const fields = [
        {
          id: 'street',
          type: 'text' as const,
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
        {
          id: 'city',
          type: 'text' as const,
          label: 'City',
          repeatableGroupId: 'addresses',
          validation: [],
        },
        {
          id: 'zipCode',
          type: 'text' as const,
          label: 'ZIP Code',
          repeatableGroupId: 'addresses',
          validation: [],
        },
      ];

      const result = groupFieldsByRepeatableGroupId(fields);

      expect(result).toHaveProperty('addresses');
      expect(result.addresses).toHaveLength(3);
      expect(result.addresses?.map((f) => f.id)).toEqual(['street', 'city', 'zipCode']);
    });

    test('given fields with different repeatableGroupIds, should group them separately', () => {
      const fields = [
        {
          id: 'email',
          type: 'text' as const,
          label: 'Email',
          repeatableGroupId: 'emails',
          validation: [],
        },
        {
          id: 'phoneNumber',
          type: 'text' as const,
          label: 'Phone',
          repeatableGroupId: 'phones',
          validation: [],
        },
        {
          id: 'phoneType',
          type: 'dropdown' as const,
          label: 'Phone Type',
          repeatableGroupId: 'phones',
          validation: [],
        },
      ];

      const result = groupFieldsByRepeatableGroupId(fields);

      expect(result).toHaveProperty('emails');
      expect(result).toHaveProperty('phones');
      expect(result.emails).toHaveLength(1);
      expect(result.phones).toHaveLength(2);
      expect(result.emails?.[0].id).toBe('email');
      expect(result.phones?.map((f) => f.id)).toEqual(['phoneNumber', 'phoneType']);
    });

    test('given fields without repeatableGroupId, should not include them in groups', () => {
      const fields = [
        {
          id: 'name',
          type: 'text' as const,
          label: 'Name',
          validation: [],
        },
        {
          id: 'street',
          type: 'text' as const,
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
      ];

      const result = groupFieldsByRepeatableGroupId(fields);

      expect(result).toHaveProperty('addresses');
      expect(result.addresses).toHaveLength(1);
      expect(result.addresses?.[0].id).toBe('street');
    });

    test('given empty fields array, should return empty object', () => {
      const result = groupFieldsByRepeatableGroupId([]);

      expect(result).toEqual({});
    });

    test('given fields with undefined repeatableGroupId, should not include them', () => {
      const fields = [
        {
          id: 'name',
          type: 'text' as const,
          label: 'Name',
          validation: [],
        },
      ];

      const result = groupFieldsByRepeatableGroupId(fields);

      expect(result).toEqual({});
    });
  });
});
