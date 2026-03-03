/**
 * FormValuesWatcher Component
 *
 * Isolates useWatch in a child component to prevent "Cannot update a component
 * while rendering a different component (Controller)" - when useWatch runs in
 * the parent, its setState triggers a parent re-render during Controller's
 * render; moving useWatch here ensures only this component re-renders.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor, FormData, CaseContext } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';

export interface FormValuesWatcherProps {
  form: UseFormReturn<FieldValues>;
  caseContext: CaseContext;
  descriptor: GlobalFormDescriptor | null;
  onDiscriminantChange?: (formData: Partial<FormData>) => void;
  children: (formContext: FormContext) => React.ReactNode;
}

export default function FormValuesWatcher({
  form,
  caseContext,
  descriptor,
  onDiscriminantChange,
  children,
}: FormValuesWatcherProps) {
  const watchedValues = useWatch({ control: form.control });
  const previousValuesRef = useRef<string | null>(null);

  useEffect(() => {
    if (!descriptor || !onDiscriminantChange) {
      return;
    }

    const currentValues = watchedValues ?? {};
    const currentValuesString = JSON.stringify(currentValues);

    if (currentValuesString === previousValuesRef.current) {
      return;
    }

    previousValuesRef.current = currentValuesString;
    const formData = currentValues as Partial<FormData>;
    const id = setTimeout(() => onDiscriminantChange(formData), 0);
    return () => clearTimeout(id);
  }, [descriptor, watchedValues, onDiscriminantChange]);

  const formContext: FormContext = useMemo(
    () => ({
      ...(watchedValues ?? {}),
      caseContext,
      formData: (watchedValues ?? {}) as Partial<FormData>,
    }),
    [watchedValues, caseContext]
  );

  return <>{children(formContext)}</>;
}
