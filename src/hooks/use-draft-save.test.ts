/**
 * Tests for useDraftSave hook
 *
 * Verifies debounced, validity-gated draft autosave behavior:
 * - Only submits when form data is valid
 * - Debounces rapid changes into a single request
 * - Deduplicates identical payloads
 * - Cleans up on unmount
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { DraftConfig, FormData } from '@/types/form-descriptor';

vi.mock('../utils/submission-orchestrator', () => ({
  submitDraft: vi.fn().mockResolvedValue(undefined),
}));

import { submitDraft } from '../utils/submission-orchestrator';
import { useDraftSave, flattenDirtyFields } from './use-draft-save';

const createMockForm = ({
  triggerResult = true,
  values = { email: 'a@b.com' } as Record<string, unknown>,
  isDirty = true,
  dirtyFields = { email: true } as Record<string, unknown>,
}: {
  triggerResult?: boolean;
  values?: Record<string, unknown>;
  isDirty?: boolean;
  dirtyFields?: Record<string, unknown>;
} = {}) =>
  ({
    trigger: vi.fn().mockResolvedValue(triggerResult),
    getValues: vi.fn(() => values),
    formState: { isDirty, dirtyFields },
  }) as unknown as UseFormReturn<FieldValues>;

describe('useDraftSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('given valid form data and draft config, should call submitDraft after debounce', async () => {
    const form = createMockForm();
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST' };

    const { result } = renderHook(() => useDraftSave({ form, draftConfig }));

    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });

    // Not called yet (debounce pending)
    expect(submitDraft).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(form.trigger).toHaveBeenCalledWith(['email']);
    expect(submitDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftConfig,
        formValues: { email: 'a@b.com' },
      })
    );
  });

  test('given invalid form data, should not call submitDraft', async () => {
    const form = createMockForm({ triggerResult: false });
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST' };

    const { result } = renderHook(() => useDraftSave({ form, draftConfig }));

    await act(async () => {
      result.current.saveDraft({ email: '' } as Partial<FormData>);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(form.trigger).toHaveBeenCalledWith(['email']);
    expect(submitDraft).not.toHaveBeenCalled();
  });

  test('given rapid changes, should debounce into single request', async () => {
    const form = createMockForm({ values: { email: 'c@d.com' } });
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST' };

    const { result } = renderHook(() => useDraftSave({ form, draftConfig }));

    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      result.current.saveDraft({ email: 'b@c.com' } as Partial<FormData>);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      result.current.saveDraft({ email: 'c@d.com' } as Partial<FormData>);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(submitDraft).toHaveBeenCalledTimes(1);
    expect(submitDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        formValues: { email: 'c@d.com' },
      })
    );
  });

  test('given identical payload after successful save, should not send duplicate request', async () => {
    const form = createMockForm();
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST' };

    const { result } = renderHook(() => useDraftSave({ form, draftConfig }));

    // First save
    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(submitDraft).toHaveBeenCalledTimes(1);

    // Same payload again
    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(submitDraft).toHaveBeenCalledTimes(1);
  });

  test('given custom debounceMs in config, should use that delay', async () => {
    const form = createMockForm();
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST', debounceMs: 2000 };

    const { result } = renderHook(() => useDraftSave({ form, draftConfig }));

    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(submitDraft).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(submitDraft).toHaveBeenCalledTimes(1);
  });

  test('given no draftConfig (undefined), should be a no-op', async () => {
    const form = createMockForm();

    const { result } = renderHook(() => useDraftSave({ form, draftConfig: undefined }));

    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(submitDraft).not.toHaveBeenCalled();
  });

  test('given form is not dirty, should skip trigger and submitDraft', async () => {
    const form = createMockForm({ isDirty: false, dirtyFields: {} });
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST' };

    const { result } = renderHook(() => useDraftSave({ form, draftConfig }));

    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(form.trigger).not.toHaveBeenCalled();
    expect(submitDraft).not.toHaveBeenCalled();
  });

  test('given pending debounce when hook unmounts, should flush submitDraft', async () => {
    const form = createMockForm();
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST' };

    const { result, unmount } = renderHook(() => useDraftSave({ form, draftConfig }));

    await act(async () => {
      result.current.saveDraft({ email: 'a@b.com' } as Partial<FormData>);
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(submitDraft).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    // Flush microtasks from attemptDraftSave (await trigger → submitDraft)
    await act(async () => {
      await Promise.resolve();
    });

    expect(submitDraft).toHaveBeenCalledTimes(1);
    expect(form.trigger).toHaveBeenCalledWith(['email']);
  });

  test('given nested dirty fields, should trigger only those field paths', async () => {
    const form = createMockForm({
      dirtyFields: { address: { city: true, zip: true }, name: true },
    });
    const draftConfig: DraftConfig = { url: '/api/draft', method: 'POST' };

    const { result } = renderHook(() => useDraftSave({ form, draftConfig }));

    await act(async () => {
      result.current.saveDraft({ name: 'Jo', address: { city: 'NY', zip: '10001' } } as unknown as Partial<FormData>);
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(form.trigger).toHaveBeenCalledWith(
      expect.arrayContaining(['address.city', 'address.zip', 'name'])
    );
    expect(submitDraft).toHaveBeenCalledTimes(1);
  });
});

describe('flattenDirtyFields', () => {
  test('given flat boolean fields, should return top-level keys', () => {
    expect(flattenDirtyFields({ email: true, name: true })).toEqual(['email', 'name']);
  });

  test('given nested object fields, should return dot-notation paths', () => {
    expect(flattenDirtyFields({ address: { city: true, state: true } })).toEqual([
      'address.city',
      'address.state',
    ]);
  });

  test('given array fields, should return indexed paths', () => {
    expect(
      flattenDirtyFields({ items: [{ title: true }, undefined, { title: true }] as unknown as Record<string, unknown>[] })
    ).toEqual(['items.0.title', 'items.2.title']);
  });

  test('given deeply nested fields, should flatten all levels', () => {
    expect(
      flattenDirtyFields({ a: { b: { c: true } } })
    ).toEqual(['a.b.c']);
  });

  test('given empty object, should return empty array', () => {
    expect(flattenDirtyFields({})).toEqual([]);
  });
});
