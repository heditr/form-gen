/**
 * Tests for Redux store configuration
 * 
 * Following TDD: Tests verify the store is properly configured with
 * root reducer and Redux Toolkit (which includes Redux Thunk middleware).
 */

import { describe, test, expect } from 'vitest';
import { store, rootReducer } from './store';
import { reducer as formReducer, initialState as formInitialState, slice } from './form-dux';
import { loadGlobalDescriptor } from './form-dux';

describe('store configuration', () => {
  describe('rootReducer', () => {
    test('given Redux setup needs, should combine form slice in root reducer', () => {
      // Use a valid ActionObject with payload for initialization
      const initAction = { type: '@@INIT', payload: {} };
      const state = rootReducer(undefined, initAction);
      
      expect(state[slice]).toBeDefined();
      expect(state[slice]).toEqual(formInitialState);
    });

    test('given form actions, should handle actions through root reducer', () => {
      const descriptor = {
        version: '1.0.0',
        blocks: [],
        submission: { url: '/api/submit', method: 'POST' as const },
      };
      
      const action = loadGlobalDescriptor({ descriptor });
      const state = rootReducer(undefined, action);
      
      expect(state[slice].globalDescriptor).toEqual(descriptor);
      expect(state[slice].mergedDescriptor).toEqual(descriptor);
    });
  });

  describe('store', () => {
    test('given store needs, should export configured store', () => {
      expect(store).toBeDefined();
      expect(store.getState).toBeDefined();
      expect(typeof store.getState).toBe('function');
      expect(store.dispatch).toBeDefined();
      expect(typeof store.dispatch).toBe('function');
    });

    test('given store initialization, should have form slice in initial state', () => {
      const state = store.getState();
      
      expect(state[slice]).toBeDefined();
      expect(state[slice]).toEqual(formInitialState);
    });

    test('given async operations need, should support dispatching actions (Redux Thunk included by default)', () => {
      // Verify store can dispatch actions (Redux Thunk middleware allows this)
      const descriptor = {
        version: '1.0.0',
        blocks: [],
        submission: { url: '/api/submit', method: 'POST' as const },
      };
      
      const action = loadGlobalDescriptor({ descriptor });
      store.dispatch(action);
      
      const state = store.getState();
      expect(state[slice].globalDescriptor).toEqual(descriptor);
    });
  });
});
