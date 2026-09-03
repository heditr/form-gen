/**
 * Per-field error subscription via useFormState.
 */

import { useFormState } from 'react-hook-form';
import type { UseFormReturn, FieldValues, FieldError } from 'react-hook-form';
import { getErrorByPath } from '@/utils/form-errors';

export function useFieldError(
  form: UseFormReturn<FieldValues>,
  fieldId: string
): FieldError | undefined {
  const { errors } = useFormState({
    control: form.control,
    name: fieldId as never,
  });

  if (!errors) {
    return undefined;
  }

  return (
    getErrorByPath(errors, fieldId) ??
    (errors[fieldId] as FieldError | undefined)
  );
}
