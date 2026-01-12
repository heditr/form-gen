/**
 * Tests for descriptor merger
 * 
 * Following TDD: Tests verify deep merging of GlobalFormDescriptor with RulesObject
 * works correctly while preserving structure.
 */

import { describe, test, expect } from 'vitest';
import { mergeDescriptorWithRules } from './descriptor-merger';
import type {
  GlobalFormDescriptor,
  RulesObject,
  BlockDescriptor,
  FieldDescriptor,
  ValidationRule,
} from '@/types/form-descriptor';

describe('descriptor merger', () => {
  describe('mergeDescriptorWithRules', () => {
    test('given global descriptor and rules object, should deep merge validation rules into field descriptors', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'personal-info',
            title: 'Personal Information',
            fields: [
              {
                id: 'email',
                type: 'text',
                label: 'Email',
                validation: [
                  { type: 'required', message: 'Email is required' },
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

      const rulesObject: RulesObject = {
        fields: [
          {
            id: 'email',
            validation: [
              { type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' },
            ],
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].fields[0].validation).toHaveLength(2);
      expect(merged.blocks[0].fields[0].validation[0]).toEqual({ type: 'required', message: 'Email is required' });
      expect(merged.blocks[0].fields[0].validation[1]).toEqual({ type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' });
    });

    test('given rules update, should preserve block and field structure while updating rules', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'entity-info',
            title: 'Entity Information',
            description: 'Entity details',
            fields: [
              {
                id: 'entityName',
                type: 'text',
                label: 'Entity Name',
                description: 'Legal entity name',
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

      const rulesObject: RulesObject = {
        fields: [
          {
            id: 'entityName',
            validation: [
              { type: 'required', message: 'Entity name is required' },
              { type: 'minLength', value: 3, message: 'Name must be at least 3 characters' },
            ],
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].id).toBe('entity-info');
      expect(merged.blocks[0].title).toBe('Entity Information');
      expect(merged.blocks[0].description).toBe('Entity details');
      expect(merged.blocks[0].fields[0].id).toBe('entityName');
      expect(merged.blocks[0].fields[0].type).toBe('text');
      expect(merged.blocks[0].fields[0].label).toBe('Entity Name');
      expect(merged.blocks[0].fields[0].description).toBe('Legal entity name');
      expect(merged.blocks[0].fields[0].validation).toHaveLength(2);
    });

    test('given status templates, should merge status conditions from rules into blocks and fields', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'tax-info',
            title: 'Tax Information',
            fields: [
              {
                id: 'taxId',
                type: 'text',
                label: 'Tax ID',
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

      const rulesObject: RulesObject = {
        blocks: [
          {
            id: 'tax-info',
            status: {
              hidden: '{{#if hideTaxInfo}}true{{/if}}',
            },
          },
        ],
        fields: [
          {
            id: 'taxId',
            status: {
              disabled: '{{#if readonly}}true{{/if}}',
              readonly: '{{#if isReadonly}}true{{/if}}',
            },
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].status?.hidden).toBe('{{#if hideTaxInfo}}true{{/if}}');
      expect(merged.blocks[0].fields[0].status?.disabled).toBe('{{#if readonly}}true{{/if}}');
      expect(merged.blocks[0].fields[0].status?.readonly).toBe('{{#if isReadonly}}true{{/if}}');
    });

    test('given nested updates, should handle field-level rule updates within blocks', () => {
      const globalDescriptor: GlobalFormDescriptor = {
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
          {
            id: 'block2',
            title: 'Block 2',
            fields: [
              {
                id: 'field2',
                type: 'text',
                label: 'Field 2',
                validation: [],
              },
              {
                id: 'field3',
                type: 'text',
                label: 'Field 3',
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

      const rulesObject: RulesObject = {
        fields: [
          {
            id: 'field2',
            validation: [
              { type: 'required', message: 'Field 2 is required' },
            ],
          },
          {
            id: 'field3',
            validation: [
              { type: 'required', message: 'Field 3 is required' },
              { type: 'minLength', value: 5, message: 'Must be at least 5 characters' },
            ],
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].fields[0].validation).toHaveLength(0);
      expect(merged.blocks[1].fields[0].validation).toHaveLength(1);
      expect(merged.blocks[1].fields[0].validation[0].type).toBe('required');
      expect(merged.blocks[1].fields[1].validation).toHaveLength(2);
    });

    test('given rules object with no matching fields, should preserve original descriptor', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'field1',
                type: 'text',
                label: 'Field 1',
                validation: [{ type: 'required', message: 'Required' }],
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const rulesObject: RulesObject = {
        fields: [
          {
            id: 'nonexistent',
            validation: [{ type: 'required', message: 'Should not appear' }],
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].fields[0].validation).toHaveLength(1);
      expect(merged.blocks[0].fields[0].validation[0].message).toBe('Required');
    });

    test('given rules object with no matching blocks, should preserve original descriptor', () => {
      const globalDescriptor: GlobalFormDescriptor = {
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

      const rulesObject: RulesObject = {
        blocks: [
          {
            id: 'nonexistent',
            status: { hidden: 'true' },
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].status).toBeUndefined();
    });

    test('given empty rules object, should return original descriptor unchanged', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'field1',
                type: 'text',
                label: 'Field 1',
                validation: [{ type: 'required', message: 'Required' }],
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const rulesObject: RulesObject = {};

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged).toEqual(globalDescriptor);
    });

    test('given rules that replace existing validation, should append new rules to existing ones', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              {
                id: 'field1',
                type: 'text',
                label: 'Field 1',
                validation: [
                  { type: 'required', message: 'Required' },
                  { type: 'minLength', value: 2, message: 'Min 2 chars' },
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

      const rulesObject: RulesObject = {
        fields: [
          {
            id: 'field1',
            validation: [
              { type: 'maxLength', value: 10, message: 'Max 10 chars' },
            ],
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].fields[0].validation).toHaveLength(3);
      expect(merged.blocks[0].fields[0].validation[0].type).toBe('required');
      expect(merged.blocks[0].fields[0].validation[1].type).toBe('minLength');
      expect(merged.blocks[0].fields[0].validation[2].type).toBe('maxLength');
    });

    test('given status templates in rules, should merge with existing status templates', () => {
      const globalDescriptor: GlobalFormDescriptor = {
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            status: {
              hidden: '{{#if hideBlock}}true{{/if}}',
            },
            fields: [
              {
                id: 'field1',
                type: 'text',
                label: 'Field 1',
                validation: [],
                status: {
                  disabled: '{{#if disableField}}true{{/if}}',
                },
              },
            ],
          },
        ],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const rulesObject: RulesObject = {
        blocks: [
          {
            id: 'block1',
            status: {
              disabled: '{{#if disableBlock}}true{{/if}}',
            },
          },
        ],
        fields: [
          {
            id: 'field1',
            status: {
              readonly: '{{#if readonly}}true{{/if}}',
            },
          },
        ],
      };

      const merged = mergeDescriptorWithRules(globalDescriptor, rulesObject);

      expect(merged.blocks[0].status?.hidden).toBe('{{#if hideBlock}}true{{/if}}');
      expect(merged.blocks[0].status?.disabled).toBe('{{#if disableBlock}}true{{/if}}');
      expect(merged.blocks[0].fields[0].status?.disabled).toBe('{{#if disableField}}true{{/if}}');
      expect(merged.blocks[0].fields[0].status?.readonly).toBe('{{#if readonly}}true{{/if}}');
    });
  });
});
