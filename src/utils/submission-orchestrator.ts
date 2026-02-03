/**
 * Submission Orchestrator - Utility for form submission using react-hook-form
 * 
 * Provides functions to:
 * - Validate all visible fields before submission
 * - Scroll to first error if validation fails
 * - Evaluate payload templates with form values
 * - Construct submission requests with auth and headers
 * - Map backend errors to react-hook-form field paths
 * - Handle success and error callbacks
 */

import type { UseFormReturn, FieldErrors } from 'react-hook-form';
import { evaluateTemplate } from './template-evaluator';
import { mapBackendErrorsToForm, type BackendError } from './form-descriptor-integration';
import type {
  GlobalFormDescriptor,
  SubmissionConfig,
  FormData,
} from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

/**
 * Backend error response format
 */
export interface BackendErrorResponse {
  error?: string;
  errors?: BackendError[];
}

/**
 * Submission orchestrator options
 */
export interface SubmissionOrchestratorOptions {
  /**
   * Function to set error on a field (from react-hook-form)
   */
  setError: (field: string, error: { type: string; message: string }) => void;

  /**
   * Success callback
   */
  onSuccess?: (response: unknown) => void;

  /**
   * Error callback
   */
  onError?: (error: Error | BackendErrorResponse) => void;
}

/**
 * Scroll to the first error field in the form
 * 
 * @param errors - Field errors from react-hook-form
 */
export function scrollToFirstError<T extends Record<string, unknown>>(
  errors: FieldErrors<T>
): void {
  // Get the first error field name
  const firstErrorField = Object.keys(errors)[0];
  if (!firstErrorField) {
    return;
  }

  // Find the field element in the DOM
  const fieldElement = document.querySelector(`[name="${firstErrorField}"]`);
  if (!fieldElement) {
    return;
  }

  // Scroll to the field
  fieldElement.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
}

/**
 * Check if form data contains File objects (pending uploads)
 * 
 * @param formValues - Form values to check
 * @returns True if form data contains File objects
 */
