/**
 * Tests for form descriptor integration utilities
 * 
 * Following TDD: Tests verify utility functions for detecting repeatable blocks
 * and grouping fields by repeatableGroupId work correctly.
 */

import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import type { BlockDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { isRepeatableBlock, groupFieldsByRepeatableGroupId, buildZodSchemaFromDescriptor } from './form-descriptor-integration';

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

  describe('buildZodSchemaFromDescriptor with repeatable groups', () => {
    test('given a descriptor with repeatable block, should build array schema for repeatable group', () => {
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
                validation: [{ type: 'required', message: 'Street is required' }],
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                repeatableGroupId: 'addresses',
                validation: [{ type: 'required', message: 'City is required' }],
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const schema = buildZodSchemaFromDescriptor(descriptor);

      // Schema should have addresses as an array
      expect(schema.shape).toHaveProperty('addresses');
      
      // Verify it's an array schema
      const addressesSchema = schema.shape.addresses;
      expect(addressesSchema).toBeInstanceOf(z.ZodArray);
      
      // Verify array contains object schema by checking the element property
      const arraySchema = addressesSchema as z.ZodArray<z.ZodTypeAny>;
      const elementSchema = arraySchema.element;
      expect(elementSchema).toBeInstanceOf(z.ZodObject);
      
      // Verify object schema has street and city fields
      const objectSchema = elementSchema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(objectSchema.shape).toHaveProperty('street');
      expect(objectSchema.shape).toHaveProperty('city');
    });

    test('given a descriptor with repeatable and non-repeatable fields, should handle both', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'basic-info',
            title: 'Basic Info',
            fields: [
              {
                id: 'name',
                type: 'text',
                label: 'Name',
                validation: [{ type: 'required', message: 'Name is required' }],
              },
            ],
          },
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

      const schema = buildZodSchemaFromDescriptor(descriptor);

      // Should have name as individual field (may be wrapped in ZodPipe due to preprocessing)
      expect(schema.shape).toHaveProperty('name');
      expect(schema.shape.name).toBeDefined();
      
      // Should have addresses as array
      expect(schema.shape).toHaveProperty('addresses');
      expect(schema.shape.addresses).toBeInstanceOf(z.ZodArray);
      
      // Verify validation works for both
      const validData = {
        name: 'John Doe',
        addresses: [{ street: '123 Main St' }],
      };
      expect(schema.safeParse(validData).success).toBe(true);
    });

    test('given a descriptor with multiple repeatable groups, should build separate array schemas', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'contacts-block',
            title: 'Contacts',
            repeatable: true,
            fields: [
              {
                id: 'email',
                type: 'text',
                label: 'Email',
                repeatableGroupId: 'emails',
                validation: [],
              },
              {
                id: 'phoneNumber',
                type: 'text',
                label: 'Phone',
                repeatableGroupId: 'phones',
                validation: [],
              },
              {
                id: 'phoneType',
                type: 'dropdown',
                label: 'Phone Type',
                repeatableGroupId: 'phones',
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

      const schema = buildZodSchemaFromDescriptor(descriptor);

      // Should have emails array
      expect(schema.shape).toHaveProperty('emails');
      expect(schema.shape.emails).toBeInstanceOf(z.ZodArray);
      
      // Should have phones array
      expect(schema.shape).toHaveProperty('phones');
      expect(schema.shape.phones).toBeInstanceOf(z.ZodArray);
      
      // Verify phones array contains object with phoneNumber and phoneType
      const phonesSchema = schema.shape.phones as z.ZodArray<z.ZodTypeAny>;
      const phonesElementSchema = phonesSchema.element;
      const phonesObjectSchema = phonesElementSchema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      expect(phonesObjectSchema.shape).toHaveProperty('phoneNumber');
      expect(phonesObjectSchema.shape).toHaveProperty('phoneType');
    });

    test('given a repeatable group with validation rules, should apply validation to fields in array', () => {
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
                validation: [
                  { type: 'required', message: 'Street is required' },
                  { type: 'minLength', value: 5, message: 'Street must be at least 5 characters' },
                ],
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const schema = buildZodSchemaFromDescriptor(descriptor);
      const addressesSchema = schema.shape.addresses as z.ZodArray<z.ZodTypeAny>;
      const elementSchema = addressesSchema.element;
      const objectSchema = elementSchema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      
      // Verify street field has validation
      const streetSchema = objectSchema.shape.street;
      expect(streetSchema).toBeDefined();
      
      // Test validation works
      const validData = { addresses: [{ street: '123 Main Street' }] };
      const invalidData = { addresses: [{ street: '123' }] }; // Too short
      const missingData = { addresses: [{ street: '' }] }; // Missing required
      
      expect(schema.safeParse(validData).success).toBe(true);
      expect(schema.safeParse(invalidData).success).toBe(false);
      expect(schema.safeParse(missingData).success).toBe(false);
    });

    test('given a repeatable group with mixed field types, should correctly type each field', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'beneficiaries-block',
            title: 'Beneficiaries',
            repeatable: true,
            fields: [
              {
                id: 'name',
                type: 'text',
                label: 'Name',
                repeatableGroupId: 'beneficiaries',
                validation: [],
              },
              {
                id: 'age',
                type: 'number',
                label: 'Age',
                repeatableGroupId: 'beneficiaries',
                validation: [],
              },
              {
                id: 'isStudent',
                type: 'checkbox',
                label: 'Is Student',
                repeatableGroupId: 'beneficiaries',
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

      const schema = buildZodSchemaFromDescriptor(descriptor);
      const beneficiariesSchema = schema.shape.beneficiaries as z.ZodArray<z.ZodTypeAny>;
      const elementSchema = beneficiariesSchema.element;
      const objectSchema = elementSchema as z.ZodObject<Record<string, z.ZodTypeAny>>;
      
      // Verify field schemas exist (they may be wrapped in ZodPipe due to preprocessing)
      expect(objectSchema.shape.name).toBeDefined();
      expect(objectSchema.shape.age).toBeDefined();
      expect(objectSchema.shape.isStudent).toBeDefined();
      
      // Test with valid data to verify types work correctly
      const validData = {
        beneficiaries: [
          { name: 'John Doe', age: 25, isStudent: false },
          { name: 'Jane Smith', age: 18, isStudent: true },
        ],
      };
      
      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
      
      // Test with invalid types to verify type checking works
      const invalidData = {
        beneficiaries: [
          { name: 123, age: 'not-a-number', isStudent: 'not-a-boolean' },
        ],
      };
      
      expect(schema.safeParse(invalidData).success).toBe(false);
    });
  });
});
