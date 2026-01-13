/**
 * useFormDescriptor Hook - Integrate react-hook-form with form descriptor system
 * 
 * Custom hook that manages react-hook-form integration with the form descriptor,
 * including field registration, validation rule updates, and Redux synchronization.
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor, FormData } from '@/types/form-descriptor';
import {
  extractDefaultValues,
  getFieldValidationRules,
  mapBackendErrorsToForm,
  identifyDiscriminantFields,
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

  // Initialize react-hook-form
  const form = useForm<FieldValues>({
    defaultValues,
    mode: 'onChange', // Validate on change for immediate feedback
  });

  // Track registered fields
  const registeredFields = useMemo(() => new Set<string>(), []);

  // Get discriminant fields
  const discriminantFields = useMemo(
    () => (descriptor ? identifyDiscriminantFields(descriptor) : []),
    [descriptor]
  );

  // Register a field with its validation rules
  const registerField = useCallback(
    (fieldId: string) => {
      if (!descriptor || registeredFields.has(fieldId)) {
        return;
      }

      const validationRules = getFieldValidationRules(descriptor, fieldId);
      form.register(fieldId, validationRules);
      registeredFields.add(fieldId);
    },
    [descriptor, form, registeredFields]
  );

  // Unregister a field
  const unregisterField = useCallback(
    (fieldId: string) => {
      if (registeredFields.has(fieldId)) {
        form.unregister(fieldId);
        registeredFields.delete(fieldId);
      }
    },
    [form, registeredFields]
  );

  // Update validation rules when descriptor changes
  const updateValidationRules = useCallback(
    (updatedDescriptor: GlobalFormDescriptor) => {
      if (!updatedDescriptor) {
        return;
      }

      // Re-register all currently registered fields with updated rules
      for (const fieldId of registeredFields) {
        const validationRules = getFieldValidationRules(updatedDescriptor, fieldId);
        // Clear existing errors before updating rules
        form.clearErrors(fieldId);
        // Re-register with new rules
        form.register(fieldId, validationRules);
      }
    },
    [form, registeredFields]
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
