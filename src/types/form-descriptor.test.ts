/**
 * Tests for form descriptor type definitions
 * 
 * These tests verify that the TypeScript types correctly represent
 * the form descriptor system structure.
 */

import { describe, test, expect } from 'vitest';
import type {
  GlobalFormDescriptor,
  SubFormDescriptor,
  BlockDescriptor,
  FieldDescriptor,
  ValidationRule,
  CaseContext,
  RulesObject,
} from './form-descriptor';

describe('form-descriptor types', () => {
  describe('ValidationRule', () => {
    test('given a required validation rule, should define type, value, and message properties', () => {
      const rule: ValidationRule = {
        type: 'required',
        message: 'This field is required',
      };

      expect(rule.type).toBe('required');
      expect(rule.message).toBe('This field is required');
    });

    test('given a minLength validation rule, should define type, value, and message properties', () => {
      const rule: ValidationRule = {
        type: 'minLength',
        value: 3,
        message: 'Must be at least 3 characters',
      };

      expect(rule.type).toBe('minLength');
      expect(rule.value).toBe(3);
      expect(rule.message).toBe('Must be at least 3 characters');
    });

    test('given a pattern validation rule, should define type, value, and message properties', () => {
      const rule: ValidationRule = {
        type: 'pattern',
        value: /^[A-Z]+$/,
        message: 'Must contain only uppercase letters',
      };

      expect(rule.type).toBe('pattern');
      expect(rule.value).toBeInstanceOf(RegExp);
      expect(rule.message).toBe('Must contain only uppercase letters');
    });
  });

  describe('FieldDescriptor', () => {
    test('given a field with static items, should support items array', () => {
      const field: FieldDescriptor = {
        id: 'country',
        type: 'dropdown',
        label: 'Country',
        items: [
          { label: 'United States', value: 'US' },
          { label: 'Canada', value: 'CA' },
        ],
        validation: [],
      };

      expect(field.items).toBeDefined();
      expect(field.items?.length).toBe(2);
    });

    test('given a field with dynamic dataSource, should support dataSource config', () => {
      const field: FieldDescriptor = {
        id: 'city',
        type: 'autocomplete',
        label: 'City',
        dataSource: {
          url: '/api/cities?country={{country}}',
          itemsTemplate: '{{#each cities}}{{label}}:{{value}}{{/each}}',
        },
        validation: [],
      };

      expect(field.dataSource).toBeDefined();
      expect(field.dataSource?.url).toContain('{{country}}');
    });

    test('given a field with validation rules, should support validation array', () => {
      const field: FieldDescriptor = {
        id: 'email',
        type: 'text',
        label: 'Email',
        validation: [
          { type: 'required', message: 'Email is required' },
          { type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' },
        ],
      };

      expect(field.validation.length).toBe(2);
    });

    test('given a discriminant field, should support isDiscriminant flag', () => {
      const field: FieldDescriptor = {
        id: 'jurisdiction',
        type: 'dropdown',
        label: 'Jurisdiction',
        items: [{ label: 'US', value: 'US' }],
        isDiscriminant: true,
        validation: [],
      };

      expect(field.isDiscriminant).toBe(true);
    });
  });

  describe('BlockDescriptor', () => {
    test('given a block with status templates, should define hidden and disabled templates', () => {
      const block: BlockDescriptor = {
        id: 'personal-info',
        title: 'Personal Information',
        fields: [],
        status: {
          hidden: '{{#if hidePersonalInfo}}true{{/if}}',
          disabled: '{{#if readonly}}true{{/if}}',
        },
      };

      expect(block.status?.hidden).toBeDefined();
      expect(block.status?.disabled).toBeDefined();
    });

    test('given a block with readonly status, should support readonly template', () => {
      const block: BlockDescriptor = {
        id: 'readonly-block',
        title: 'Read Only Block',
        fields: [],
        status: {
          readonly: '{{#if isReadonly}}true{{/if}}',
        },
      };

      expect(block.status?.readonly).toBeDefined();
    });

    test('given a block that composes a sub-form, should support subFormRef and instance ID', () => {
      const block: BlockDescriptor = {
        id: 'incorporation-address',
        title: 'Incorporation Address',
        fields: [],
        subFormRef: 'address',
        subFormInstanceId: 'incorporation',
      };

      expect(block.subFormRef).toBe('address');
      expect(block.subFormInstanceId).toBe('incorporation');
    });
  });

  describe('GlobalFormDescriptor', () => {
    test('given a form descriptor structure, should define blocks, fields, and submission config', () => {
      const descriptor: GlobalFormDescriptor = {
        id: 'kyc-form-v1',
        title: 'KYC Onboarding Form',
        version: '1.0.0',
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

      expect(descriptor.id).toBe('kyc-form-v1');
      expect(descriptor.title).toBe('KYC Onboarding Form');
      expect(descriptor.blocks).toBeDefined();
      expect(descriptor.blocks.length).toBe(1);
      expect(descriptor.submission).toBeDefined();
      expect(descriptor.submission.url).toBe('/api/submit');
    });

    test('given a form descriptor with sub-form references, should reference sub-forms via block subFormRef', () => {
      const descriptor: GlobalFormDescriptor = {
        id: 'kyc-form-v1',
        blocks: [
          {
            id: 'incorporation-address',
            title: 'Incorporation Address',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'incorporation',
          },
          {
            id: 'onboarding-address',
            title: 'Onboarding Address',
            fields: [],
            subFormRef: 'address',
            subFormInstanceId: 'onboarding',
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      expect(descriptor.blocks[0].subFormRef).toBe('address');
      expect(descriptor.blocks[0].subFormInstanceId).toBe('incorporation');
      expect(descriptor.blocks[1].subFormRef).toBe('address');
      expect(descriptor.blocks[1].subFormInstanceId).toBe('onboarding');
    });
  });

  describe('SubFormDescriptor', () => {
    test('given a sub-form descriptor, should have optional submission config', () => {
      const subForm: SubFormDescriptor = {
        id: 'address-subform',
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
            ],
          },
        ],
      };

      expect(subForm.id).toBe('address-subform');
      expect(subForm.submission).toBeUndefined();
    });

    test('given a sub-form with submission, should support optional submission config', () => {
      const subForm: SubFormDescriptor = {
        id: 'popin-subform',
        title: 'Popin Sub-Form',
        version: '1.0.0',
        blocks: [],
        submission: {
          url: '/api/popin-submit',
          method: 'POST',
        },
      };

      expect(subForm.id).toBe('popin-subform');
      expect(subForm.title).toBe('Popin Sub-Form');
      expect(subForm.version).toBe('1.0.0');
      expect(subForm.submission).toBeDefined();
      expect(subForm.submission?.url).toBe('/api/popin-submit');
    });
  });

  describe('CaseContext', () => {
    test('given API communication needs, should define CaseContext type', () => {
      const context: CaseContext = {
        jurisdiction: 'US',
        entityType: 'individual',
      };

      expect(context.jurisdiction).toBe('US');
      expect(context.entityType).toBe('individual');
    });
  });

  describe('RulesObject', () => {
    test('given API communication needs, should define RulesObject type', () => {
      const rules: RulesObject = {
        blocks: [
          {
            id: 'block1',
            status: {
              hidden: '{{#if hideBlock}}true{{/if}}',
            },
          },
        ],
        fields: [
          {
            id: 'field1',
            validation: [
              { type: 'required', message: 'Required field' },
            ],
          },
        ],
      };

      expect(rules.blocks).toBeDefined();
      expect(rules.fields).toBeDefined();
    });
  });

  describe('File field types', () => {
    test('given a file field descriptor, should allow defaultValue as URL string', () => {
      const field: FieldDescriptor = {
        id: 'document',
        type: 'file',
        label: 'Document',
        defaultValue: 'https://example.com/file.pdf',
        validation: [],
      };

      expect(field.defaultValue).toBe('https://example.com/file.pdf');
    });

    test('given a file field descriptor, should allow defaultValue as array of URL strings', () => {
      const field: FieldDescriptor = {
        id: 'documents',
        type: 'file',
        label: 'Documents',
        defaultValue: 'https://example.com/file1.pdf',
        validation: [],
      };

      expect(field.defaultValue).toEqual(['https://example.com/file1.pdf', 'https://example.com/file2.pdf']);
    });

    test('given a file field descriptor, should allow defaultValue as null', () => {
      const field: FieldDescriptor = {
        id: 'document',
        type: 'file',
        label: 'Document',
        defaultValue: null,
        validation: [],
      };

      expect(field.defaultValue).toBeNull();
    });

    test('given a file field descriptor, should allow defaultValue as Handlebars template string', () => {
      const field: FieldDescriptor = {
        id: 'document',
        type: 'file',
        label: 'Document',
        defaultValue: '{{caseContext.documentUrl}}',
        validation: [],
      };

      expect(field.defaultValue).toBe('{{caseContext.documentUrl}}');
    });
  });
});
