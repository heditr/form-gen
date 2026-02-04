/**
 * Form Thunks - Redux Toolkit Async Thunks
 * 
 * Replaces redux-saga with Redux Thunk for async operations that update Redux state.
 * Note: Some operations (like global descriptor fetching) may later be moved to TanStack Query
 * for better caching and deduplication, but thunks are created here for Redux state updates.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { GlobalFormDescriptor, RulesObject, CaseContext, CasePrefill, FormData } from '@/types/form-descriptor';
import {
  getFormState,
  triggerRehydration,
  applyRulesUpdate,
  loadDataSource,
  initializeCaseContextFromPrefill,
  type RootState,
} from './form-dux';
import { loadDataSource as loadDataSourceUtil } from '@/utils/data-source-loader';
import type { FormContext } from '@/utils/template-evaluator';

/**
 * Auth configuration type
 */
interface AuthConfig {
  type: 'bearer' | 'apikey';
  token?: string;
  headerName?: string;
}

/**
 * Helper function to make API calls
 */
async function apiCall(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response;
}

/**
 * Thunk to fetch global form descriptor
 * 
 * Returns: GlobalFormDescriptor
 * 
 * Note: This may later be moved to TanStack Query for caching benefits,
 * but is implemented as a thunk here for Redux state updates.
 */
export const fetchGlobalDescriptorThunk = createAsyncThunk<
  GlobalFormDescriptor, // Return type
  string, // Argument type (endpoint)
  { rejectValue: string } // Reject value type
