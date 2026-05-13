/**
 * Tests for useDebouncedDocumentsRehydration — debounce + POST + applyDocumentsUpdate.
 */

import { describe, test, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { reducer, initialState, loadGlobalDescriptor } from '@/store/form-dux';
import type { RootState } from '@/store/form-dux';
import { useDebouncedDocumentsRehydration, readCaseIdFromCaseContext } from './use-debounced-documents-rehydration';

describe('readCaseIdFromCaseContext', () => {
  test('given string caseId, should return trimmed id', () => {
    expect(readCaseIdFromCaseContext({ caseId: '  abc  ' })).toBe('abc');
  });

  test('given missing caseId, should return undefined', () => {
    expect(readCaseIdFromCaseContext({ country: 'FR' })).toBeUndefined();
  });
});

describe('useDebouncedDocumentsRehydration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test(
    'given caseId and successful POST, should dispatch documents merge after debounce',
    async () => {
      const descriptor: GlobalFormDescriptor = {
        version: '1.0.0',
        blocks: [{ id: 'documents', title: 'Documents', fields: [] }],
        submission: { url: '/api/submit', method: 'POST' },
      };

      const loaded = reducer(initialState, loadGlobalDescriptor({ descriptor }));

      const store = configureStore({
        reducer: { form: reducer },
        preloadedState: { form: loaded },
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          documents: [
            {
              documentType: 'passport',
              category: 'agnostic',
              slots: { main: {} },
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </Provider>
      );

      const { result } = renderHook(() => useDebouncedDocumentsRehydration(), { wrapper });

      await act(async () => {
        result.current.mutate({ caseId: 'case-1', country: 'FR' });
      });

      await waitFor(
        () => {
          expect(fetchMock).toHaveBeenCalledWith(
            '/api/cases/case-1/documents',
            expect.objectContaining({ method: 'POST' })
          );
        },
        { timeout: 3000 }
      );

      await waitFor(() => {
        const ids = (store.getState() as RootState).form.globalDescriptor?.blocks
          .flatMap((b) => b.fields ?? [])
          .filter((f) => f.type === 'document')
          .map((f) => f.id);
        expect(ids).toEqual(['passport']);
      });
    },
    10000
  );

  test('given no caseId, should not schedule fetch', async () => {
    const store = configureStore({ reducer: { form: reducer } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    );

    const { result } = renderHook(() => useDebouncedDocumentsRehydration(), { wrapper });

    await act(async () => {
      result.current.mutate({ country: 'FR' });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
