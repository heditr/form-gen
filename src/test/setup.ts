import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import type { FieldError, FieldValues, UseFormReturn } from 'react-hook-form';

vi.mock('@/hooks/use-field-error', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-field-error')>();
  const { getErrorByPath } = await import('@/utils/form-errors');

  return {
    useFieldError: (form: UseFormReturn<FieldValues>, fieldId: string): FieldError | undefined => {
      const control = form.control as { _subscribe?: unknown };
      if (typeof control?._subscribe === 'function') {
        return actual.useFieldError(form, fieldId);
      }
      return (
        getErrorByPath(form.formState?.errors ?? {}, fieldId) ??
        (form.formState?.errors?.[fieldId] as FieldError | undefined)
      );
    },
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
