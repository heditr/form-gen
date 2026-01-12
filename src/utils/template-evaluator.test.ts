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
});
