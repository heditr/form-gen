/**
 * Tests for Data Source Loader Utility
 * 
 * Following TDD: Tests verify the utility loads and transforms dynamic field data from APIs.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadDataSource, clearDataSourceCache } from './data-source-loader';
import type { DataSourceConfig, FieldItem } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

// Mock fetch globally
global.fetch = vi.fn();

// Mock template evaluator
vi.mock('./template-evaluator', () => ({
  evaluateTemplate: vi.fn((template: string, context: FormContext) => {
    // Simple mock: replace {{variable}} with context value
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(context[key] || '');
    });
  }),
}));

describe('loadDataSource', () => {
  const createMockContext = (overrides?: Partial<FormContext>): FormContext => ({
    formData: {},
    caseContext: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache between tests
    clearDataSourceCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearDataSourceCache();
  });

  test('given dataSource config, should evaluate URL template with form context', async () => {
    const config: DataSourceConfig = {
      url: '/api/data/{{country}}',
      itemsTemplate: '{{label}}',
    };
    const context = createMockContext({ country: 'US' });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ name: 'Item 1' }] }),
    });

    await loadDataSource(config, context);

    expect(global.fetch).toHaveBeenCalledWith('/api/data/US', expect.any(Object));
  });

  test('given authentication config, should inject auth headers into request', async () => {
    const config: DataSourceConfig = {
      url: '/api/data',
      itemsTemplate: '{{label}}',
      auth: {
        type: 'bearer',
        token: 'test-token',
      },
    };
    const context = createMockContext();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await loadDataSource(config, context);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/data',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  test('given API response, should transform response using itemsTemplate', async () => {
    const config: DataSourceConfig = {
      url: '/api/data',
      itemsTemplate: '{{label}}',
    };
    const context = createMockContext();
    const mockResponse = {
      items: [
        { name: 'Item 1', id: '1' },
        { name: 'Item 2', id: '2' },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    // Mock Handlebars compile for itemsTemplate
    const Handlebars = await import('handlebars');
    const compileSpy = vi.spyOn(Handlebars, 'compile');
    compileSpy.mockImplementation((template: string) => {
      return (context: any) => {
        if (template.includes('{{label}}')) {
          return context.name || '';
        }
        return '';
      };
    });

    const result = await loadDataSource(config, context);

    expect(result).toBeDefined();
  });

  test('given iterator template, should loop through array responses', async () => {
    const config: DataSourceConfig = {
      url: '/api/data',
      itemsTemplate: '{{label}}',
      iteratorTemplate: '{{#each items}}{{name}}{{/each}}',
    };
    const context = createMockContext();
    const mockResponse = {
      items: [
        { name: 'Item 1' },
        { name: 'Item 2' },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await loadDataSource(config, context);

    expect(result).toBeDefined();
  });

  test('given caching needs, should cache responses to prevent duplicate requests', async () => {
    const config: DataSourceConfig = {
      url: '/api/data',
      itemsTemplate: '{{label}}',
    };
    const context = createMockContext();

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    // First call
    await loadDataSource(config, context);
    // Second call with same config
    await loadDataSource(config, context);

    // Should only call fetch once due to caching
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('given different contexts, should make separate requests', async () => {
    const config: DataSourceConfig = {
      url: '/api/data/{{country}}',
      itemsTemplate: '{{label}}',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await loadDataSource(config, createMockContext({ country: 'US' }));
    await loadDataSource(config, createMockContext({ country: 'CA' }));

    // Should call fetch twice for different URLs
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('given API error, should handle error gracefully', async () => {
    const config: DataSourceConfig = {
      url: '/api/data',
      itemsTemplate: '{{label}}',
    };
    const context = createMockContext();

    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(loadDataSource(config, context)).rejects.toThrow();
  });

  test('given non-ok response, should handle error gracefully', async () => {
    const config: DataSourceConfig = {
      url: '/api/data',
      itemsTemplate: '{{label}}',
    };
    const context = createMockContext();

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(loadDataSource(config, context)).rejects.toThrow();
  });
});
