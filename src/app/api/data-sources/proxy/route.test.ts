/**
 * Tests for Data Source Proxy API Route
 * 
 * Following TDD: Tests verify the API route proxies data source requests
 * with secure authentication credentials.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from './route';
import type { FormContext } from '@/utils/template-evaluator';

// Mock fetch
global.fetch = vi.fn();

// Mock data source credentials
vi.mock('@/utils/data-source-credentials', () => ({
  getDataSourceCredentials: vi.fn(),
}));

// Mock Next.js Request
function createMockRequest(body: unknown, method: string = 'POST'): Request {
  return new Request('http://localhost:3000/api/data-sources/proxy', {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/data-sources/proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('given POST request with valid data source request, should proxy API call and return items', async () => {
    const { getDataSourceCredentials } = await import('@/utils/data-source-credentials');
    vi.mocked(getDataSourceCredentials).mockResolvedValue({
      type: 'bearer',
      token: 'secret-token',
    });

    // Mock external API response
    const mockApiResponse = [
      { id: 1, name: 'California', code: 'CA' },
      { id: 2, name: 'New York', code: 'NY' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const requestBody = {
      fieldId: 'state',
      dataSourceId: 'states-api',
      urlTemplate: '/api/external/states',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {} as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty('label');
    expect(data.items[0]).toHaveProperty('value');
  });

  test('given backend proxy request, should look up authentication credentials by dataSourceId', async () => {
    const { getDataSourceCredentials } = await import('@/utils/data-source-credentials');
    vi.mocked(getDataSourceCredentials).mockResolvedValue({
      type: 'apikey',
      token: 'api-key-123',
      headerName: 'X-API-Key',
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const requestBody = {
      fieldId: 'state',
      dataSourceId: 'states-api',
      urlTemplate: '/api/external/states',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {} as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    await POST(request);

    expect(getDataSourceCredentials).toHaveBeenCalledWith('states-api');
  });

  test('given authentication credentials, should make proxied API call with proper auth headers', async () => {
    const { getDataSourceCredentials } = await import('@/utils/data-source-credentials');
    vi.mocked(getDataSourceCredentials).mockResolvedValue({
      type: 'bearer',
      token: 'secret-token',
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const requestBody = {
      fieldId: 'state',
      dataSourceId: 'states-api',
      urlTemplate: '/api/external/states',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {} as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    await POST(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer secret-token',
        }),
      })
    );
  });

  test('given proxied API response, should transform response using itemsTemplate', async () => {
    const { getDataSourceCredentials } = await import('@/utils/data-source-credentials');
    vi.mocked(getDataSourceCredentials).mockResolvedValue({
      type: 'bearer',
      token: 'secret-token',
    });

    const mockApiResponse = [
      { id: 1, name: 'California', code: 'CA' },
      { id: 2, name: 'New York', code: 'NY' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const requestBody = {
      fieldId: 'state',
      dataSourceId: 'states-api',
      urlTemplate: '/api/external/states',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {} as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    const data = await response.json();
    expect(data.items).toEqual([
      { label: 'California', value: 'CA' },
      { label: 'New York', value: 'NY' },
    ]);
  });

  test('given data source proxy endpoint, should handle URL template evaluation server-side', async () => {
    const { getDataSourceCredentials } = await import('@/utils/data-source-credentials');
    vi.mocked(getDataSourceCredentials).mockResolvedValue({
      type: 'bearer',
      token: 'secret-token',
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const requestBody = {
      fieldId: 'state',
      dataSourceId: 'states-api',
      urlTemplate: '/api/external/states?country={{country}}',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {
        country: 'US',
      } as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    await POST(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('country=US'),
      expect.any(Object)
    );
  });

  test('given data source errors, should return appropriate error responses', async () => {
    const { getDataSourceCredentials } = await import('@/utils/data-source-credentials');
    vi.mocked(getDataSourceCredentials).mockResolvedValue({
      type: 'bearer',
      token: 'secret-token',
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    const requestBody = {
      fieldId: 'state',
      dataSourceId: 'states-api',
      urlTemplate: '/api/external/states',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {} as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('given missing dataSourceId, should return error indicating configuration is incomplete', async () => {
    const requestBody = {
      fieldId: 'state',
      // Missing dataSourceId
      urlTemplate: '/api/external/states',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {} as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('dataSourceId');
  });

  test('given invalid JSON body, should return 400 Bad Request', async () => {
    const request = new Request('http://localhost:3000/api/data-sources/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('given non-POST request, should return 405 Method Not Allowed', async () => {
    const request = new Request('http://localhost:3000/api/data-sources/proxy', {
      method: 'GET',
    });

    const response = await POST(request);
    expect(response.status).toBe(405);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Method not allowed');
  });

  test('given basic authentication credentials, should make proxied API call with Basic auth header', async () => {
    const { getDataSourceCredentials } = await import('@/utils/data-source-credentials');
    vi.mocked(getDataSourceCredentials).mockResolvedValue({
      type: 'basic',
      username: 'testuser',
      password: 'testpass',
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const requestBody = {
      fieldId: 'state',
      dataSourceId: 'states-api',
      urlTemplate: '/api/external/states',
      itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
      formContext: {} as FormContext,
    };

    const request = createMockRequest(requestBody, 'POST');
    await POST(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': expect.stringMatching(/^Basic /),
        }),
      })
    );

    // Verify the Basic auth header contains the base64 encoded credentials
    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const headers = fetchCall[1]?.headers as Record<string, string>;
    const authHeader = headers['Authorization'];
    expect(authHeader).toBe('Basic dGVzdHVzZXI6dGVzdHBhc3M='); // base64('testuser:testpass')
  });
});
