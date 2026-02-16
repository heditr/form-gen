/**
 * Tests for form descriptor integration utilities
 * 
 * Following TDD: Tests verify utility functions for detecting repeatable blocks
 * and grouping fields by repeatableGroupId work correctly.
 */

import { describe, test, expect } from 'vitest';
import { z } from 'zod';
import type { BlockDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { isRepeatableBlock, groupFieldsByRepeatableGroupId, buildZodSchemaFromDescriptor, extractDefaultValues } from './form-descriptor-integration';

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

  describe('buildZodSchemaFromDescriptor with array-level validation', () => {
    test('given a repeatable block with minInstances, should apply min validation', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            minInstances: 2,
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
      
      // Test validation - minInstances = 2 should require at least 2 instances
      const tooFew = { addresses: [{ street: '123 Main St' }] }; // Only 1 instance, need 2
      const enough = { addresses: [{ street: '123 Main St' }, { street: '456 Oak Ave' }] }; // 2 instances
      
      const tooFewResult = schema.safeParse(tooFew);
      expect(tooFewResult.success).toBe(false);
      if (!tooFewResult.success) {
        expect(tooFewResult.error.issues.length).toBeGreaterThan(0);
      }
      
      expect(schema.safeParse(enough).success).toBe(true);
    });

    test('given a repeatable block with maxInstances, should apply max validation', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'contacts-block',
            title: 'Contacts',
            repeatable: true,
            maxInstances: 3,
            fields: [
              {
                id: 'email',
                type: 'text',
                label: 'Email',
                repeatableGroupId: 'contacts',
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
      
      // Test validation - maxInstances = 3 should reject more than 3 instances
      const tooMany = {
        contacts: [
          { email: 'a@example.com' },
          { email: 'b@example.com' },
          { email: 'c@example.com' },
          { email: 'd@example.com' },
        ],
      }; // 4 instances, max is 3
      const withinLimit = {
        contacts: [
          { email: 'a@example.com' },
          { email: 'b@example.com' },
        ],
      }; // 2 instances, within limit
      
      const tooManyResult = schema.safeParse(tooMany);
      expect(tooManyResult.success).toBe(false);
      if (!tooManyResult.success) {
        expect(tooManyResult.error.issues.length).toBeGreaterThan(0);
      }
      
      expect(schema.safeParse(withinLimit).success).toBe(true);
    });

    test('given a repeatable block with both minInstances and maxInstances, should apply both', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'beneficiaries-block',
            title: 'Beneficiaries',
            repeatable: true,
            minInstances: 1,
            maxInstances: 5,
            fields: [
              {
                id: 'name',
                type: 'text',
                label: 'Name',
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
      
      // Test validation - minInstances = 1, maxInstances = 5
      const empty = { beneficiaries: [] }; // 0 instances, need at least 1
      const one = { beneficiaries: [{ name: 'John' }] }; // 1 instance, valid
      const five = {
        beneficiaries: [
          { name: 'John' },
          { name: 'Jane' },
          { name: 'Bob' },
          { name: 'Alice' },
          { name: 'Charlie' },
        ],
      }; // 5 instances, valid
      const six = {
        beneficiaries: [
          { name: 'John' },
          { name: 'Jane' },
          { name: 'Bob' },
          { name: 'Alice' },
          { name: 'Charlie' },
          { name: 'David' },
        ],
      }; // 6 instances, exceeds max
      
      const emptyResult = schema.safeParse(empty);
      expect(emptyResult.success).toBe(false);
      if (!emptyResult.success) {
        expect(emptyResult.error.issues.length).toBeGreaterThan(0);
      }
      
      expect(schema.safeParse(one).success).toBe(true);
      expect(schema.safeParse(five).success).toBe(true);
      
      const sixResult = schema.safeParse(six);
      expect(sixResult.success).toBe(false);
      if (!sixResult.success) {
        expect(sixResult.error.issues.length).toBeGreaterThan(0);
      }
    });

    test('given a repeatable block without minInstances/maxInstances, should not apply array-level validation', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            // No minInstances or maxInstances
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
      
      // Empty array should be valid (no min constraint)
      const empty = { addresses: [] };
      expect(schema.safeParse(empty).success).toBe(true);
      
      // Multiple instances should also be valid (no max constraint)
      const many = {
        addresses: [
          { street: '123 Main St' },
          { street: '456 Oak Ave' },
          { street: '789 Pine Rd' },
        ],
      };
      expect(schema.safeParse(many).success).toBe(true);
    });

    test('given minInstances of 0, should allow empty array', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            minInstances: 0,
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
      
      // Empty array should be valid (minInstances = 0)
      const empty = { addresses: [] };
      expect(schema.safeParse(empty).success).toBe(true);
    });

    test('given minInstances >= 1, should require at least one instance', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'addresses-block',
            title: 'Addresses',
            repeatable: true,
            minInstances: 1,
            fields: [
              {
                id: 'street',
                type: 'text',
                label: 'Street',
                repeatableGroupId: 'addresses',
                validation: [{ type: 'required', message: 'Street is required' }],
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
      
      // Empty array should fail (minInstances = 1)
      const empty = { addresses: [] };
      expect(schema.safeParse(empty).success).toBe(false);
      
      // One instance should pass
      const one = { addresses: [{ street: '123 Main St' }] };
      expect(schema.safeParse(one).success).toBe(true);
    });
  });

  describe('extractDefaultValues with repeatable groups', () => {
    test('given a repeatable block without default values, should initialize as empty array', () => {
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
              {
                id: 'city',
                type: 'text',
                label: 'City',
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

      const defaultValues = extractDefaultValues(descriptor);

      expect(defaultValues).toHaveProperty('addresses');
      expect(defaultValues.addresses).toEqual([]);
    });

    test('given a repeatable block with default values, should extract as array of objects', () => {
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
                defaultValue: '123 Main St',
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                repeatableGroupId: 'addresses',
                validation: [],
                defaultValue: 'New York',
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const defaultValues = extractDefaultValues(descriptor);

      expect(defaultValues).toHaveProperty('addresses');
      expect(defaultValues.addresses).toEqual([
        {
          street: '123 Main St',
          city: 'New York',
        },
      ]);
    });

    test('given repeatable and non-repeatable fields, should handle both', () => {
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
                validation: [],
                defaultValue: 'John Doe',
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

      const defaultValues = extractDefaultValues(descriptor);

      // Non-repeatable field
      expect(defaultValues.name).toBe('John Doe');
      
      // Repeatable group
      expect(defaultValues.addresses).toEqual([]);
    });

    test('given multiple repeatable groups, should extract each as separate array', () => {
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
                defaultValue: 'test@example.com',
              },
              {
                id: 'phoneNumber',
                type: 'text',
                label: 'Phone',
                repeatableGroupId: 'phones',
                validation: [],
                defaultValue: '555-1234',
              },
              {
                id: 'phoneType',
                type: 'dropdown',
                label: 'Phone Type',
                repeatableGroupId: 'phones',
                validation: [],
                defaultValue: 'mobile',
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const defaultValues = extractDefaultValues(descriptor);

      expect(defaultValues.emails).toEqual([
        { email: 'test@example.com' },
      ]);
      expect(defaultValues.phones).toEqual([
        { phoneNumber: '555-1234', phoneType: 'mobile' },
      ]);
    });

    test('given repeatable group with mixed field types, should extract correctly', () => {
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
                defaultValue: 'John Doe',
              },
              {
                id: 'age',
                type: 'number',
                label: 'Age',
                repeatableGroupId: 'beneficiaries',
                validation: [],
                defaultValue: 25,
              },
              {
                id: 'isStudent',
                type: 'checkbox',
                label: 'Is Student',
                repeatableGroupId: 'beneficiaries',
                validation: [],
                defaultValue: true,
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const defaultValues = extractDefaultValues(descriptor);

      expect(defaultValues.beneficiaries).toEqual([
        {
          name: 'John Doe',
          age: 25,
          isStudent: true,
        },
      ]);
    });

    test('given repeatable group with some fields having defaults and others not, should use defaults where provided', () => {
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
                defaultValue: '123 Main St',
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                repeatableGroupId: 'addresses',
                validation: [],
                // No defaultValue - should use type-appropriate default
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const defaultValues = extractDefaultValues(descriptor);

      expect(defaultValues.addresses).toEqual([
        {
          street: '123 Main St',
          city: '', // Type-appropriate default for text field
        },
      ]);
    });
  });

  describe('extractDefaultValues template evaluation for repeatable groups', () => {
    test('given repeatable group with template defaultValue, should evaluate template with context', () => {
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
                defaultValue: '{{caseContext.defaultStreet}}',
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                repeatableGroupId: 'addresses',
                validation: [],
                defaultValue: '{{caseContext.defaultCity}}',
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const context: FormContext = {
        caseContext: {
          defaultStreet: '123 Template St',
          defaultCity: 'Template City',
        },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.addresses).toEqual([
        {
          street: '123 Template St',
          city: 'Template City',
        },
      ]);
    });

    test('given repeatable group with template referencing formData, should evaluate with form context', () => {
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
                defaultValue: '{{formData.userStreet}}',
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                repeatableGroupId: 'addresses',
                validation: [],
                defaultValue: '{{formData.userCity}}',
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const context: FormContext = {
        formData: {
          userStreet: '456 Form St',
          userCity: 'Form City',
        },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.addresses).toEqual([
        {
          street: '456 Form St',
          city: 'Form City',
        },
      ]);
    });

    test('given repeatable group with mixed template and static defaults, should evaluate templates correctly', () => {
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
                defaultValue: '{{caseContext.defaultStreet}}',
              },
              {
                id: 'city',
                type: 'text',
                label: 'City',
                repeatableGroupId: 'addresses',
                validation: [],
                defaultValue: 'Static City',
              },
              {
                id: 'zipCode',
                type: 'text',
                label: 'ZIP Code',
                repeatableGroupId: 'addresses',
                validation: [],
                // No defaultValue - should use type-appropriate default
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const context: FormContext = {
        caseContext: {
          defaultStreet: '789 Template St',
        },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.addresses).toEqual([
        {
          street: '789 Template St', // From template
          city: 'Static City', // Static value
          zipCode: '', // Type-appropriate default
        },
      ]);
    });

    test('given repeatable group with number template, should parse to number', () => {
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
                defaultValue: '{{caseContext.defaultName}}',
              },
              {
                id: 'age',
                type: 'number',
                label: 'Age',
                repeatableGroupId: 'beneficiaries',
                validation: [],
                defaultValue: '{{caseContext.defaultAge}}',
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const context: FormContext = {
        caseContext: {
          defaultName: 'John Doe',
          defaultAge: '25', // Template returns string, should parse to number
        },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.beneficiaries).toEqual([
        {
          name: 'John Doe',
          age: 25, // Parsed from string template
        },
      ]);
    });

    test('given repeatable group with boolean template, should parse to boolean', () => {
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
                defaultValue: '{{caseContext.defaultName}}',
              },
              {
                id: 'isStudent',
                type: 'checkbox',
                label: 'Is Student',
                repeatableGroupId: 'beneficiaries',
                validation: [],
                defaultValue: '{{caseContext.isStudent}}',
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const context: FormContext = {
        caseContext: {
          defaultName: 'Jane Smith',
          isStudent: 'true', // Template returns string, should parse to boolean
        },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.beneficiaries).toEqual([
        {
          name: 'Jane Smith',
          isStudent: true, // Parsed from string template
        },
      ]);
    });
  });
});
