/**
 * Tests for descriptor-configured query key invalidation
 */

import { describe, test, expect, vi, beforeAll } from 'vitest';
import { invalidateConfiguredQueryKeys } from './invalidate-query-keys';
import { registerHandlebarsHelpers } from './handlebars-helpers';
import type { FormContext } from './template-evaluator';

describe('invalidateConfiguredQueryKeys', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const createContext = (overrides: Record<string, unknown> = {}): FormContext => ({
    ...overrides,
  } as FormContext);

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
