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
  hasFileObjects,
  constructFormData,
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

      // Template evaluation returns parsed JSON object
      expect(payload).toEqual({ email: 'test@example.com', name: 'John Doe' });
    });

    test('given no template, should return form values object', () => {
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      const payload = evaluatePayloadTemplate(undefined, formValues);

      expect(payload).toEqual(formValues);
    });

    test('given empty template, should return form values object', () => {
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
      };

      const payload = evaluatePayloadTemplate('', formValues);

      expect(payload).toEqual(formValues);
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

      const request = constructSubmissionRequest(config, payload, false);

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

      const request = constructSubmissionRequest(config, payload, false);

      expect((request.headers as Record<string, string>)['X-API-Key']).toBe('api-key-123');
      expect((request.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });

    test('given no auth, should not include auth headers', () => {
      const config: SubmissionConfig = {
        url: '/api/submit',
        method: 'POST',
      };

      const payload = '{}';

      const request = constructSubmissionRequest(config, payload, false);

      expect((request.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });

    test('given GET method, should not include body', () => {
      const config: SubmissionConfig = {
        url: '/api/submit',
        method: 'GET',
      };

      const payload = '{}';

      const request = constructSubmissionRequest(config, payload, false);

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

      // Body should be JSON stringified evaluated payload
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.any(String),
        })
      );
      
      // Verify the body contains the expected data
      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const bodyString = requestInit.body as string;
      const bodyData = JSON.parse(bodyString);
      expect(bodyData).toEqual({ email: 'test@example.com', name: 'John' });

      vi.restoreAllMocks();
    });
  });

  describe('hasFileObjects', () => {
    test('given form data with File object, should return true', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        document: file,
      };

      expect(hasFileObjects(formValues)).toBe(true);
    });

    test('given form data with array of Files, should return true', () => {
      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        documents: [file1, file2],
      };

      expect(hasFileObjects(formValues)).toBe(true);
    });

    test('given form data with only URL strings, should return false', () => {
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        document: 'https://example.com/file.pdf',
      };

      expect(hasFileObjects(formValues)).toBe(false);
    });

    test('given form data with no files, should return false', () => {
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        name: 'John',
      };

      expect(hasFileObjects(formValues)).toBe(false);
    });
  });

  describe('constructFormData', () => {
    test('given form values with File objects, should construct FormData', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        document: file,
      };

      const formData = constructFormData(formValues, formValues);

      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('email')).toBe('test@example.com');
      expect(formData.get('document')).toBe(file);
    });

    test('given form values with array of Files, should append all files', () => {
      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        documents: [file1, file2],
      };

      const formData = constructFormData(formValues, formValues);

      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('email')).toBe('test@example.com');
      // FormData.getAll for arrays
      const documents = formData.getAll('documents');
      expect(documents).toHaveLength(2);
      expect(documents[0]).toBe(file1);
      expect(documents[1]).toBe(file2);
    });

    test('given form values with URL strings, should append as strings', () => {
      const formValues: Partial<FormData> = {
        email: 'test@example.com',
        document: 'https://example.com/file.pdf',
      };

      const formData = constructFormData(formValues, formValues);

      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('email')).toBe('test@example.com');
      expect(formData.get('document')).toBe('https://example.com/file.pdf');
    });
  });

  describe('multipart submission', () => {
    test('given form data with File objects, should use multipart/form-data', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const mockForm = {
        handleSubmit: vi.fn((onValid) => async (e?: unknown) => {
          await onValid({ email: 'test@example.com', document: file });
        }),
        formState: {
          errors: {},
        },
        getValues: vi.fn(() => ({ email: 'test@example.com', document: file })),
      } as unknown as UseFormReturn<MockFormValues>;

      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
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

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();
      
      // Verify Content-Type header is NOT set (browser sets boundary)
      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;
      expect(headers['Content-Type']).toBeUndefined();
      
      // Verify body is FormData
      expect(requestInit.body).toBeInstanceOf(FormData);

      vi.restoreAllMocks();
    });

    test('given form data with only URL strings, should use application/json', async () => {
      const mockForm = {
        handleSubmit: vi.fn((onValid) => async (e?: unknown) => {
          await onValid({ email: 'test@example.com', document: 'https://example.com/file.pdf' });
        }),
        formState: {
          errors: {},
        },
        getValues: vi.fn(() => ({ email: 'test@example.com', document: 'https://example.com/file.pdf' })),
      } as unknown as UseFormReturn<MockFormValues>;

      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
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

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();
      
      // Verify Content-Type header is set to application/json
      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      
      // Verify body is JSON string
      expect(typeof requestInit.body).toBe('string');

      vi.restoreAllMocks();
    });
  });
});
