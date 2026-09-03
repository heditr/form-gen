/**
 * Form Values Watcher — side effects only (discriminant detection, draft save).
 */

import { useEffect, useRef } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormData, CaseContext, FieldDescriptor } from '@/types/form-descriptor';
import { haveDiscriminantFieldsChanged } from '@/utils/context-extractor';
import { useDeferredFormValues } from '@/hooks/use-deferred-form-values';

export interface FormValuesWatcherProps {
  form: UseFormReturn<FieldValues>;
  caseContext: CaseContext;
  discriminantFields?: FieldDescriptor[];
  onDiscriminantChange?: (formData: Partial<FormData>) => void;
  onFormChange?: (formData: Partial<FormData>) => void;
}

export default function FormValuesWatcher({
  form,
  caseContext,
  discriminantFields = [],
  onDiscriminantChange,
  onFormChange,
}: FormValuesWatcherProps) {
  const watchedValues = useDeferredFormValues(form);
  const previousValuesRef = useRef<string | null>(null);

  useEffect(() => {
    const currentValues = watchedValues ?? {};
    const currentValuesString = JSON.stringify(currentValues);

    if (currentValuesString === previousValuesRef.current) {
      return;
    }

    previousValuesRef.current = currentValuesString;
    const formData = currentValues as Partial<FormData>;

    if (discriminantFields.length === 0 || !onDiscriminantChange) {
      return;
    }

    if (!haveDiscriminantFieldsChanged(caseContext, formData, discriminantFields)) {
      return;
    }

    const id = setTimeout(() => onDiscriminantChange(formData), 0);
    // eslint-disable-next-line consistent-return
    return () => clearTimeout(id);
  }, [watchedValues, onDiscriminantChange, caseContext, discriminantFields]);

  useEffect(() => {
    if (!onFormChange) return;
    onFormChange((watchedValues ?? {}) as Partial<FormData>);
  }, [watchedValues, onFormChange]);

  return null;
}
