/**
 * Tests for Global Descriptor API Route
 * 
 * Following TDD: Tests verify the API route returns GlobalFormDescriptor JSON
 * with proper headers and error handling.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';

// Mock Next.js Request
function createMockRequest(method: string = 'GET'): Request {
  return new Request('http://localhost:3000/api/form/global-descriptor', {
    method,
  });
}

describe('GET /api/form/global-descriptor', () => {
  test('given GET request, should return GlobalFormDescriptor JSON', async () => {
    const request = createMockRequest('GET');
    const response = await GET(request);
    
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    
    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');
    
    const data: GlobalFormDescriptor = await response.json();
    expect(data).toHaveProperty('blocks');
    expect(data).toHaveProperty('submission');
    expect(Array.isArray(data.blocks)).toBe(true);
    expect(data.submission).toHaveProperty('url');
    expect(data.submission).toHaveProperty('method');
  });

  test('given GET request, should return valid GlobalFormDescriptor structure', async () => {
    const request = createMockRequest('GET');
    const response = await GET(request);
    
    const data: GlobalFormDescriptor = await response.json();
    
    // Verify structure
    expect(data).toHaveProperty('blocks');
    expect(Array.isArray(data.blocks)).toBe(true);
    expect(data).toHaveProperty('submission');
    expect(data.submission).toHaveProperty('url');
    expect(data.submission).toHaveProperty('method');
    
    // Verify submission method is valid
    expect(['GET', 'POST', 'PUT', 'PATCH']).toContain(data.submission.method);
  });

  test('given request, should include proper Content-Type header', async () => {
    const request = createMockRequest('GET');
    const response = await GET(request);
    
    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');
  });

  test('given error scenario, should handle errors with appropriate HTTP status codes', async () => {
    // This test will verify error handling once we implement it
    // For now, we expect 200 for successful requests
    const request = createMockRequest('GET');
    const response = await GET(request);
    
    // Should return 200 for successful descriptor load
    expect(response.status).toBe(200);
  });

  test('given non-GET request, should return 405 Method Not Allowed', async () => {
    const request = createMockRequest('POST');
    const response = await GET(request);
    
    // Our handler checks the method and returns 405 for non-GET requests
    expect(response.status).toBe(405);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Method not allowed');
  });
});
