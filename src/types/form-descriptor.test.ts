/**
 * Tests for form descriptor type definitions
 * 
 * These tests verify that the TypeScript types correctly represent
 * the form descriptor system structure.
 */

import { describe, test, expect } from 'vitest';
import type {
  GlobalFormDescriptor,
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
  });

  describe('GlobalFormDescriptor', () => {
    test('given a form descriptor structure, should define blocks, fields, and submission config', () => {
      const descriptor: GlobalFormDescriptor = {
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

      expect(descriptor.blocks).toBeDefined();
      expect(descriptor.blocks.length).toBe(1);
      expect(descriptor.submission).toBeDefined();
      expect(descriptor.submission.url).toBe('/api/submit');
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
});
