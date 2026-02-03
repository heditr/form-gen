/**
 * Tests for Form Validate API Route
 * 
 * Following TDD: Tests verify the API route accepts caseId and formValues,
 * performs comprehensive validation, and returns field-level errors.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from './route';
import type { FormData, GlobalFormDescriptor, RulesObject } from '@/types/form-descriptor';

// Mock dependencies
const mockGetGlobalDescriptor = vi.fn();
const mockRehydrateRules = vi.fn();

vi.mock('@/app/api/form/global-descriptor/route', () => ({
  GET: (...args: unknown[]) => mockGetGlobalDescriptor(...args),
}));

vi.mock('@/app/api/rules/context/route', () => ({
  POST: (...args: unknown[]) => mockRehydrateRules(...args),
}));

// Mock Next.js Request
function createMockRequest(body: unknown, method: string = 'POST'): Request {
  return new Request('http://localhost:3000/api/form/validate', {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/form/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    const mockGlobalDescriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'basic-info',
          title: 'Basic Information',
          fields: [
            {
              id: 'name',
              type: 'text',
              label: 'Full Name',
              validation: [
                {
                  type: 'required',
                  message: 'Name is required',
                },
                {
                  type: 'minLength',
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              ],
            },
            {
              id: 'email',
              type: 'text',
              label: 'Email Address',
              validation: [
                {
                  type: 'required',
                  message: 'Email is required',
                },
                {
                  type: 'pattern',
                  value: '^[^@]+@[^@]+\\.[^@]+$',
                  message: 'Please enter a valid email address',
                },
              ],
            },
            {
              id: 'country',
              type: 'dropdown',
              label: 'Country',
              validation: [
                {
                  type: 'required',
                  message: 'Country is required',
                },
              ],
              isDiscriminant: true,
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    const mockRulesObject: RulesObject = {
      blocks: [],
      fields: [],
    };

    mockGetGlobalDescriptor.mockResolvedValue(
      NextResponse.json(mockGlobalDescriptor, { status: 200 })
    );

    mockRehydrateRules.mockResolvedValue(
      NextResponse.json(mockRulesObject, { status: 200 })
    );
  });

  test('given POST request with caseId and formValues, should return validation response', async () => {
    const requestBody = {
      caseId: 'test-case-123',
      formValues: {
        name: 'John Doe',
        email: 'john@example.com',
      } as Partial<FormData>,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('errors');
    expect(Array.isArray(data.errors)).toBe(true);
  });

  test('given valid formValues, should return empty errors array', async () => {
    const requestBody = {
      caseId: 'test-case-123',
      formValues: {
        name: 'John Doe',
        email: 'john@example.com',
        country: 'US',
      } as Partial<FormData>,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.errors).toEqual([]);
  });

  test('given validation failures, should return errors in react-hook-form compatible format', async () => {
    const requestBody = {
      caseId: 'test-case-123',
      formValues: {
        name: '', // Empty name should fail required validation
        email: 'invalid-email', // Invalid email format
      } as Partial<FormData>,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(Array.isArray(data.errors)).toBe(true);
    if (data.errors.length > 0) {
      for (const error of data.errors) {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('message');
        expect(typeof error.field).toBe('string');
        expect(typeof error.message).toBe('string');
      }
    }
  });

  test('given invalid JSON body, should return 400 Bad Request', async () => {
    const request = new Request('http://localhost:3000/api/form/validate', {
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
    const request = new Request('http://localhost:3000/api/form/validate', {
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
    const request = new Request('http://localhost:3000/api/form/validate', {
      method: 'GET',
    });

    const response = await POST(request);
    expect(response.status).toBe(405);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Method not allowed');
  });

  test('given response, should include proper Content-Type headers', async () => {
    const requestBody = {
      caseId: 'test-case-123',
      formValues: {} as Partial<FormData>,
    };

    const request = createMockRequest(requestBody, 'POST');
    const response = await POST(request);

    const contentType = response.headers.get('Content-Type');
    expect(contentType).toBe('application/json');
  });
});
