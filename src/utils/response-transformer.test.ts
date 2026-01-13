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

    test('given complex nested response, should transform correctly', () => {
      const data = {
        results: [
          { title: 'Title 1', identifier: 'id1' },
          { title: 'Title 2', identifier: 'id2' },
        ],
      };
      const config = createMockConfig({
        itemsTemplate: '{{item.title}}:{{item.identifier}}',
      });
      const context = createMockContext();

      // Note: This test assumes the data structure matches what the transformer expects
      // In practice, iteratorTemplate might be used to extract results array first
      const result = transformResponse(data, config, context);

      expect(result).toHaveLength(1);
      // The transformer will try to transform the whole object
      expect(result[0].label).toBeTruthy();
    });
  });
});