>(
  'form/fetchGlobalDescriptor',
  async (endpoint: string = '/api/form/global-descriptor', { rejectWithValue }) => {
    try {
      const response = await apiCall(endpoint, { method: 'GET' });

      if (!response.ok) {
        return rejectWithValue(`Failed to fetch descriptor: ${response.status}`);
      }

      const descriptor: GlobalFormDescriptor = await response.json();
      return descriptor;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Thunk to rehydrate rules with debouncing
 * 
 * Returns: RulesObject
 * 
 * Implements 500ms debounce before making the API call.
 * Dispatches triggerRehydration before the API call and applyRulesUpdate on success/error.
 */
export const rehydrateRulesThunk = createAsyncThunk<
  RulesObject, // Return type
  CaseContext, // Argument type
  { dispatch: ThunkDispatch<RootState, unknown, UnknownAction>; rejectValue: string } // Reject value type
>(
  'form/rehydrateRules',
  async (caseContext: CaseContext, { dispatch, rejectWithValue }) => {
    try {
      // Debounce: wait 500ms before making the request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Dispatch trigger rehydration action
      dispatch(triggerRehydration());
      
      const response = await apiCall('/api/rules/context', {
        method: 'POST',
        body: JSON.stringify(caseContext),
      });

      if (!response.ok) {
        // Dispatch failure action
        dispatch(applyRulesUpdate({ rulesObject: null }));
        return rejectWithValue(`Failed to rehydrate rules: ${response.status}`);
      }

      const rulesObject: RulesObject = await response.json();
      
      // Dispatch success action to update Redux state
      dispatch(applyRulesUpdate({ rulesObject }));
      
      return rulesObject;
    } catch (error) {
      dispatch(applyRulesUpdate({ rulesObject: null }));
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Thunk to fetch dynamic field data
 * 
 * Returns: unknown (the data items)
 * 
 * Uses getState to access form state (mergedDescriptor, formData) for template evaluation.
 */
export const fetchDataSourceThunk = createAsyncThunk<
  unknown, // Return type (the data items)
  { fieldPath: string; url: string; auth?: AuthConfig }, // Argument type (url and auth kept for backward compatibility, but not used)
  { state: RootState; rejectValue: string } // Reject value type
>(
  'form/fetchDataSource',
  async ({ fieldPath }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState();
      const formState = getFormState(state);
      const { mergedDescriptor, formData } = formState;
      
      if (!mergedDescriptor) {
        return rejectWithValue('No merged descriptor available for data source loading');
      }
      
      // Find the field descriptor to get the full DataSourceConfig
      let fieldDescriptor = null;
      for (const block of mergedDescriptor.blocks || []) {
        fieldDescriptor = block.fields?.find((field) => field.id === fieldPath);
        if (fieldDescriptor) {
          break;
        }
      }
      
      if (!fieldDescriptor || !fieldDescriptor.dataSource) {
        return rejectWithValue(`Field ${fieldPath} not found or has no dataSource config`);
      }
      
      // Build form context for template evaluation
      const formContext: FormContext = {
        ...formData,
        formData, // Also include as nested property for template access
      };
      
      // Use the data-source-loader utility which handles:
      // - URL template evaluation
      // - Authentication (via proxy if dataSourceId is present, or direct if auth is provided)
      // - API calls
      // - Response transformation using itemsTemplate
      // - Caching
      const items = await loadDataSourceUtil(fieldDescriptor.dataSource, formContext, fieldPath);
      
      // Dispatch action to store in Redux cache
      dispatch(loadDataSource({ fieldPath, data: items }));
      
      return items;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Thunk to fetch case data and initialize case context
 * 
 * Returns: CasePrefill (the case data)
 * 
 * This thunk fetches case data from the server and automatically initializes
 * the case context from the CasePrefill data. Use this when:
 * - Loading an existing case
 * - Refreshing case data
 * - Navigating to a case detail page
 * 
 * The case context will be updated in Redux, and if the context changes,
 * you may want to trigger a rehydration to get updated rules.
 * 
 * Example usage:
 * ```typescript
 * const dispatch = useDispatch<AppDispatch>();
 * 
 * // Fetch case data
 * const result = await dispatch(fetchCaseDataThunk('/api/cases/123'));
 * if (fetchCaseDataThunk.fulfilled.match(result)) {
 *   const casePrefill = result.payload;
 *   // Case context is now initialized in Redux
 *   // Optionally trigger rehydration if needed:
 *   const caseContext = initializeCaseContext(casePrefill);
 *   dispatch(rehydrateRulesThunk(caseContext));
 * }
 * ```
 */
export const fetchCaseDataThunk = createAsyncThunk<
  CasePrefill, // Return type
  string, // Argument type (endpoint or case ID)
  { dispatch: ThunkDispatch<RootState, unknown, UnknownAction>; rejectValue: string } // Reject value type
>(
  'form/fetchCaseData',
  async (endpointOrCaseId: string, { dispatch, rejectWithValue }) => {
    try {
      // If it's just an ID, construct the endpoint
      const endpoint = endpointOrCaseId.startsWith('/') 
        ? endpointOrCaseId 
        : `/api/cases/${endpointOrCaseId}`;
      
      const response = await apiCall(endpoint, { method: 'GET' });

      if (!response.ok) {
        return rejectWithValue(`Failed to fetch case data: ${response.status}`);
      }

      const caseData: CasePrefill = await response.json();
      
      // Initialize case context from the fetched prefill data
      // This will merge with any existing context values
      dispatch(initializeCaseContextFromPrefill({ casePrefill: caseData }));
      
      return caseData;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Thunk to submit form data
 * 
 * Returns: unknown (the response data)
 */
interface SubmitFormParams {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  formData: Partial<FormData>;
  headers?: Record<string, string>;
  auth?: AuthConfig;
}

export const submitFormThunk = createAsyncThunk<
  unknown, // Return type (response data)
  SubmitFormParams, // Argument type
  { rejectValue: string } // Reject value type
>(
  'form/submitForm',
  async ({ url, method, formData, headers, auth }, { rejectWithValue }) => {
    try {
      // Build headers with auth
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };
      
      if (auth) {
        if (auth.type === 'bearer' && auth.token) {
          requestHeaders['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'apikey' && auth.token && auth.headerName) {
          requestHeaders[auth.headerName] = auth.token;
        }
      }
      
      const response = await apiCall(url, {
        method,
        headers: requestHeaders,
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return rejectWithValue(errorData.message || `Form submission failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);
