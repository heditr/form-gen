/**
 * Form Thunks - Redux Toolkit Async Thunks
 * 
 * This file shows how to create properly typed Redux thunks that work with connect().
 * The key is using createAsyncThunk from Redux Toolkit.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import type { GlobalFormDescriptor, RulesObject, CaseContext, FormData } from '@/types/form-descriptor';
import { getFormState, triggerRehydration, applyRulesUpdate, loadDataSource, type RootState } from './form-dux';
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
 * Note: This thunk handles debouncing internally and dispatches triggerRehydration
 * before making the API call.
 */
export const rehydrateRulesThunk = createAsyncThunk<
  RulesObject, // Return type
  CaseContext, // Argument type
  { rejectValue: string } // Reject value type
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
 */
export const fetchDataSourceThunk = createAsyncThunk<
  unknown, // Return type (the data items)
  { fieldPath: string; url: string; auth?: AuthConfig }, // Argument type
  { state: RootState; rejectValue: string } // Reject value type
>(
  'form/fetchDataSource',
  async ({ fieldPath, url, auth }, { getState, rejectWithValue }) => {
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
      // - Authentication
      // - API calls
      // - Response transformation using itemsTemplate
      // - Caching
      const items = await loadDataSourceUtil(fieldDescriptor.dataSource, formContext);
      
      // Dispatch action to store in cache (this will be handled by the reducer)
      // Note: The reducer will handle the loadDataSource action separately
      // We return the items here so they can be used if needed
      return items;
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

/**
 * IMPORTANT: Update the reducer in form-dux.ts to handle thunk actions
 * 
 * Example reducer updates:
 * 
 * ```typescript
 * import { fetchGlobalDescriptorThunk, rehydrateRulesThunk, fetchDataSourceThunk } from './form-thunks';
 * 
 * export const reducer = (state: FormState = initialState, action: ActionObject): FormState => {
 *   // ... existing cases ...
 *   
 *   // Handle thunk fulfilled actions
 *   if (fetchGlobalDescriptorThunk.fulfilled.match(action)) {
 *     return {
 *       ...state,
 *       globalDescriptor: action.payload,
 *       mergedDescriptor: action.payload,
 *     };
 *   }
 *   
 *   if (rehydrateRulesThunk.pending.match(action)) {
 *     return { ...state, isRehydrating: true };
 *   }
 *   
 *   if (rehydrateRulesThunk.fulfilled.match(action)) {
 *     const rulesObject = action.payload;
 *     if (rulesObject && state.globalDescriptor) {
 *       const updatedMergedDescriptor = mergeDescriptorWithRules(
 *         state.globalDescriptor,
 *         rulesObject
 *       );
 *       return {
 *         ...state,
 *         mergedDescriptor: updatedMergedDescriptor,
 *         isRehydrating: false,
 *       };
 *     }
 *     return { ...state, isRehydrating: false };
 *   }
 *   
 *   if (rehydrateRulesThunk.rejected.match(action)) {
 *     return { ...state, isRehydrating: false };
 *   }
 *   
 *   if (fetchDataSourceThunk.fulfilled.match(action)) {
 *     const { fieldPath } = action.meta.arg;
 *     return {
 *       ...state,
 *       dataSourceCache: {
 *         ...state.dataSourceCache,
 *         [fieldPath]: action.payload,
 *       },
 *     };
 *   }
 *   
 *   // ... other cases ...
 * };
 * ```
