/**
 * Tests for useFieldError hook.
 */

import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { useFieldError } from './use-field-error';

vi.unmock('@/hooks/use-field-error');

describe('useFieldError', () => {
  test('given field error, should return error message', async () => {
    const { result } = renderHook(() => {
      const form = useForm({ defaultValues: { email: '' } });
      const error = useFieldError(form, 'email');
      return { form, error };
    });

    await act(async () => {
      result.current.form.setError('email', { type: 'required', message: 'Email is required' });
    });

    expect(result.current.error?.message).toBe('Email is required');
  });
});
