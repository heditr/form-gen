/**
 * Tests for Form Thunks
 * 
 * Following TDD: Tests verify Redux Toolkit thunks handle async operations correctly.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import type { GlobalFormDescriptor, RulesObject, CaseContext } from '@/types/form-descriptor';
import {
  fetchGlobalDescriptorThunk,
  rehydrateRulesThunk,
  fetchDataSourceThunk,
} from './form-thunks';
import { reducer } from './form-dux';

// Mock fetch
global.fetch = vi.fn();

// Mock data-source-loader
vi.mock('@/utils/data-source-loader', () => ({
  loadDataSource: vi.fn(() => Promise.resolve([{ label: 'Item 1', value: '1' }])),
}));

describe('form-thunks', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        form: reducer,
      },
    });
    vi.clearAllMocks();
  });

  describe('fetchGlobalDescriptorThunk', () => {
    test('given successful API response, should return descriptor', async () => {
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [],
        submission: { url: '/api/submit', method: 'POST' },
      };

      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => descriptor,
      });

      const result = await store.dispatch(fetchGlobalDescriptorThunk('/api/form/global-descriptor'));

      expect(fetch).toHaveBeenCalledWith('/api/form/global-descriptor', expect.objectContaining({
        method: 'GET',
      }));
      expect(result.type).toBe('form/fetchGlobalDescriptor/fulfilled');
      if (fetchGlobalDescriptorThunk.fulfilled.match(result)) {
        expect(result.payload).toEqual(descriptor);
      }
    });

    test('given failed API response, should reject with error', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await store.dispatch(fetchGlobalDescriptorThunk('/api/form/global-descriptor'));

      expect(result.type).toBe('form/fetchGlobalDescriptor/rejected');
      if (fetchGlobalDescriptorThunk.rejected.match(result)) {
        expect(result.payload).toContain('Failed to fetch descriptor: 404');
      }
    });
  });

  describe('rehydrateRulesThunk', () => {
    test('given successful API response, should return rules object', async () => {
      const caseContext: CaseContext = { country: 'US' };
      const rulesObject: RulesObject = {
        blocks: [{ id: 'block1', status: { hidden: 'false' } }],
      };

      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => rulesObject,
      });

      // Mock setTimeout to avoid waiting 500ms
      vi.useFakeTimers();
      const dispatchPromise = store.dispatch(rehydrateRulesThunk(caseContext));
      
      // Fast-forward 500ms
      vi.advanceTimersByTime(500);
      
      const result = await dispatchPromise;
      vi.useRealTimers();

      expect(fetch).toHaveBeenCalledWith('/api/rules/context', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(caseContext),
      }));
      expect(result.type).toBe('form/rehydrateRules/fulfilled');
      if (rehydrateRulesThunk.fulfilled.match(result)) {
        expect(result.payload).toEqual(rulesObject);
      }
    });

    test('given failed API response, should reject with error', async () => {
      const caseContext: CaseContext = { country: 'US' };

      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      vi.useFakeTimers();
      const dispatchPromise = store.dispatch(rehydrateRulesThunk(caseContext));
      vi.advanceTimersByTime(500);
      const result = await dispatchPromise;
      vi.useRealTimers();

      expect(result.type).toBe('form/rehydrateRules/rejected');
    });
  });

  describe('fetchDataSourceThunk', () => {
    test('given successful data source load, should return data items', async () => {
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [{
          id: 'block1',
          title: 'Block 1',
          fields: [{
            id: 'cities',
            type: 'dropdown',
            label: 'Cities',
            validation: [],
            dataSource: {
              url: '/api/cities',
              itemsTemplate: '{{#each items}}{{label}}:{{value}}{{/each}}',
            },
          }],
        }],
        submission: { url: '/api/submit', method: 'POST' },
      };

      // Set up state with descriptor
      store.dispatch({
        type: 'form/loadGlobalDescriptor',
        payload: { descriptor },
      });

      const result = await store.dispatch(fetchDataSourceThunk({
        fieldPath: 'cities',
        url: '/api/cities',
      }));

      expect(result.type).toBe('form/fetchDataSource/fulfilled');
    });

    test('given missing descriptor, should reject with error', async () => {
      const result = await store.dispatch(fetchDataSourceThunk({
        fieldPath: 'cities',
        url: '/api/cities',
      }));

      expect(result.type).toBe('form/fetchDataSource/rejected');
      if (fetchDataSourceThunk.rejected.match(result)) {
        expect(result.payload).toContain('No merged descriptor available');
      }
    });
  });
});
