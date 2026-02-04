/**
 * Tests for Data Source Proxy
 * 
 * Following TDD: Tests verify the proxy utility calls the backend proxy endpoint
 * and handles responses/errors correctly.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { loadDataSourceViaProxy } from './data-source-proxy';
import type { DataSourceConfig } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

// Mock fetch
global.fetch = vi.fn();

describe('loadDataSourceViaProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('given field with dataSourceId, should call proxy endpoint with correct parameters', async () => {
    const mockItems = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as Response);

    const config: DataSourceConfig = {
      url: '/api/external/data',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      dataSourceId: 'test-api',
    };

    const formContext: FormContext = {
      country: 'US',
    };

    const items = await loadDataSourceViaProxy('testField', config, formContext);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/data-sources/proxy',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldId: 'testField',
          dataSourceId: 'test-api',
          urlTemplate: '/api/external/data',
          itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
          formContext,
        }),
      })
    );

    expect(items).toEqual(mockItems);
  });

  test('given missing dataSourceId, should throw error indicating configuration is incomplete', async () => {
    const config: DataSourceConfig = {
      url: '/api/external/data',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      // Missing dataSourceId
    };

    const formContext: FormContext = {};

    await expect(
      loadDataSourceViaProxy('testField', config, formContext)
    ).rejects.toThrow('Data source configuration is incomplete: dataSourceId is required');
  });

  test('given proxy error response, should throw error with message from response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Data source configuration is incomplete: credentials not found' }),
    } as Response);

    const config: DataSourceConfig = {
      url: '/api/external/data',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      dataSourceId: 'invalid-api',
    };

    const formContext: FormContext = {};

    await expect(
      loadDataSourceViaProxy('testField', config, formContext)
    ).rejects.toThrow('Data source configuration is incomplete: credentials not found');
  });

  test('given proxy non-JSON error response, should throw error with status message', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('Not JSON');
      },
    } as Response);

    const config: DataSourceConfig = {
      url: '/api/external/data',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      dataSourceId: 'test-api',
    };

    const formContext: FormContext = {};

    await expect(
      loadDataSourceViaProxy('testField', config, formContext)
    ).rejects.toThrow('Failed to load data source: 500 Internal Server Error');
  });
});
