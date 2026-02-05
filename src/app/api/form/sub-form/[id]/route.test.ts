/**
 * Tests for Sub-Form API Route
 * 
 * Following TDD: Tests verify the API route returns SubFormDescriptor JSON
 * with proper headers and error handling.
 */

import { describe, test, expect } from 'vitest';
import { GET } from './route';
import type { SubFormDescriptor } from '@/types/form-descriptor';

// Mock Next.js Request with dynamic route params
function createMockRequest(subFormId: string, method: string = 'GET'): Request {
  return new Request(`http://localhost:3000/api/form/sub-form/${subFormId}`, {
    method,
  });
}

describe('GET /api/form/sub-form/:id', () => {
  test('given GET request with valid sub-form ID, should return SubFormDescriptor JSON', async () => {
    const request = createMockRequest('address');
    const response = await GET(request, { params: { id: 'address' } });
    
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    
    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');
    
    const data: SubFormDescriptor = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('blocks');
    expect(Array.isArray(data.blocks)).toBe(true);
  });

  test('given GET request, should return valid SubFormDescriptor structure', async () => {
    const request = createMockRequest('address');
    const response = await GET(request, { params: { id: 'address' } });
    
    const data: SubFormDescriptor = await response.json();
    
    // Verify required properties
    expect(data.id).toBe('address');
    expect(typeof data.title).toBe('string');
    expect(typeof data.version).toBe('string');
    expect(Array.isArray(data.blocks)).toBe(true);
    
    // Submission is optional
    if (data.submission) {
      expect(data.submission).toHaveProperty('url');
      expect(data.submission).toHaveProperty('method');
    }
  });

  test('given GET request with non-existent sub-form ID, should return 404', async () => {
    const request = createMockRequest('non-existent');
    const response = await GET(request, { params: { id: 'non-existent' } });
    
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('not found');
  });

  test('given non-GET request, should return 405 Method Not Allowed', async () => {
    const request = createMockRequest('address', 'POST');
    const response = await GET(request, { params: { id: 'address' } });
    
    expect(response.status).toBe(405);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Method not allowed');
  });

  test('given GET request, should include proper Content-Type header', async () => {
    const request = createMockRequest('address');
    const response = await GET(request, { params: { id: 'address' } });
    
    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');
  });
});
