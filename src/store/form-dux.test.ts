/**
 * Tests for form-dux reducer, actions, and selectors
 * 
 * Following TDD: Tests verify the reducer handles actions correctly
 * and selectors extract the correct state.
 */

import { describe, test, expect } from 'vitest';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import {
  reducer,
  initialState,
  slice,
  loadGlobalDescriptor,
  syncFormDataToContext,
  triggerRehydration,
  applyRulesUpdate,
  loadDataSource,
  getFormState,
  getVisibleBlocks,
  getVisibleFields,
  type FormState,
  type RootState,
} from './form-dux';

// Helper to create state with slice
const createState = (formState: FormState): RootState => ({
  [slice]: formState,
});

describe('form-dux', () => {
  describe('initialState', () => {
    test('given form state needs, should define initialState with all required properties', () => {
      expect(initialState).toEqual({
        globalDescriptor: null,
        mergedDescriptor: null,
        formData: {},
        caseContext: {},
        isRehydrating: false,
        dataSourceCache: {},
      });
    });
  });

  describe('loadGlobalDescriptor action', () => {
    test('given a global descriptor, should set globalDescriptor and mergedDescriptor in state', () => {
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [],
        submission: { url: '/api/submit', method: 'POST' },
      };
      
      const action = loadGlobalDescriptor({ descriptor });
      const newState = reducer(initialState, action);
      
      expect(newState.globalDescriptor).toEqual(descriptor);
      expect(newState.mergedDescriptor).toEqual(descriptor);
    });
  });

  describe('syncFormDataToContext action', () => {
    test('given form data from react-hook-form, should sync formData to Redux state', () => {
      const formData = {
        'personalInfo.email': 'test@example.com',
        'personalInfo.name': 'John Doe',
      };
      
      const action = syncFormDataToContext({ formData });
      const newState = reducer(initialState, action);
      
      expect(newState.formData).toEqual(formData);
    });

    test('given form data sync, should replace entire formData with new data from react-hook-form', () => {
      const state1 = reducer(initialState, syncFormDataToContext({ formData: { field1: 'value1' } }));
      const state2 = reducer(state1, syncFormDataToContext({ formData: { field1: 'updated', field2: 'value2' } }));
      
      // Should replace entire formData, not merge
      expect(state2.formData.field1).toBe('updated');
      expect(state2.formData.field2).toBe('value2');
    });

    test('given empty form data, should clear formData', () => {
      const state1 = reducer(initialState, syncFormDataToContext({ formData: { field1: 'value1' } }));
      const state2 = reducer(state1, syncFormDataToContext({ formData: {} }));
      
      expect(state2.formData).toEqual({});
    });
  });

  describe('triggerRehydration action', () => {
    test('given rehydration trigger, should set isRehydrating to true', () => {
      const action = triggerRehydration();
      const newState = reducer(initialState, action);
      
      expect(newState.isRehydrating).toBe(true);
    });
  });

  describe('applyRulesUpdate action', () => {
    test('given a rules object, should update mergedDescriptor', () => {
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [{ id: 'block1', title: 'Block 1', fields: [] }],
        submission: { url: '/api/submit', method: 'POST' },
      };
      
      const stateWithDescriptor = reducer(initialState, loadGlobalDescriptor({ descriptor }));
      const stateRehydrating = reducer(stateWithDescriptor, triggerRehydration());
      
      const rulesObject = {
        fields: [{ id: 'field1', validation: [{ type: 'required' as const, message: 'Required' }] }],
      };
      
      const action = applyRulesUpdate({ rulesObject });
      const newState = reducer(stateRehydrating, action);
      
      expect(newState.mergedDescriptor).toBeDefined();
      expect(newState.isRehydrating).toBe(false);
    });

    test('given rules update, should set isRehydrating to false', () => {
      const stateRehydrating = reducer(initialState, triggerRehydration());
      expect(stateRehydrating.isRehydrating).toBe(true);
      
      const action = applyRulesUpdate({ rulesObject: {} });
      const newState = reducer(stateRehydrating, action);
      
      expect(newState.isRehydrating).toBe(false);
    });
  });


  describe('loadDataSource action', () => {
    test('given data source data, should cache it in dataSourceCache', () => {
      const fieldPath = 'cities';
      const data = [{ label: 'New York', value: 'NY' }];
      
      const action = loadDataSource({ fieldPath, data });
      const newState = reducer(initialState, action);
      
      expect(newState.dataSourceCache[fieldPath]).toEqual(data);
    });

    test('given multiple data sources, should preserve other cached data', () => {
      const state1 = reducer(initialState, loadDataSource({ fieldPath: 'cities', data: ['NY'] }));
      const state2 = reducer(state1, loadDataSource({ fieldPath: 'countries', data: ['US'] }));
      
      expect(state2.dataSourceCache.cities).toEqual(['NY']);
      expect(state2.dataSourceCache.countries).toEqual(['US']);
    });
  });

  describe('getFormState selector', () => {
    test('given form state, should return the entire form slice', () => {
      const state = createState(initialState);
      const result = getFormState(state);
      
      expect(result).toEqual(initialState);
    });
  });

  describe('getVisibleBlocks selector', () => {
    test('given merged descriptor with blocks, should return all blocks', () => {
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [
          { id: 'block1', title: 'Block 1', fields: [] },
          { id: 'block2', title: 'Block 2', fields: [] },
        ],
        submission: { url: '/api/submit', method: 'POST' },
      };
      
      const state = createState({
        ...initialState,
        mergedDescriptor: descriptor,
      });
      
      const blocks = getVisibleBlocks(state);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0].id).toBe('block1');
      expect(blocks[1].id).toBe('block2');
    });

    test('given no merged descriptor, should return empty array', () => {
      const state = createState(initialState);
      const blocks = getVisibleBlocks(state);
      
      expect(blocks).toEqual([]);
    });
  });

  describe('getVisibleFields selector', () => {
    test('given visible blocks, should return all fields from blocks', () => {
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [
          {
            id: 'block1',
            title: 'Block 1',
            fields: [
              { id: 'field1', type: 'text', label: 'Field 1', validation: [] },
              { id: 'field2', type: 'text', label: 'Field 2', validation: [] },
            ],
          },
        ],
        submission: { url: '/api/submit', method: 'POST' },
      };
      
      const state = createState({
        ...initialState,
        mergedDescriptor: descriptor,
      });
      
      const fields = getVisibleFields(state);
      
      expect(fields).toHaveLength(2);
      expect(fields[0].id).toBe('field1');
      expect(fields[1].id).toBe('field2');
    });
  });

});
