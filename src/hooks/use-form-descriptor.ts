/**
 * useFormDescriptor Hook - Integrate react-hook-form with form descriptor system
 * 
 * Custom hook that manages react-hook-form integration with the form descriptor,
 * including field registration, validation rule updates, and Redux synchronization.
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { GlobalFormDescriptor, FormData } from '@/types/form-descriptor';
import {
  extractDefaultValues,
  mapBackendErrorsToForm,
  identifyDiscriminantFields,
  buildZodSchemaFromDescriptor,
  type MappedFormError,
} from '@/utils/form-descriptor-integration';

export interface UseFormDescriptorOptions {
  onDiscriminantChange?: (formData: Partial<FormData>) => void;
}

export interface UseFormDescriptorReturn {
  form: UseFormReturn<FieldValues>;
  registerField: (fieldId: string) => void;
  unregisterField: (fieldId: string) => void;
  updateValidationRules: (descriptor: GlobalFormDescriptor) => void;
  setBackendErrors: (errors: Array<{ field: string; message: string }>) => void;
  getDiscriminantFields: () => string[];
}

/**
 * Custom hook to integrate react-hook-form with form descriptor system
 * 
 * @param descriptor - Global form descriptor (can be null during loading)
 * @param options - Optional configuration including callbacks
 * @returns Form hook and utility methods
 */
export function useFormDescriptor(
  descriptor: GlobalFormDescriptor | null,
  options: UseFormDescriptorOptions = {}
): UseFormDescriptorReturn {
  const { onDiscriminantChange } = options;

  // Extract default values from descriptor
  const defaultValues = useMemo(() => extractDefaultValues(descriptor), [descriptor]);

  // Build Zod schema from descriptor
  const zodSchema = useMemo(() => buildZodSchemaFromDescriptor(descriptor), [descriptor]);

  // Initialize react-hook-form with Zod resolver
  const form = useForm<FieldValues>({
    defaultValues,
    resolver: zodResolver(zodSchema),
    mode: 'onChange', // Validate on change for immediate feedback
  });

  // Track registered fields (for compatibility, but not needed with Zod)
  const registeredFields = useMemo(() => new Set<string>(), []);

  // Get discriminant fields
  const discriminantFields = useMemo(
    () => (descriptor ? identifyDiscriminantFields(descriptor) : []),
    [descriptor]
  );

  // Register a field (kept for API compatibility, but Zod handles validation)
  const registerField = useCallback(
    (fieldId: string) => {
      if (!descriptor || registeredFields.has(fieldId)) {
        return;
      }
      // With Zod resolver, fields are automatically validated
      // This is kept for API compatibility but doesn't need to do anything
      registeredFields.add(fieldId);
    },
    [descriptor, registeredFields]
  );

  // Unregister a field (kept for API compatibility)
  const unregisterField = useCallback(
    (fieldId: string) => {
      if (registeredFields.has(fieldId)) {
        registeredFields.delete(fieldId);
      }
    },
    [registeredFields]
  );

  // Update validation rules when descriptor changes
  // Note: react-hook-form doesn't support changing the resolver after initialization.
  // When validation rules change (e.g., during re-hydration), the form needs to be
  // remounted with a new resolver. This is typically handled at the container level
  // by using a key that changes when the descriptor changes significantly.
  const updateValidationRules = useCallback(
    (updatedDescriptor: GlobalFormDescriptor) => {
      if (!updatedDescriptor) {
        return;
      }

      // Clear existing errors - new validation will occur on next user interaction
      // The schema is memoized and will update, but the resolver won't change until remount
      form.clearErrors();
      
      // Trigger re-validation of all fields with current values
      // This helps catch any new validation errors immediately
      form.trigger();
    },
    [form]
  );

  // Map and set backend validation errors
  const setBackendErrors = useCallback(
    (errors: Array<{ field: string; message: string }>) => {
      const mappedErrors = mapBackendErrorsToForm(errors);
      for (const { field, error } of mappedErrors) {
        form.setError(field, error);
      }
    },
    [form]
  );

  // Watch discriminant fields and sync to Redux
  useEffect(() => {
    if (!descriptor || discriminantFields.length === 0 || !onDiscriminantChange) {
      return;
    }

    const subscription = form.watch((value, { name }) => {
      // Only trigger if a discriminant field changed
      if (name && discriminantFields.includes(name)) {
        onDiscriminantChange(value as Partial<FormData>);
      }
    });

    return () => subscription.unsubscribe();
  }, [descriptor, discriminantFields, form, onDiscriminantChange]);

  // Auto-register all fields from descriptor on mount/update
  // With Zod resolver, this is mainly for tracking purposes
  useEffect(() => {
    if (!descriptor) {
      return;
    }

    for (const block of descriptor.blocks) {
      for (const field of block.fields) {
        registerField(field.id);
      }
    }
  }, [descriptor, registerField]);

  return {
    form,
    registerField,
    unregisterField,
    updateValidationRules,
    setBackendErrors,
    getDiscriminantFields: () => discriminantFields,
  };
}
