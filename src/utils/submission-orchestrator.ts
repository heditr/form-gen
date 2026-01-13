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
 * Evaluate payload template with form values
 * 
 * @param template - Optional Handlebars template for payload transformation
 * @param formValues - Form values from react-hook-form
 * @returns Evaluated payload as JSON string
 */
export function evaluatePayloadTemplate(
  template: string | undefined,
  formValues: Partial<FormData>
): string {
  // If no template provided, return JSON stringified form values
  if (!template || template.trim() === '') {
    return JSON.stringify(formValues);
  }

  // Evaluate template with form values as context
  const context: FormContext = {
    formData: formValues,
    ...formValues, // Also allow direct access to form values
  };

  const evaluated = evaluateTemplate(template, context);
  
  // If template evaluation returns empty, fall back to JSON stringified values
  if (!evaluated || evaluated.trim() === '') {
    return JSON.stringify(formValues);
  }

  return evaluated;
}

/**
 * Construct submission request from config and payload
 * 
 * @param config - Submission configuration from descriptor
 * @param payload - Request body payload (JSON string)
 * @returns Request configuration for fetch
 */
export function constructSubmissionRequest(
  config: SubmissionConfig,
  payload: string
): RequestInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  // Add authentication headers
  if (config.auth) {
    if (config.auth.type === 'bearer' && config.auth.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    } else if (config.auth.type === 'apikey' && config.auth.token && config.auth.headerName) {
      headers[config.auth.headerName] = config.auth.token;
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
          // Evaluate payload template
          const payload = evaluatePayloadTemplate(
            submission.payloadTemplate,
            validData as Partial<FormData>
          );

          // Construct request
          const requestInit = constructSubmissionRequest(submission, payload);

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