export function hasFileObjects(formValues: Partial<FormData>): boolean {
  for (const value of Object.values(formValues)) {
    if (value instanceof File) {
      return true;
    }
    if (Array.isArray(value) && value.some(item => item instanceof File)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluate payload template with form values
 * 
 * @param template - Optional Handlebars template for payload transformation
 * @param formValues - Form values from react-hook-form
 * @returns Evaluated payload as JSON string or object (for multipart)
 */
export function evaluatePayloadTemplate(
  template: string | undefined,
  formValues: Partial<FormData>
): string | Partial<FormData> {
  // If no template provided, return form values directly (for multipart) or JSON stringified (for JSON)
  if (!template || template.trim() === '') {
    return formValues;
  }

  // Evaluate template with form values as context
  const context: FormContext = {
    formData: formValues,
    ...formValues, // Also allow direct access to form values
  };

  const evaluated = evaluateTemplate(template, context);
  
  // If template evaluation returns empty, return form values directly
  if (!evaluated || evaluated.trim() === '') {
    return formValues;
  }

  // Try to parse as JSON, if it fails, return as string
  try {
    return JSON.parse(evaluated);
  } catch {
    // If not valid JSON, return as string (for JSON submission)
    return evaluated;
  }
}

/**
 * Construct FormData from form values for multipart submission
 * 
 * @param formValues - Form values (may contain File objects)
 * @param evaluatedPayload - Evaluated payload from template (object)
 * @returns FormData instance
 */
export function constructFormData(
  formValues: Partial<FormData>,
  evaluatedPayload: Partial<FormData>
): FormData {
  const formData = new FormData();

  // Use evaluated payload if it's an object, otherwise use original form values
  const dataToUse = typeof evaluatedPayload === 'object' && !Array.isArray(evaluatedPayload) && evaluatedPayload !== null
    ? evaluatedPayload
    : formValues;

  // Add all fields to FormData
  for (const [key, value] of Object.entries(dataToUse)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (value instanceof File) {
      // Single file
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      // Array of files or other values
      for (const item of value) {
        if (item instanceof File) {
          formData.append(key, item);
        } else {
          // For non-file arrays, append as JSON string
          formData.append(key, JSON.stringify(item));
        }
      }
    } else {
      // Regular field - convert to string
      formData.append(key, String(value));
    }
  }

  return formData;
}

/**
 * Construct submission request from config and payload
 * 
 * @param config - Submission configuration from descriptor
 * @param payload - Request body payload (JSON string or FormData)
 * @param hasFiles - Whether the payload contains File objects
 * @returns Request configuration for fetch
 */
export function constructSubmissionRequest(
  config: SubmissionConfig,
  payload: string | FormData,
  hasFiles: boolean = false
): RequestInit {
  const headers: Record<string, string> = {
    ...config.headers,
  };

  // Only set Content-Type for JSON submissions
  // For multipart/form-data, browser will set Content-Type with boundary
  if (!hasFiles) {
    headers['Content-Type'] = 'application/json';
  }

  // Add authentication headers
  if (config.auth) {
    if (config.auth.type === 'bearer' && config.auth.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    } else if (config.auth.type === 'apikey' && config.auth.token && config.auth.headerName) {
      headers[config.auth.headerName] = config.auth.token;
    } else if (config.auth.type === 'basic' && config.auth.username && config.auth.password) {
      // Basic authentication: Base64 encode username:password
      const credentials = typeof btoa !== 'undefined'
        ? btoa(`${config.auth.username}:${config.auth.password}`)
        : Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }
  }

  const requestInit: RequestInit = {
    method: config.method,
    headers,
  };

  // Only include body for methods that support it
  if (config.method !== 'GET') {
    requestInit.body = payload;
  }

  return requestInit;
}

/**
 * Submission orchestrator instance
 */
export interface SubmissionOrchestrator {
  /**
   * Create a submit handler for react-hook-form
   * 
   * @param form - React Hook Form instance
   * @param descriptor - Global form descriptor with submission config
   * @param options - Orchestrator options (setError, onSuccess, onError)
   * @returns Submit handler function
   */
  createSubmitHandler: <T extends Record<string, unknown>>(
    form: UseFormReturn<T>,
    descriptor: GlobalFormDescriptor,
    options: SubmissionOrchestratorOptions
  ) => (e?: React.BaseSyntheticEvent) => Promise<void>;
}

/**
 * Create a new submission orchestrator instance
 * 
 * @returns SubmissionOrchestrator instance
 */
export function createSubmissionOrchestrator(): SubmissionOrchestrator {
  const createSubmitHandler = <T extends Record<string, unknown>>(
    form: UseFormReturn<T>,
    descriptor: GlobalFormDescriptor,
    options: SubmissionOrchestratorOptions
  ) => {
    const { setError, onSuccess, onError } = options;
    const { submission } = descriptor;

    return form.handleSubmit(
      // onValid - called when validation passes
      async (validData: T) => {
        try {
          const formValues = validData as Partial<FormData>;
          
          // Check if form data contains File objects (pending uploads)
          const containsFiles = hasFileObjects(formValues);

          // Evaluate payload template
          const evaluatedPayload = evaluatePayloadTemplate(
            submission.payloadTemplate,
            formValues
          );

          // Construct request body based on whether files are present
          let requestBody: string | FormData;
          if (containsFiles) {
            // Use multipart/form-data for file uploads
            requestBody = constructFormData(formValues, evaluatedPayload);
          } else {
            // Use JSON for non-file submissions
            // If evaluated payload is an object, stringify it; otherwise use as-is
            requestBody = typeof evaluatedPayload === 'string'
              ? evaluatedPayload
              : JSON.stringify(evaluatedPayload);
          }

          // Construct request
          const requestInit = constructSubmissionRequest(
            submission,
            requestBody,
            containsFiles
          );

          // Make submission request
          const response = await fetch(submission.url, requestInit);

          // Handle response
          if (response.ok) {
            const result = await response.json();
            if (onSuccess) {
              onSuccess(result);
            }
          } else {
            // Handle error response
            let errorResponse: BackendErrorResponse;
            try {
              errorResponse = await response.json();
            } catch {
              // If response is not JSON, create a generic error
              errorResponse = {
                error: `Submission failed with status ${response.status}`,
              };
            }

            // Map backend errors to react-hook-form
            if (errorResponse.errors && Array.isArray(errorResponse.errors)) {
              const mappedErrors = mapBackendErrorsToForm(errorResponse.errors);
              for (const { field, error } of mappedErrors) {
                setError(field, {
                  type: error.type || 'server',
                  message: error.message || 'Validation error',
                });
              }
            }

            // Scroll to first error if there are field errors
            if (errorResponse.errors && errorResponse.errors.length > 0) {
              const errors = {} as FieldErrors<T>;
              for (const backendError of errorResponse.errors) {
                (errors as Record<string, { type: string; message: string }>)[backendError.field] = {
                  type: 'server',
                  message: backendError.message,
                };
              }
              scrollToFirstError(errors);
            }

            if (onError) {
              onError(errorResponse);
            }
          }
        } catch (error) {
          // Handle network or other errors
          const errorObj = error instanceof Error ? error : new Error(String(error));
          if (onError) {
            onError(errorObj);
          }
        }
      },
      // onInvalid - called when validation fails
      (errors: FieldErrors<T>) => {
        // Scroll to first error
        scrollToFirstError(errors);

        // Call error callback if provided
        if (onError) {
          onError(new Error('Form validation failed'));
        }
      }
    );
  };

  return {
    createSubmitHandler,
  };
}
