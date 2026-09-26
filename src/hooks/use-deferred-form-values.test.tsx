/**
 * Tests for useDeferredFormValues — defers updates off Controller render path.
 */

import { describe, test, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { useDeferredFormValues } from './use-deferred-form-values';

describe('useDeferredFormValues', () => {
  test('given form value change, should update after microtask without throwing', async () => {
    const { result } = renderHook(() => {
      const form = useForm({ defaultValues: { name: '' } });
      const values = useDeferredFormValues(form);
      return { form, values };
    });

    await act(async () => {
      result.current.form.setValue('name', 'Ada');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.values.name).toBe('Ada');
    });
  });
});
