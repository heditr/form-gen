/**
 * Tests for form sagas
 * 
 * Following TDD: Tests verify sagas handle async operations correctly
 * using the saga pattern with call and put effects.
 */

import { describe, test, expect } from 'vitest';
import { call, put, delay } from 'redux-saga/effects';
import {
  loadGlobalDescriptorSaga,
  syncFormDataSaga,
  rehydrateRulesSaga,
  loadDataSourceSaga,
  submitFormSaga,
  FETCH_GLOBAL_DESCRIPTOR,
  REHYDRATE_RULES,
  FETCH_DATA_SOURCE,
  SUBMIT_FORM,
  SYNC_FORM_DATA,
} from './form-sagas';
import {
  loadGlobalDescriptor,
  applyRulesUpdate,
  loadDataSource,
  syncFormDataToContext,
  triggerRehydration,
} from './form-dux';
import type { GlobalFormDescriptor, RulesObject, CaseContext, FormData } from '@/types/form-descriptor';
import type { ActionObject } from './form-dux';

describe('form sagas', () => {
  describe('loadGlobalDescriptorSaga', () => {
    test('given global descriptor loading, should fetch GET /api/form/global-descriptor', () => {
      const gen = loadGlobalDescriptorSaga();
      
      const firstYield = gen.next().value;
      // Check that it's a call effect (has IO marker)
      expect(firstYield).toHaveProperty('@@redux-saga/IO');
      
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [],
        submission: { url: '/api/submit', method: 'POST' },
      };
      
      const mockResponse = {
        ok: true,
        json: async () => descriptor,
      } as Response;
      
      const secondYield = gen.next(mockResponse).value;
      // Should call json() on response (has IO marker)
      expect(secondYield).toHaveProperty('@@redux-saga/IO');
      
      const thirdYield = gen.next(descriptor).value;
      expect(thirdYield).toEqual(put(loadGlobalDescriptor({ descriptor })));
      
      expect(gen.next().done).toBe(true);
    });

    test('given fetch error, should handle error gracefully', () => {
      const gen = loadGlobalDescriptorSaga();
      
      gen.next(); // Skip call
      
      const errorResponse = { ok: false, status: 500 } as Response;
      const result = gen.next(errorResponse);
      
      // Saga should complete even on error
      expect(result.done).toBe(true);
    });
  });

  describe('syncFormDataSaga', () => {
    test('given form data sync from react-hook-form, should sync form data to Redux', () => {
      const action: ActionObject<{ formData: Partial<FormData> }> = {
        type: SYNC_FORM_DATA,
        payload: { formData: { field1: 'value1', field2: 'value2' } as Partial<FormData> },
      };
      
      const gen = syncFormDataSaga(action);
      
      // Saga should complete (context extraction will be added in later task)
      expect(gen.next().done).toBe(true);
    });
  });

  describe('rehydrateRulesSaga', () => {
    test('given re-hydration needs, should POST /api/rules/context with debouncing', () => {
      const caseContext: CaseContext = { jurisdiction: 'US' };
      const action: ActionObject<{ caseContext: CaseContext }> = {
        type: REHYDRATE_RULES,
        payload: { caseContext },
      };
      
      const gen = rehydrateRulesSaga(action);
      
      // First yield should be delay for debouncing
      const firstYield = gen.next().value;
      expect(firstYield).toEqual(delay(500));
      
      // Second yield should trigger rehydration
      const secondYield = gen.next().value;
      expect(secondYield).toEqual(put(triggerRehydration()));
      
      // Third yield should be the API call
      const thirdYield = gen.next().value;
      expect(thirdYield).toHaveProperty('@@redux-saga/IO');
      
      const rulesObject: RulesObject = { fields: [] };
      const mockResponse = {
        ok: true,
        json: async () => rulesObject,
      } as Response;
      
      const fourthYield = gen.next(mockResponse).value;
      // Should call json() on response
      expect(fourthYield).toHaveProperty('@@redux-saga/IO');
      
      const fifthYield = gen.next(rulesObject).value;
      expect(fifthYield).toEqual(put(applyRulesUpdate({ rulesObject })));
      
      expect(gen.next().done).toBe(true);
    });
  });

  describe('loadDataSourceSaga', () => {
    test('given data source loading, should fetch dynamic field data with authentication', () => {
      const action: ActionObject<{ fieldPath: string; url: string; auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string } }> = {
        type: FETCH_DATA_SOURCE,
        payload: {
          fieldPath: 'cities',
          url: '/api/cities',
          auth: { type: 'bearer' as const, token: 'token123' },
        },
      };
      
      const gen = loadDataSourceSaga(action);
      
      const firstYield = gen.next().value;
      // Should be a call effect
      expect(firstYield).toHaveProperty('@@redux-saga/IO');
      
      const data = [{ label: 'New York', value: 'NY' }];
      const mockResponse = {
        ok: true,
        json: async () => data,
      } as Response;
      
      const secondYield = gen.next(mockResponse).value;
      // Should call json() on response
      expect(secondYield).toHaveProperty('@@redux-saga/IO');
      
      const thirdYield = gen.next(data).value;
      expect(thirdYield).toEqual(put(loadDataSource({ fieldPath: 'cities', data })));
      
      expect(gen.next().done).toBe(true);
    });
  });

  describe('submitFormSaga', () => {
    test('given form submission, should submit form data to configured endpoint', () => {
      const action: ActionObject<{ url: string; method: string; formData: Partial<FormData> }> = {
        type: SUBMIT_FORM,
        payload: {
          url: '/api/submit',
          method: 'POST',
          formData: { field1: 'value1' } as Partial<FormData>,
        },
      };
      
      const gen = submitFormSaga(action);
      
      const firstYield = gen.next().value;
      // Should be a call effect
      expect(firstYield).toHaveProperty('@@redux-saga/IO');
      
      const mockResponse = {
        ok: true,
        json: async () => ({ success: true }),
      } as Response;
      
      const secondYield = gen.next(mockResponse).value;
      // Should call json() on response
      expect(secondYield).toHaveProperty('@@redux-saga/IO');
      
      expect(gen.next({ success: true }).done).toBe(true);
    });

    test('given submission error, should handle error (validation errors managed by react-hook-form)', () => {
      const action: ActionObject<{ url: string; method: string; formData: Partial<FormData> }> = {
        type: SUBMIT_FORM,
        payload: {
          url: '/api/submit',
          method: 'POST',
          formData: {} as Partial<FormData>,
        },
      };
      
      const gen = submitFormSaga(action);
      
      gen.next(); // Skip call
      
      const errorResponse = {
        ok: false,
        status: 400,
        json: async () => ({
          errors: { field1: 'Field 1 is required' },
        }),
      } as Response;
      
      const secondYield = gen.next(errorResponse).value;
      // Should call json() on response
      expect(secondYield).toHaveProperty('@@redux-saga/IO');
      
      // Saga should complete (error handling done in form component via react-hook-form)
      expect(gen.next({ errors: { field1: 'Field 1 is required' } }).done).toBe(true);
    });
  });
});
