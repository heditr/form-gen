/**
 * Form Values Watcher — discriminant detection only.
 *
 * Draft saves are scheduled from the main form's blur handler, not from value
 * changes. When a discriminant field changes, onDiscriminantChange runs on the
 * next macrotask. The container flushes any pending draft before rehydration.
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
}

export default function FormValuesWatcher({
  form,
  discriminantFields = [],
  onDiscriminantChange,
}: FormValuesWatcherProps) {
  const watchedValues = useDeferredFormValues(form);
  const previousValuesRef = useRef<Partial<FormData> | null>(null);
  const onDiscriminantChangeRef = useRef(onDiscriminantChange);

  useEffect(() => {
    onDiscriminantChangeRef.current = onDiscriminantChange;
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
      return;
    }

    const shouldNotifyDiscriminant =
      discriminantFields.length > 0 &&
      Boolean(onDiscriminantChangeRef.current) &&
      haveDiscriminantFieldsChanged(previousValues, currentValues, discriminantFields);

    if (!shouldNotifyDiscriminant) {
      previousValuesRef.current = currentValues;
      return;
    }

    // Defer baseline advance until notify runs so Strict Mode remount /
    // parent callback identity churn cannot swallow the change after clearTimeout.
    const id = setTimeout(() => {
      previousValuesRef.current = currentValues;
      onDiscriminantChangeRef.current?.(currentValues);
    }, 0);

    return () => clearTimeout(id);
  }, [watchedValues, discriminantFields]);

  return null;
}
