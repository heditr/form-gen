/**
 * Tests for template evaluator
 * 
 * Following TDD: Tests verify Handlebars template evaluation
 * with form context works correctly.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import Handlebars from 'handlebars';
import { registerHandlebarsHelpers } from './handlebars-helpers';
import {
  evaluateTemplate,
  evaluateHiddenStatus,
  evaluateDisabledStatus,
  evaluateReadonlyStatus,
} from './template-evaluator';
import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';

describe('template evaluator', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  describe('evaluateTemplate', () => {
    test('given a template string and context, should evaluate Handlebars template returning boolean result', () => {
      const template = '{{#if (eq user.role "admin")}}true{{else}}false{{/if}}';
      const context = { user: { role: 'admin' } };
      
      const result = evaluateTemplate(template, context);
      
      expect(result).toBe('true');
    });

    test('given a template string and context, should evaluate Handlebars template returning string result', () => {
      const template = 'Hello {{user.name}}';
      const context = { user: { name: 'John' } };
      
      const result = evaluateTemplate(template, context);
      
      expect(result).toBe('Hello John');
    });

    test('given a template with helpers, should evaluate using custom helpers', () => {
      const template = '{{#if (and user.isActive (not user.isBlocked))}}active{{else}}inactive{{/if}}';
      const context = { user: { isActive: true, isBlocked: false } };
      
      const result = evaluateTemplate(template, context);
      
      expect(result).toBe('active');
    });

    test('given empty template, should return empty string', () => {
      const result = evaluateTemplate('', {});
      
      expect(result).toBe('');
    });

    test('given undefined template, should return empty string', () => {
      const result = evaluateTemplate(undefined, {});
      
      expect(result).toBe('');
    });
  });

  describe('evaluateHiddenStatus', () => {
    test('given a block descriptor with hidden template, should evaluate status.hidden template returning visibility state', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
        status: {
          hidden: '{{#if hideBlock}}true{{else}}false{{/if}}',
        },
      };
      const context = { hideBlock: true };
      
      const result = evaluateHiddenStatus(block, context);
      
      expect(result).toBe(true);
    });

    test('given a field descriptor with hidden template, should evaluate status.hidden template returning visibility state', () => {
      const field: FieldDescriptor = {
        id: 'field1',
        type: 'text',
        label: 'Field 1',
        validation: [],
        status: {
          hidden: '{{#if hideField}}true{{else}}false{{/if}}',
        },
      };
      const context = { hideField: false };
      
      const result = evaluateHiddenStatus(field, context);
      
      expect(result).toBe(false);
    });

    test('given no hidden template, should return false (visible by default)', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
      };
      
      const result = evaluateHiddenStatus(block, {});
      
      expect(result).toBe(false);
    });

    test('given hidden template evaluating to "true" string, should return true', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
        status: {
          hidden: 'true',
        },
      };
      
      const result = evaluateHiddenStatus(block, {});
      
      expect(result).toBe(true);
    });
  });

  describe('evaluateDisabledStatus', () => {
    test('given a block descriptor with disabled template, should evaluate status.disabled template returning enabled state', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
        status: {
          disabled: '{{#if readonly}}true{{else}}false{{/if}}',
        },
      };
      const context = { readonly: true };
      
      const result = evaluateDisabledStatus(block, context);
      
      expect(result).toBe(true);
    });

    test('given a field descriptor with disabled template, should evaluate status.disabled template returning enabled state', () => {
      const field: FieldDescriptor = {
        id: 'field1',
        type: 'text',
        label: 'Field 1',
        validation: [],
        status: {
          disabled: '{{#if (eq user.role "viewer")}}true{{else}}false{{/if}}',
        },
      };
      const context = { user: { role: 'viewer' } };
      
      const result = evaluateDisabledStatus(field, context);
      
      expect(result).toBe(true);
    });

    test('given no disabled template, should return false (enabled by default)', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
      };
      
      const result = evaluateDisabledStatus(block, {});
      
      expect(result).toBe(false);
    });
  });

  describe('evaluateReadonlyStatus', () => {
    test('given a block descriptor with readonly template, should evaluate status.readonly template if present', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
        status: {
          readonly: '{{#if isReadonly}}true{{else}}false{{/if}}',
        },
      };
      const context = { isReadonly: true };
      
      const result = evaluateReadonlyStatus(block, context);
      
      expect(result).toBe(true);
    });

    test('given a field descriptor with readonly template, should evaluate status.readonly template if present', () => {
      const field: FieldDescriptor = {
        id: 'field1',
        type: 'text',
        label: 'Field 1',
        validation: [],
        status: {
          readonly: '{{#if (eq user.role "viewer")}}true{{else}}false{{/if}}',
        },
      };
      const context = { user: { role: 'viewer' } };
      
      const result = evaluateReadonlyStatus(field, context);
      
      expect(result).toBe(true);
    });

    test('given no readonly template, should return false (not readonly by default)', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
      };
      
      const result = evaluateReadonlyStatus(block, {});
      
      expect(result).toBe(false);
    });

    test('given readonly template evaluating to "true" string, should return true', () => {
      const block: BlockDescriptor = {
        id: 'block1',
        title: 'Block 1',
        fields: [],
        status: {
          readonly: 'true',
        },
      };
      
      const result = evaluateReadonlyStatus(block, {});
      
      expect(result).toBe(true);
    });
  });

  describe('repeatable groups in form context', () => {
    test('given repeatable group array in context, should be accessible via direct property access', () => {
      const template = '{{addresses.length}}';
      const context = {
        addresses: [
          { street: '123 Main St', city: 'New York' },
          { street: '456 Oak Ave', city: 'Boston' },
        ],
      };
      
      const result = evaluateTemplate(template, context);
      
      expect(result).toBe('2');
    });

    test('given repeatable group array in context, should support {{#each}} iteration', () => {
      const template = '{{#each addresses}}{{street}}, {{/each}}';
      const context = {
        addresses: [
          { street: '123 Main St', city: 'New York' },
          { street: '456 Oak Ave', city: 'Boston' },
        ],
      };
      
      const result = evaluateTemplate(template, context);
      
      expect(result).toBe('123 Main St, 456 Oak Ave, ');
    });

    test('given repeatable group array in context, should access individual items via index', () => {
      const template = '{{addresses.0.street}}';
      const context = {
        addresses: [
          { street: '123 Main St', city: 'New York' },
        ],
      };
      
      const result = evaluateTemplate(template, context);
      
      expect(result).toBe('123 Main St');
    });

    test('given repeatable group array in context, should support isEmpty helper for arrays', () => {
      const template = '{{#if (isEmpty addresses)}}empty{{else}}not empty{{/if}}';
      const emptyContext = { addresses: [] };
      const filledContext = {
        addresses: [{ street: '123 Main St', city: 'New York' }],
      };
      
      const emptyResult = evaluateTemplate(template, emptyContext);
      const filledResult = evaluateTemplate(template, filledContext);
      
      expect(emptyResult).toBe('empty');
      expect(filledResult).toBe('not empty');
    });

    test('given repeatable group in formData nested property, should be accessible', () => {
      const template = '{{formData.addresses.length}}';
      const context = {
        formData: {
          addresses: [
            { street: '123 Main St', city: 'New York' },
          ],
        },
      };
      
      const result = evaluateTemplate(template, context);
      
      expect(result).toBe('1');
    });

    test('given repeatable group with status template, should evaluate using array data', () => {
      const block: BlockDescriptor = {
        id: 'addresses-block',
        title: 'Addresses',
        repeatable: true,
        fields: [],
        status: {
          hidden: '{{isEmpty addresses}}',
        },
      };
      const emptyContext = { addresses: [] };
      const filledContext = {
        addresses: [{ street: '123 Main St', city: 'New York' }],
      };
      
      const emptyResult = evaluateHiddenStatus(block, emptyContext);
      const filledResult = evaluateHiddenStatus(block, filledContext);
      
      expect(emptyResult).toBe(true); // Hidden when empty
      expect(filledResult).toBe(false); // Visible when has items
    });

    test('given repeatable group with length check in status template, should evaluate correctly', () => {
      const block: BlockDescriptor = {
        id: 'addresses-block',
        title: 'Addresses',
        repeatable: true,
        fields: [],
        status: {
          disabled: '{{gte addresses.length 5}}',
        },
      };
      const context1 = { addresses: [{ street: '123' }, { street: '456' }, { street: '789' }, { street: '101' }, { street: '112' }] };
      const context2 = { addresses: [{ street: '123' }] };
      
      const result1 = evaluateDisabledStatus(block, context1);
      const result2 = evaluateDisabledStatus(block, context2);
      
      expect(result1).toBe(true); // Disabled when >= 5
      expect(result2).toBe(false); // Enabled when < 5
    });
  });
});
