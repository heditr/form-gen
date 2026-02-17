/**
 * Tests for form descriptor integration utilities
 * 
 * Following TDD: Tests verify integration utilities for react-hook-form with form descriptor system
 * work correctly.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  extractDefaultValues,
  getFieldValidationRules,
  mapBackendErrorsToForm,
  identifyDiscriminantFields,
} from '@/utils/form-descriptor-integration';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import type { FormContext } from '@/utils/template-evaluator';

describe('form descriptor integration', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  describe('extractDefaultValues', () => {
    test('given form initialization, should extract default values from descriptor fields', () => {
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
                defaultValue: 'initial value',
              },
              {
                id: 'field2',
                type: 'text',
                label: 'Field 2',
                validation: [],
                defaultValue: 'another value',
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

      expect(defaultValues).toEqual({
        field1: 'initial value',
        field2: 'another value',
      });
    });

    test('given fields without default values, should return type-appropriate defaults for controlled inputs', () => {
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
              {
                id: 'field2',
                type: 'text',
                label: 'Field 2',
                validation: [],
                defaultValue: 'has value',
              },
              {
                id: 'field3',
                type: 'checkbox',
                label: 'Field 3',
                validation: [],
              },
              {
                id: 'field4',
                type: 'file',
                label: 'Field 4',
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

      // Text fields without explicit defaultValue should get empty string for controlled inputs
      expect(defaultValues.field1).toBe('');
      expect(defaultValues.field2).toBe('has value');
      // Checkbox fields should get false
      expect(defaultValues.field3).toBe(false);
      // File fields should get null
      expect(defaultValues.field4).toBe(null);
    });

    test('given descriptor with template defaultValue and context, should evaluate template before setting default', () => {
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
                defaultValue: '{{caseContext.country}}',
              },
              {
                id: 'field2',
                type: 'checkbox',
                label: 'Field 2',
                validation: [],
                defaultValue: '{{#if caseContext.needSignature}}true{{else}}false{{/if}}',
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
          country: 'US',
          needSignature: true,
        },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.field1).toBe('US');
      expect(defaultValues.field2).toBe(true);
    });

    test('given descriptor with static defaultValue, should use value directly', () => {
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
                defaultValue: 'static value',
              },
              {
                id: 'field2',
                type: 'number',
                label: 'Field 2',
                validation: [],
                defaultValue: 42,
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

      expect(defaultValues.field1).toBe('static value');
      expect(defaultValues.field2).toBe(42);
    });

    test('given context with formData and caseContext, should make both available to templates', () => {
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
                defaultValue: '{{caseContext.country}} - {{formData.city}}',
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
        caseContext: { country: 'US' },
        formData: { city: 'New York' },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.field1).toBe('US - New York');
    });

    test('given file field with template evaluating to URL, should return URL string', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'document',
                type: 'file',
                label: 'Document',
                validation: [],
                defaultValue: '{{caseContext.documentUrl}}',
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
        caseContext: { documentUrl: 'https://example.com/file.pdf' },
      };

      const defaultValues = extractDefaultValues(descriptor, context);

      expect(defaultValues.document).toBe('https://example.com/file.pdf');
    });

    test('given file field with template evaluating to "null", should return null', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'document',
                type: 'file',
                label: 'Document',
                validation: [],
                defaultValue: 'null',
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

      expect(defaultValues.document).toBeNull();
    });
  });

  describe('getFieldValidationRules', () => {
    test('given field descriptors, should return validation rules for field', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'email',
                type: 'text',
                label: 'Email',
                validation: [
                  { type: 'required', message: 'Email is required' },
                  { type: 'minLength', value: 3, message: 'Min 3 chars' },
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

      const rules = getFieldValidationRules(descriptor, 'email');

      expect(rules).toEqual({
        required: 'Email is required',
        minLength: { value: 3, message: 'Min 3 chars' },
      });
    });

    test('given field with no validation rules, should return empty object', () => {
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

      const rules = getFieldValidationRules(descriptor, 'field1');

      expect(rules).toEqual({});
    });

    test('given non-existent field, should return empty object', () => {
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

      const rules = getFieldValidationRules(descriptor, 'nonexistent');

      expect(rules).toEqual({});
    });
  });

  describe('mapBackendErrorsToForm', () => {
    test('given backend validation errors, should map errors to react-hook-form setError format', () => {
      const backendErrors = [
        { field: 'email', message: 'Email already exists' },
        { field: 'password', message: 'Password too weak' },
      ];

      const mappedErrors = mapBackendErrorsToForm(backendErrors);

      expect(mappedErrors).toEqual([
        { field: 'email', error: { type: 'server', message: 'Email already exists' } },
        { field: 'password', error: { type: 'server', message: 'Password too weak' } },
      ]);
    });

    test('given empty errors array, should return empty array', () => {
      const mappedErrors = mapBackendErrorsToForm([]);

      expect(mappedErrors).toEqual([]);
    });
  });

  describe('identifyDiscriminantFields', () => {
    test('given descriptor with discriminant fields, should return array of field IDs', () => {
      const descriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'jurisdiction',
                type: 'text',
                label: 'Jurisdiction',
                validation: [],
                isDiscriminant: true,
              },
              {
                id: 'entityType',
                type: 'text',
                label: 'Entity Type',
                validation: [],
                isDiscriminant: true,
              },
              {
                id: 'name',
                type: 'text',
                label: 'Name',
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

      const discriminantFields = identifyDiscriminantFields(descriptor);

      expect(discriminantFields).toEqual(['jurisdiction', 'entityType']);
    });

    test('given descriptor with no discriminant fields, should return empty array', () => {
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

      const discriminantFields = identifyDiscriminantFields(descriptor);

      expect(discriminantFields).toEqual([]);
    });
  });

  // Note: Testing repeatable group sync and restoration requires testing the useFormDescriptor hook
  // which requires React component context. The implementation already handles repeatable groups:
  // 1. useWatch({ control: form.control }) watches ALL form values including arrays
  // 2. When repeatable groups are modified via useFieldArray, react-hook-form updates form values
  // 3. The useEffect syncs all form values (including arrays) to Redux via onDiscriminantChange
  // 4. savedFormData merge logic preserves arrays from Redux on remount
  // Integration tests in repeatable-field-group.test.tsx verify the end-to-end behavior
});
