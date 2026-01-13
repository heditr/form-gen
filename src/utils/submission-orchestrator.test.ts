/**
 * Tests for submission orchestrator
 * 
 * Following TDD: Tests verify form submission orchestration with validation,
 * error handling, payload template evaluation, and success messaging.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  createSubmissionOrchestrator,
  scrollToFirstError,
  evaluatePayloadTemplate,
  constructSubmissionRequest,
} from './submission-orchestrator';
import type {
  GlobalFormDescriptor,
  SubmissionConfig,
  FormData,
} from '@/types/form-descriptor';
import type { UseFormReturn, FieldErrors } from 'react-hook-form';

// Mock react-hook-form types
type MockFormValues = Record<string, unknown>;

describe('submission orchestrator', () => {
  describe('scrollToFirstError', () => {
    beforeEach(() => {
      // Mock scrollIntoView
      Element.prototype.scrollIntoView = vi.fn();
      // Mock querySelector
      document.querySelector = vi.fn();
    });

    test('given validation errors, should scroll to first error field', () => {
      const errors: FieldErrors<MockFormValues> = {
        email: { type: 'required', message: 'Email is required' },
        password: { type: 'minLength', message: 'Password too short' },
      };

      const mockElement = document.createElement('div');
      mockElement.id = 'email';
      vi.mocked(document.querySelector).mockReturnValue(mockElement);

      scrollToFirstError(errors);

      expect(document.querySelector).toHaveBeenCalledWith('[name="email"]');
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });

    test('given no errors, should not scroll', () => {
      const errors: FieldErrors<MockFormValues> = {};

      scrollToFirstError(errors);

      expect(document.querySelector).not.toHaveBeenCalled();
    });

    test('given error field not found in DOM, should not throw', () => {
      const errors: FieldErrors<MockFormValues> = {
        email: { type: 'required', message: 'Email is required' },
      };

      vi.mocked(document.querySelector).mockReturnValue(null);

      expect(() => scrollToFirstError(errors)).not.toThrow();
    });
  });

  describe('evaluatePayloadTemplate', () => {
    test('given payload template, should evaluate template with react-hook-form form values', () => {
      const template = '{"email": "{{email}}", "name": "{{name}}"}';
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      const payload = evaluatePayloadTemplate(template, formValues);

      expect(payload).toBe('{"email": "test@example.com", "name": "John Doe"}');
    });

    test('given no template, should return JSON stringified form values', () => {
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      const payload = evaluatePayloadTemplate(undefined, formValues);

      expect(payload).toBe(JSON.stringify(formValues));
    });

    test('given empty template, should return JSON stringified form values', () => {
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
      };

      const payload = evaluatePayloadTemplate('', formValues);

      expect(payload).toBe(JSON.stringify(formValues));
    });
  });

  describe('constructSubmissionRequest', () => {
    test('given submission config, should construct request with URL, method, headers, and auth', () => {
      const config: SubmissionConfig = {
        url: '/api/submit',
        method: 'POST',
        headers: {
          'X-Custom-Header': 'value',
        },
        auth: {
          type: 'bearer',
          token: 'test-token',
        },
      };

      const payload = '{"email": "test@example.com"}';

      const request = constructSubmissionRequest(config, payload);

      expect(request.method).toBe('POST');
      expect((request.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect((request.headers as Record<string, string>)['X-Custom-Header']).toBe('value');
      expect((request.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
      expect(request.body).toBe(payload);
    });

    test('given API key auth, should set custom header', () => {
      const config: SubmissionConfig = {
        url: '/api/submit',
        method: 'POST',
        auth: {
          type: 'apikey',
          token: 'api-key-123',
          headerName: 'X-API-Key',
        },
      };

      const payload = '{}';

      const request = constructSubmissionRequest(config, payload);

      expect((request.headers as Record<string, string>)['X-API-Key']).toBe('api-key-123');
      expect((request.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });

    test('given no auth, should not include auth headers', () => {
      const config: SubmissionConfig = {
        url: '/api/submit',
        method: 'POST',
      };

      const payload = '{}';

      const request = constructSubmissionRequest(config, payload);

      expect((request.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });

    test('given GET method, should not include body', () => {
      const config: SubmissionConfig = {
        url: '/api/submit',
        method: 'GET',
      };

      const payload = '{}';

      const request = constructSubmissionRequest(config, payload);

      expect(request.body).toBeUndefined();
    });
  });

  describe('createSubmissionOrchestrator', () => {
    test('given react-hook-form handleSubmit, should validate all visible fields first', async () => {
      const mockForm = {
        handleSubmit: vi.fn((onValid) => async (e?: unknown) => {
          // Simulate validation passing
          await onValid({ email: 'test@example.com' });
        }),
        formState: {
          errors: {},
        },
        getValues: vi.fn(() => ({ email: 'test@example.com' })),
      } as unknown as UseFormReturn<MockFormValues>;

      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const orchestrator = createSubmissionOrchestrator();
      const mockSetError = vi.fn();
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      const submitHandler = orchestrator.createSubmitHandler(
        mockForm,
        descriptor,
        {
          setError: mockSetError,
          onSuccess: mockOnSuccess,
          onError: mockOnError,
        }
      );

      await submitHandler();

      expect(mockForm.handleSubmit).toHaveBeenCalled();
    });

    test('given validation fails, should scroll to first error and prevent submission', async () => {
      const errors: FieldErrors<MockFormValues> = {
        email: { type: 'required', message: 'Email is required' },
      };

      const mockForm = {
        handleSubmit: vi.fn((onValid, onInvalid) => async (e?: unknown) => {
          // Simulate validation failing
          await onInvalid(errors);
        }),
        formState: {
          errors,
        },
        getValues: vi.fn(() => ({})),
      } as unknown as UseFormReturn<MockFormValues>;

      const mockElement = document.createElement('div');
      mockElement.id = 'email';
      vi.mocked(document.querySelector).mockReturnValue(mockElement);

      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      const orchestrator = createSubmissionOrchestrator();
      const mockSetError = vi.fn();
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      const submitHandler = orchestrator.createSubmitHandler(
        mockForm,
        descriptor,
        {
          setError: mockSetError,
          onSuccess: mockOnSuccess,
          onError: mockOnError,
        }
      );

      await submitHandler();

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockElement.scrollIntoView).toHaveBeenCalled();
    });

    test('given backend errors, should map errors to react-hook-form field paths via setError()', async () => {
      const mockForm = {
        handleSubmit: vi.fn((onValid) => async (e?: unknown) => {
          await onValid({ email: 'test@example.com' });
        }),
        formState: {
          errors: {},
        },
        getValues: vi.fn(() => ({ email: 'test@example.com' })),
      } as unknown as UseFormReturn<MockFormValues>;

      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      // Mock fetch to return error response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          errors: [
            { field: 'email', message: 'Email already exists' },
            { field: 'password', message: 'Password too weak' },
          ],
        }),
      });

      const orchestrator = createSubmissionOrchestrator();
      const mockSetError = vi.fn();
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      const submitHandler = orchestrator.createSubmitHandler(
        mockForm,
        descriptor,
        {
          setError: mockSetError,
          onSuccess: mockOnSuccess,
          onError: mockOnError,
        }
      );

      await submitHandler();

      expect(mockSetError).toHaveBeenCalledTimes(2);
      expect(mockSetError).toHaveBeenCalledWith('email', {
        type: 'server',
        message: 'Email already exists',
      });
      expect(mockSetError).toHaveBeenCalledWith('password', {
        type: 'server',
        message: 'Password too weak',
      });
      expect(mockOnError).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    test('given success, should display success message', async () => {
      const mockForm = {
        handleSubmit: vi.fn((onValid) => async (e?: unknown) => {
          await onValid({ email: 'test@example.com' });
        }),
        formState: {
          errors: {},
        },
        getValues: vi.fn(() => ({ email: 'test@example.com' })),
      } as unknown as UseFormReturn<MockFormValues>;

      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      // Mock fetch to return success response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const orchestrator = createSubmissionOrchestrator();
      const mockSetError = vi.fn();
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      const submitHandler = orchestrator.createSubmitHandler(
        mockForm,
        descriptor,
        {
          setError: mockSetError,
          onSuccess: mockOnSuccess,
          onError: mockOnError,
        }
      );

      await submitHandler();

      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    test('given payload template, should evaluate template with react-hook-form form values', async () => {
      const mockForm = {
        handleSubmit: vi.fn((onValid) => async (e?: unknown) => {
          await onValid({ email: 'test@example.com', name: 'John' });
        }),
        formState: {
          errors: {},
        },
        getValues: vi.fn(() => ({ email: 'test@example.com', name: 'John' })),
      } as unknown as UseFormReturn<MockFormValues>;

      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
          payloadTemplate: '{"email": "{{email}}", "name": "{{name}}"}',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const orchestrator = createSubmissionOrchestrator();
      const mockSetError = vi.fn();
      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      const submitHandler = orchestrator.createSubmitHandler(
        mockForm,
        descriptor,
        {
          setError: mockSetError,
          onSuccess: mockOnSuccess,
          onError: mockOnError,
        }
      );

      await submitHandler();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: '{"email": "test@example.com", "name": "John"}',
        })
      );

      vi.restoreAllMocks();
    });
  });
});
