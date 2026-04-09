/**
 * useDraftSave Hook
 *
 * Debounced, validity-gated draft autosave for the main form.
 * On each call to saveDraft(formValues):
 *  1. Cancels any pending debounced call
 *  2. Stores the latest values
 *  3. After the debounce window:
 *     a. Skips if the form is not dirty (no user interaction yet)
 *     b. Validates only dirty fields via form.trigger(dirtyPaths)
 *     c. If valid, calls submitDraft (skipping duplicate payloads)
 *
 * The hook is a no-op when draftConfig is undefined.
 */

import { useRef, useCallback, useEffect } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { DraftConfig, FormData as DescriptorFormData } from '@/types/form-descriptor';
import { submitDraft } from '@/utils/submission-orchestrator';

/**
 * Recursively flattens RHF's nested dirtyFields object into
 * dot-notation field paths suitable for form.trigger().
 */
export function flattenDirtyFields(
  dirtyFields: Record<string, unknown>,
  prefix = ''
): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(dirtyFields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === true) {
      paths.push(path);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item === true) {
          paths.push(`${path}.${index}`);
        } else if (typeof item === 'object' && item !== null) {
          paths.push(
            ...flattenDirtyFields(item as Record<string, unknown>, `${path}.${index}`)
          );
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      paths.push(
        ...flattenDirtyFields(value as Record<string, unknown>, path)
      );
    }
  }
  return paths;
}

const DEFAULT_DEBOUNCE_MS = 1000;

export interface UseDraftSaveOptions {
  form: UseFormReturn<FieldValues>;
  draftConfig: DraftConfig | undefined;
  onSuccess?: (response: unknown) => void;
  onError?: (error: unknown) => void;
}

export interface UseDraftSaveReturn {
  saveDraft: (formValues: Partial<DescriptorFormData>) => void;
}

export function useDraftSave({
  form,
  draftConfig,
  onSuccess,
  onError,
}: UseDraftSaveOptions): UseDraftSaveReturn {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValuesRef = useRef<Partial<DescriptorFormData> | null>(null);
  const lastSentHashRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const draftConfigRef = useRef(draftConfig);
  useEffect(() => {
    draftConfigRef.current = draftConfig;
  }, [draftConfig]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const saveDraft = useCallback(
    (formValues: Partial<DescriptorFormData>) => {
      if (!draftConfigRef.current) return;

      latestValuesRef.current = formValues;

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const debounceMs = draftConfigRef.current.debounceMs ?? DEFAULT_DEBOUNCE_MS;

      const id = setTimeout(async () => {
        if (timeoutRef.current !== id || !isMountedRef.current) return;
        timeoutRef.current = null;

        const config = draftConfigRef.current;
        if (!config || !latestValuesRef.current) return;

        if (!formRef.current.formState.isDirty) return;

        const currentHash = JSON.stringify(latestValuesRef.current);
        if (currentHash === lastSentHashRef.current) return;

        const dirtyPaths = flattenDirtyFields(
          formRef.current.formState.dirtyFields as Record<string, unknown>
        );
        if (dirtyPaths.length === 0) return;

        const isValid = await formRef.current.trigger(dirtyPaths);
        if (!isValid) return;

        lastSentHashRef.current = currentHash;

        await submitDraft({
          draftConfig: config,
          formValues: latestValuesRef.current,
          onSuccess,
          onError,
        });
      }, debounceMs);

      timeoutRef.current = id;
    },
    [onSuccess, onError]
  );

  return { saveDraft };
}
