/**
 * Form Sagas - Redux sagas for async form operations
 * 
 * Handles network requests and side effects for form operations.
 * Note: formData and validationErrors are managed by react-hook-form.
 * These sagas sync form data to Redux for context extraction and re-hydration.
 */

import { call, put, delay, takeEvery, takeLatest } from 'redux-saga/effects';
import type { CallEffect, PutEffect } from 'redux-saga/effects';
import type { GlobalFormDescriptor, RulesObject, CaseContext, FormData } from '@/types/form-descriptor';
import {
  loadGlobalDescriptor,
  applyRulesUpdate,
  loadDataSource,
  syncFormDataToContext,
  triggerRehydration,
  type ActionObject,
} from './form-dux';

const slice = 'form';

// Action types for triggering sagas
export const FETCH_GLOBAL_DESCRIPTOR = `${slice}/fetchGlobalDescriptor`;
export const REHYDRATE_RULES = `${slice}/rehydrateRules`;
export const FETCH_DATA_SOURCE = `${slice}/fetchDataSource`;
export const SUBMIT_FORM = `${slice}/submitForm`;
export const SYNC_FORM_DATA = `${slice}/syncFormDataToContext`;

// Action creators for triggering sagas
export const fetchGlobalDescriptor = (): ActionObject => ({
  type: FETCH_GLOBAL_DESCRIPTOR,
  payload: {},
});

export const rehydrateRules = (caseContext: CaseContext): ActionObject<{ caseContext: CaseContext }> => ({
  type: REHYDRATE_RULES,
  payload: { caseContext },
});

export const fetchDataSource = (
  fieldPath: string,
  url: string,
  auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }
): ActionObject<{ fieldPath: string; url: string; auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string } }> => ({
  type: FETCH_DATA_SOURCE,
  payload: { fieldPath, url, auth },
});

export const submitForm = (
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  formData: Partial<FormData>,
  headers?: Record<string, string>,
  auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }
): ActionObject<{ url: string; method: string; formData: Partial<FormData>; headers?: Record<string, string>; auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string } }> => ({
  type: SUBMIT_FORM,
  payload: { url, method, formData, headers, auth },
});

// Helper function to make API calls
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

// Saga to fetch global form descriptor
export function* loadGlobalDescriptorSaga(): Generator<CallEffect | PutEffect, void, any> {
  try {
    const response: Response = yield call(apiCall, '/api/form/global-descriptor', {
      method: 'GET',
    });

    if (response.ok) {
      const descriptor: GlobalFormDescriptor = yield call([response, 'json']);
      yield put(loadGlobalDescriptor({ descriptor }));
    } else {
      // Handle error - could dispatch error action
      console.error('Failed to load global descriptor:', response.status);
    }
  } catch (error) {
    // Handle error - could dispatch error action
    console.error('Error loading global descriptor:', error);
  }
}

// Saga to sync react-hook-form state to Redux for context extraction
// This saga watches for form data syncs from react-hook-form
// When discriminant fields change, context extraction will trigger re-hydration
export function* syncFormDataSaga(action: ActionObject<{ formData: Partial<FormData> }>): Generator<PutEffect, void, any> {
  try {
    // Form data is already synced to Redux by the reducer
    // Context extraction and re-hydration triggering will be implemented
    // in the Context Extractor task
    // This saga provides a hook point for future context extraction logic
  } catch (error) {
    console.error('Error syncing form data:', error);
  }
}

// Saga to rehydrate rules with debouncing
// Triggered by discriminant field changes from react-hook-form (via context extraction)
export function* rehydrateRulesSaga(action: ActionObject<{ caseContext: CaseContext }>): Generator<CallEffect | PutEffect, void, any> {
  try {
    // Debounce: wait 500ms before making the request
    yield delay(500);
    
    const { caseContext } = action.payload;
    
    yield put(triggerRehydration());
    
    const response: Response = yield call(apiCall, '/api/rules/context', {
      method: 'POST',
      body: JSON.stringify(caseContext),
    });

    if (response.ok) {
      const rulesObject: RulesObject = yield call([response, 'json']);
      yield put(applyRulesUpdate({ rulesObject }));
    } else {
      // Handle error
      console.error('Failed to rehydrate rules:', response.status);
      yield put(applyRulesUpdate({ rulesObject: null }));
    }
  } catch (error) {
    // Handle error
    console.error('Error rehydrating rules:', error);
    yield put(applyRulesUpdate({ rulesObject: null }));
  }
}

// Saga to fetch dynamic field data
export function* loadDataSourceSaga(action: ActionObject<{ fieldPath: string; url: string; auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string } }>): Generator<CallEffect | PutEffect, void, any> {
  try {
    const { fieldPath, url, auth } = action.payload;
    
    const headers: Record<string, string> = {};
    
    if (auth) {
      if (auth.type === 'bearer' && auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'apikey' && auth.token && auth.headerName) {
        headers[auth.headerName] = auth.token;
      }
    }
    
    const response: Response = yield call(apiCall, url, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const data = yield call([response, 'json']);
      yield put(loadDataSource({ fieldPath, data }));
    } else {
      // Handle error
      console.error('Failed to load data source:', response.status);
    }
  } catch (error) {
    // Handle error
    console.error('Error loading data source:', error);
  }
}

// Saga to submit form data
export function* submitFormSaga(action: ActionObject<{ url: string; method: string; formData: Partial<FormData>; headers?: Record<string, string>; auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string } }>): Generator<CallEffect | PutEffect, void, any> {
  try {
    const { url, method, formData, headers: customHeaders, auth } = action.payload;
    
    const headers: Record<string, string> = {
      ...customHeaders,
    };
    
    if (auth) {
      if (auth.type === 'bearer' && auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'apikey' && auth.token && auth.headerName) {
        headers[auth.headerName] = auth.token;
      }
    }
    
    const response: Response = yield call(apiCall, url, {
      method: method as string,
      body: JSON.stringify(formData),
      headers,
    });

    if (response.ok) {
      const result = yield call([response, 'json']);
      // Success - could dispatch success action
      console.log('Form submitted successfully:', result);
    } else {
      // Handle validation errors
      // Note: Validation errors are managed by react-hook-form
      // Backend errors should be mapped to react-hook-form via setError() in the form component
      const errorData = yield call([response, 'json']);
      console.error('Form submission failed:', errorData);
      // Error handling will be done in the form component using react-hook-form's setError
    }
  } catch (error) {
    // Handle error
    console.error('Error submitting form:', error);
    // Error handling will be done in the form component using react-hook-form's setError
  }
}

// Root saga - watches for actions and runs appropriate sagas
export function* formSagas(): Generator {
  yield takeEvery(FETCH_GLOBAL_DESCRIPTOR, loadGlobalDescriptorSaga);
  yield takeEvery(SYNC_FORM_DATA, syncFormDataSaga);
  yield takeLatest(REHYDRATE_RULES, rehydrateRulesSaga);
  yield takeEvery(FETCH_DATA_SOURCE, loadDataSourceSaga);
  yield takeEvery(SUBMIT_FORM, submitFormSaga);
}
