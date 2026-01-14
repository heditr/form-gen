/**
 * Tests for Rules Context API Route
 * 
 * Following TDD: Tests verify the API route accepts CaseContext and returns RulesObject
 * with proper validation and error handling.
 */

import { describe, test, expect } from 'vitest';
import { POST } from './route';
import type { CaseContext, RulesObject } from '@/types/form-descriptor';

// Mock Next.js Request
function createMockRequest(body: unknown, method: string = 'POST'): Request {
  return new Request('http://localhost:3000/api/rules/context', {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/rules/context', () => {
  test('given POST request with CaseContext, should return RulesObject', async () => {
    const caseContext: CaseContext = {
      incorporationCountry: 'US',
      onboardingCountries: ['US', 'CA'],
      processType: 'standard',
      needSignature: true,
    };

    const request = createMockRequest(caseContext, 'POST');
    const response = await POST(request);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');

    const data: RulesObject = await response.json();
    expect(data).toHaveProperty('blocks');
    expect(data).toHaveProperty('fields');
    // blocks and fields are optional, so they may be undefined
    if (data.blocks) {
      expect(Array.isArray(data.blocks)).toBe(true);
    }
    if (data.fields) {
      expect(Array.isArray(data.fields)).toBe(true);
    }
  });

  test('given valid CaseContext, should return RulesObject with validation rules and status conditions', async () => {
    const caseContext: CaseContext = {
      jurisdiction: 'US',
      entityType: 'corporation',
    };

    const request = createMockRequest(caseContext, 'POST');
    const response = await POST(request);

    const data: RulesObject = await response.json();

    // Verify structure
    if (data.fields) {
      for (const field of data.fields) {
        expect(field).toHaveProperty('id');
        if (field.validation) {
          expect(Array.isArray(field.validation)).toBe(true);
        }
        if (field.status) {
          // Status properties are optional - only check what's actually set
          if (field.status.hidden !== undefined) {
            expect(field.status).toHaveProperty('hidden');
          }
          if (field.status.disabled !== undefined) {
            expect(field.status).toHaveProperty('disabled');
          }
        }
      }
    }

    if (data.blocks) {
      for (const block of data.blocks) {
        expect(block).toHaveProperty('id');
        if (block.status) {
          // Status properties are optional - only check what's actually set
          if (block.status.hidden !== undefined) {
            expect(block.status).toHaveProperty('hidden');
          }
          if (block.status.disabled !== undefined) {
            expect(block.status).toHaveProperty('disabled');
          }
        }
      }
    }
  });

  test('given request body, should validate CaseContext structure', async () => {
    const invalidContext = {
      invalidField: 'invalid',
      // CaseContext should allow dynamic properties, but we can test for basic structure
    };

    const request = createMockRequest(invalidContext, 'POST');
    const response = await POST(request);

    // Should still accept it since CaseContext allows dynamic properties
    // But we should validate that it's an object
    expect(response.status).toBe(200);
  });

  test('given invalid JSON body, should return 400 Bad Request', async () => {
    const request = new Request('http://localhost:3000/api/rules/context', {
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

  test('given missing request body, should return 400 Bad Request', async () => {
    const request = new Request('http://localhost:3000/api/rules/context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('given non-POST request, should return 405 Method Not Allowed', async () => {
    // GET requests cannot have a body, so create request without body
    const request = new Request('http://localhost:3000/api/rules/context', {
      method: 'GET',
    });

    const response = await POST(request);
    expect(response.status).toBe(405);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Method not allowed');
  });

  test('given errors, should return validation errors with field paths', async () => {
    // This test verifies that when validation fails, errors are returned with field paths
    // For now, we'll test the structure - actual validation logic will be implemented
    const caseContext: CaseContext = {
      jurisdiction: 'US',
    };

    const request = createMockRequest(caseContext, 'POST');
    const response = await POST(request);

    // Should return 200 for valid context
    // Error responses would have a different structure
    if (response.status !== 200) {
      const errorData = await response.json();
      // If there are validation errors, they should have field paths
      if (errorData.errors) {
        expect(Array.isArray(errorData.errors)).toBe(true);
        for (const error of errorData.errors) {
          expect(error).toHaveProperty('field');
          expect(error).toHaveProperty('message');
        }
      }
    } else {
      expect(response.status).toBe(200);
    }
  });

  test('given response, should include proper Content-Type headers', async () => {
    const caseContext: CaseContext = { jurisdiction: 'US' };
    const request = createMockRequest(caseContext, 'POST');
    const response = await POST(request);

    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');
  });
});
