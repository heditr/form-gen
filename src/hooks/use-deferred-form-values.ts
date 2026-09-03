/**
 * Subscribe to RHF values without useWatch.
 *
 * useWatch updates the subscriber during Controller's render (field register /
 * default value sync), which triggers "Cannot update a component while rendering
 * a different component (Controller)". Deferring setState to a microtask avoids that.
 */

import { useEffect, useState } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';

export function useDeferredFormValues(
  form: UseFormReturn<FieldValues>
): Record<string, unknown> {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => form.getValues() as Record<string, unknown>
  );

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;
    let latest: Record<string, unknown> = form.getValues() as Record<string, unknown>;

    const flush = () => {
      scheduled = false;
      if (cancelled) {
        return;
      }
      setValues(latest);
    };

    const subscription = form.watch((next) => {
      latest = (next ?? {}) as Record<string, unknown>;
      if (scheduled) {
        return;
      }
      scheduled = true;
      queueMicrotask(flush);
    });

    // Sync once after subscribe (covers values set before mount).
    latest = form.getValues() as Record<string, unknown>;
    queueMicrotask(flush);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [form]);

  return values;
}
