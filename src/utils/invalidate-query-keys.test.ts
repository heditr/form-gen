/**
 * Tests for descriptor-configured query key invalidation
 */

import { describe, test, expect, vi, beforeAll } from 'vitest';
import { getQueryInvalidationKeys, invalidateConfiguredQueryKeys } from './invalidate-query-keys';
import { registerHandlebarsHelpers } from './handlebars-helpers';
import type { FormContext } from './template-evaluator';

describe('query invalidation helpers', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const createContext = (overrides: Record<string, unknown> = {}): FormContext => ({
    ...overrides,
  } as FormContext);

  describe('getQueryInvalidationKeys', () => {
    test('given descriptor with queryInvalidation map, should return keys for block id', () => {
      const descriptor = {
        blocks: [],
        submission: { url: '/api/submit', method: 'POST' as const },
        queryInvalidation: {
          'contact-info': [['case', '{{caseContext.caseId}}']],
        },
      };

      expect(getQueryInvalidationKeys(descriptor, 'contact-info')).toEqual([
        ['case', '{{caseContext.caseId}}'],
      ]);
    });

    test('given missing block id or map, should return undefined', () => {
      const descriptor = {
        blocks: [],
        submission: { url: '/api/submit', method: 'POST' as const },
        queryInvalidation: {
          'contact-info': [['case']],
        },
      };

      expect(getQueryInvalidationKeys(descriptor, 'unknown-block')).toBeUndefined();
      expect(getQueryInvalidationKeys(null, 'contact-info')).toBeUndefined();
      expect(getQueryInvalidationKeys({ blocks: [], submission: { url: '/api/submit', method: 'POST' } }, 'contact-info')).toBeUndefined();
    });
  });

  describe('invalidateConfiguredQueryKeys', () => {
    test('given missing query keys, should skip invalidation', async () => {
      const invalidateQueries = vi.fn().mockResolvedValue(undefined);

      await invalidateConfiguredQueryKeys({
        queryClient: { invalidateQueries },
        formContext: createContext(),
      });

      expect(invalidateQueries).not.toHaveBeenCalled();
    });

    test('given empty query keys, should skip invalidation', async () => {
      const invalidateQueries = vi.fn().mockResolvedValue(undefined);

      await invalidateConfiguredQueryKeys({
        queryClient: { invalidateQueries },
        queryKeys: [],
        formContext: createContext(),
      });

      expect(invalidateQueries).not.toHaveBeenCalled();
    });

    test('given static and templated keys, should evaluate segments and invalidate each key', async () => {
      const invalidateQueries = vi.fn().mockResolvedValue(undefined);
      const formContext = createContext({
        caseContext: { caseId: 'case-42' },
      });

      await invalidateConfiguredQueryKeys({
        queryClient: { invalidateQueries },
        queryKeys: [
          ['case', '{{caseContext.caseId}}'],
          ['form', 'data-source'],
        ],
        formContext,
      });

      expect(invalidateQueries).toHaveBeenCalledTimes(2);
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['case', 'case-42'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['form', 'data-source'] });
    });

    test('given a prefix key, should pass it through without exact match', async () => {
      const invalidateQueries = vi.fn().mockResolvedValue(undefined);

      await invalidateConfiguredQueryKeys({
        queryClient: { invalidateQueries },
        queryKeys: [['case']],
        formContext: createContext(),
      });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['case'] });
      expect(invalidateQueries.mock.calls[0][0].exact).toBeUndefined();
    });

    test('given numeric key segments, should pass numbers through without template evaluation', async () => {
      const invalidateQueries = vi.fn().mockResolvedValue(undefined);

      await invalidateConfiguredQueryKeys({
        queryClient: { invalidateQueries },
        queryKeys: [['case', 123]],
        formContext: createContext(),
      });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['case', 123] });
    });
  });
});
