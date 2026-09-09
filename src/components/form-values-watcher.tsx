/**
 * Form Values Watcher — side effects only (discriminant detection, draft save).
 *
 * On value changes, draft (`onFormChange`) is always triggered before
 * rehydration (`onDiscriminantChange`) when a discriminant field changed.
 */

import { useEffect, useRef } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormData, FieldDescriptor } from '@/types/form-descriptor';
import { haveDiscriminantFieldsChanged } from '@/utils/context-extractor';
import { useDeferredFormValues } from '@/hooks/use-deferred-form-values';

export interface FormValuesWatcherProps {
  form: UseFormReturn<FieldValues>;
  discriminantFields?: FieldDescriptor[];
  onDiscriminantChange?: (formData: Partial<FormData>) => void;
  onFormChange?: (formData: Partial<FormData>) => void;
}

export default function FormValuesWatcher({
  form,
  discriminantFields = [],
  onDiscriminantChange,
  onFormChange,
}: FormValuesWatcherProps) {
  const watchedValues = useDeferredFormValues(form);
  const previousValuesRef = useRef<Partial<FormData> | null>(null);
  const onDiscriminantChangeRef = useRef(onDiscriminantChange);
  const onFormChangeRef = useRef(onFormChange);

  useEffect(() => {
    onDiscriminantChangeRef.current = onDiscriminantChange;
    onFormChangeRef.current = onFormChange;
  });

  useEffect(() => {
    const currentValues = (watchedValues ?? {}) as Partial<FormData>;
    const previousValues = previousValuesRef.current;

    if (
      previousValues !== null &&
      JSON.stringify(previousValues) === JSON.stringify(currentValues)
    ) {
      return;
    }

    // Establish baseline on first observation — not a user change
    if (previousValues === null) {
      previousValuesRef.current = currentValues;
      onFormChangeRef.current?.(currentValues);
      return;
    }

    const shouldNotifyDiscriminant =
      discriminantFields.length > 0 &&
      Boolean(onDiscriminantChangeRef.current) &&
      haveDiscriminantFieldsChanged(previousValues, currentValues, discriminantFields);

    if (!shouldNotifyDiscriminant) {
      previousValuesRef.current = currentValues;
      onFormChangeRef.current?.(currentValues);
      return;
    }

    // Defer baseline advance until notify runs so Strict Mode remount /
    // parent callback identity churn cannot swallow the change after clearTimeout.
    // Draft must run before rehydration in the same turn.
    const id = setTimeout(() => {
      previousValuesRef.current = currentValues;
      onFormChangeRef.current?.(currentValues);
      onDiscriminantChangeRef.current?.(currentValues);
    }, 0);

    return () => clearTimeout(id);
  }, [watchedValues, discriminantFields]);

  return null;
}
