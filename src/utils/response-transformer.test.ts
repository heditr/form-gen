/**
 * Tests for Response Transformer Utility
 * 
 * Following TDD: Tests verify transformation of API responses into dropdown items.
 */

import { describe, test, expect } from 'vitest';
import { transformResponse, transformItem } from './response-transformer';
import type { DataSourceConfig } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

describe('Response Transformer', () => {
  const createMockContext = (overrides?: Partial<FormContext>): FormContext => ({
    formData: {},
    caseContext: {},
    ...overrides,
  });

  const createMockConfig = (overrides?: Partial<DataSourceConfig>): DataSourceConfig => ({
    url: '/api/data',
    itemsTemplate: '{{item.label}}:{{item.value}}',
    ...overrides,
  });

  describe('transformItem', () => {
    test('given item with label and value, should extract label and value', () => {
      const item = { label: 'Test Label', value: 'test-value' };
      // Template returns JSON string that can be parsed
      const config = createMockConfig({ 
        itemsTemplate: '{"label":"{{item.label}}","value":"{{item.value}}"}',
      });
      const context = createMockContext();

      const result = transformItem(item, config.itemsTemplate, context);

      expect(result).toEqual({
        label: 'Test Label',
        value: 'test-value',
      });
    });

    test('given itemsTemplate returning JSON, should parse and extract label/value', () => {
      const item = { name: 'Item Name', id: 123 };
      // Template returns valid JSON string with both label and value as strings
      const config = createMockConfig({
        itemsTemplate: '{"label":"{{item.name}}","value":"{{item.id}}"}',
      });
      const context = createMockContext();

      const result = transformItem(item, config.itemsTemplate, context);

      expect(result).toEqual({
        label: 'Item Name',
        value: '123', // Handlebars converts numbers to strings in templates
      });
      expect(result.label).toBe('Item Name');
      expect(result.value).toBe('123');
    });

    test('given itemsTemplate returning string, should use as label and extract value from item', () => {
      const item = { name: 'Item Name', value: 'item-value' };
      const config = createMockConfig({
        itemsTemplate: '{{item.name}}',
      });
      const context = createMockContext();

      const result = transformItem(item, config.itemsTemplate, context);

      expect(result).toEqual({
        label: 'Item Name',
        value: 'item-value',
      });
    });

    test('given item without value property, should use template result as value', () => {
      const item = { name: 'Item Name' };
      const config = createMockConfig({
        itemsTemplate: '{{item.name}}',
      });
      const context = createMockContext();

      const result = transformItem(item, config.itemsTemplate, context);

      expect(result).toEqual({
        label: 'Item Name',
        value: 'Item Name',
      });
    });

    test('given non-object item, should use template result as both label and value', () => {
      const item = 'simple string';
      const config = createMockConfig({
        itemsTemplate: '{{item}}',
      });
      const context = createMockContext();

      const result = transformItem(item, config.itemsTemplate, context);

      expect(result).toEqual({
        label: 'simple string',
        value: 'simple string',
      });
    });

    test('given itemsTemplate with form context, should evaluate with context', () => {
      const item = { id: 1, name: 'Item' };
      const config = createMockConfig({
        itemsTemplate: '{{item.name}} ({{formData.category}})',
      });
      const context = createMockContext({
        formData: { category: 'Test Category' },
      });

      const result = transformItem(item, config.itemsTemplate, context);

      expect(result.label).toContain('Item');
      expect(result.label).toContain('Test Category');
    });
  });

  describe('transformResponse', () => {
    test('given array response, should transform each item', () => {
      const data = [
        { label: 'Item 1', value: 'v1' },
        { label: 'Item 2', value: 'v2' },
      ];
      // Template returns JSON string that can be parsed
      const config = createMockConfig({ 
        itemsTemplate: '{"label":"{{item.label}}","value":"{{item.value}}"}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Item 1', value: 'v1' });
      expect(result[1]).toEqual({ label: 'Item 2', value: 'v2' });
    });

    test('given single object response, should return array with one item', () => {
      const data = { label: 'Single Item', value: 'single' };
      // Template returns JSON string that can be parsed
      const config = createMockConfig({ 
        itemsTemplate: '{"label":"{{item.label}}","value":"{{item.value}}"}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Single Item', value: 'single' });
    });

    test('given iteratorTemplate, should iterate over array in response', () => {
      const data = [
        { name: 'Item 1', value: 1 },
        { name: 'Item 2', value: 2 },
      ];
      const config = createMockConfig({
        iteratorTemplate: '{{#each data}}{{this.name}}{{/each}}',
        itemsTemplate: '{{item.name}}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Item 1', value: 1 });
      expect(result[1]).toEqual({ label: 'Item 2', value: 2 });
    });

    test('given iteratorTemplate with non-array data, should still transform single item', () => {
      const data = { name: 'Single Item', value: 1 };
      const config = createMockConfig({
        iteratorTemplate: '{{#each data}}{{this.name}}{{/each}}',
        itemsTemplate: '{{item.name}}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ label: 'Single Item', value: 1 });
    });

    test('given empty array, should return empty array', () => {
      const data: unknown[] = [];
      const config = createMockConfig({ itemsTemplate: '{{item.label}}' });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(0);
    });

    test('given nested response with iteratorTemplate path, should extract and transform nested array', () => {
      const data = {
        results: [
          { title: 'Title 1', identifier: 'id1' },
          { title: 'Title 2', identifier: 'id2' },
        ],
      };
      const config = createMockConfig({
        iteratorTemplate: 'results',
        itemsTemplate: '{{item.title}}:{{item.identifier}}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Title 1:id1', value: 'Title 1:id1' });
      expect(result[1]).toEqual({ label: 'Title 2:id2', value: 'Title 2:id2' });
    });

    test('given nested response with iteratorTemplate Handlebars expression evaluating to path, should extract and transform nested array', () => {
      const data = {
        data: {
          items: [
            { name: 'Item 1', code: 'A1' },
            { name: 'Item 2', code: 'A2' },
          ],
        },
      };
      // Handlebars expression that evaluates to a path string
      const context = createMockContext({
        arrayPath: 'data.items',
      });
      const config = createMockConfig({
        iteratorTemplate: '{{arrayPath}}',
        itemsTemplate: '{{item.name}} ({{item.code}})',
      });

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Item 1 (A1)', value: 'Item 1 (A1)' });
      expect(result[1]).toEqual({ label: 'Item 2 (A2)', value: 'Item 2 (A2)' });
    });

    test('given nested response with deep path, should extract nested array', () => {
      const data = {
        response: {
          payload: {
            list: [
              { label: 'Option 1', value: 'opt1' },
              { label: 'Option 2', value: 'opt2' },
            ],
          },
        },
      };
      const config = createMockConfig({
        iteratorTemplate: 'response.payload.list',
        itemsTemplate: '{"label":"{{item.label}}","value":"{{item.value}}"}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ label: 'Option 1', value: 'opt1' });
      expect(result[1]).toEqual({ label: 'Option 2', value: 'opt2' });
    });

    test('given itemsTemplate with RESPONSE access, should access full response', () => {
      const data = {
        metadata: { version: '1.0' },
        items: [
          { name: 'Item 1', id: 1 },
        ],
      };
      const config = createMockConfig({
        iteratorTemplate: 'items',
        itemsTemplate: '{{item.name}} (v{{RESPONSE.metadata.version}})',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Item 1 (v1.0)');
    });

    test('given iteratorTemplate with simple path, should extract array from nested object', () => {
      const data = {
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' },
        ],
      };
      const config = createMockConfig({
        iteratorTemplate: 'items',
        itemsTemplate: '{{item.name}}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Item 1');
      expect(result[1].label).toBe('Item 2');
    });

    test('given invalid iteratorTemplate path, should fall back to direct data access', () => {
      const data = [
        { name: 'Item 1' },
        { name: 'Item 2' },
      ];
      const config = createMockConfig({
        iteratorTemplate: 'nonexistent.path',
        itemsTemplate: '{{item.name}}',
      });
      const context = createMockContext();

      const result = transformResponse(data, config, context);

      // Should fall back to treating data as array directly
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Item 1');
      expect(result[1].label).toBe('Item 2');
    });

    test('given complex nested response without iteratorTemplate, should transform single object', () => {
      const data = {
        results: [
          { title: 'Title 1', identifier: 'id1' },
          { title: 'Title 2', identifier: 'id2' },
        ],
      };
      const config = createMockConfig({
        itemsTemplate: '{{item.results}}',
      });
      const context = createMockContext();

      // Without iteratorTemplate, it will try to transform the whole object
      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBeTruthy();
    });
  });
});
