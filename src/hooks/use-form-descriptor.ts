/**
 * useFormDescriptor Hook - Integrate react-hook-form with form descriptor system
 * 
 * Custom hook that manages react-hook-form integration with the form descriptor,
 * including field registration, validation rule updates, and Redux synchronization.
 */

import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm, useWatch, type UseFormReturn, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { GlobalFormDescriptor, FormData, CaseContext } from '@/types/form-descriptor';
import {
  extractDefaultValues,
  mapBackendErrorsToForm,
  identifyDiscriminantFields,
  buildZodSchemaFromDescriptor,
} from '@/utils/form-descriptor-integration';
import { identifyFieldsWithTemplateDefaults } from '@/utils/field-descriptor-utils';
import type { FormContext } from '@/utils/template-evaluator';

export interface UseFormDescriptorOptions {
  onDiscriminantChange?: (formData: Partial<FormData>) => void;
  savedFormData?: Partial<FormData>; // Form data from Redux to restore on remount
  caseContext?: CaseContext; // Case context for template evaluation
  formData?: Partial<FormData>; // Current form data for template evaluation
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
  const { onDiscriminantChange, savedFormData, caseContext = {}, formData: contextFormData = {} } = options;

  // Build form context for template evaluation
  const formContext: FormContext = useMemo(() => ({
    caseContext,
    formData: contextFormData,
    ...contextFormData, // Also allow direct access to form values
  }), [caseContext, contextFormData]);

  // Extract default values from descriptor with context for template evaluation
  const defaultValues = useMemo(
    () => extractDefaultValues(descriptor, formContext),
    [descriptor, formContext]
  );

  // Identify fields with template defaultValues (need to be re-evaluated when context changes)
  const fieldsWithTemplateDefaults = useMemo(
    () => identifyFieldsWithTemplateDefaults(descriptor),
    [descriptor]
  );

  // Merge saved form data with defaults to preserve values on remount
  // For template fields: preserve user-entered values if they differ from the new default
  // This ensures user changes are preserved while allowing defaults to update when context changes
  // IMPORTANT: Always ensure all values are defined (never undefined) to prevent uncontrolled input warnings
  const initialValues = useMemo(() => {
    if (!savedFormData || Object.keys(savedFormData).length === 0) {
      return defaultValues;
    }
    
    // Merge saved data with defaults
    // Start with defaults to ensure all fields have defined values
    const merged: Partial<FormData> = { ...defaultValues };
    
    for (const [key, savedValue] of Object.entries(savedFormData)) {
      const fieldId = key as keyof FormData;
      const newDefault = defaultValues[fieldId];
      
      // Skip undefined/null values to prevent uncontrolled input warnings
      if (savedValue === undefined || savedValue === null) {
        continue;
      }
      
      if (fieldsWithTemplateDefaults.has(key)) {
        // For template fields: preserve saved value if it differs from new default
        // This handles two cases:
        // 1. User changed the field -> preserve their change
        // 2. Context changed but saved value differs -> preserve (likely user change)
        // If saved value matches new default, use new default (allows context updates)
        const valuesDiffer = JSON.stringify(savedValue) !== JSON.stringify(newDefault);
        if (valuesDiffer) {
          // Values differ - user likely changed it, preserve their value
          merged[fieldId] = savedValue as FormData[keyof FormData];
        }
        // If values match, use new default (already in merged) - allows context updates
      } else {
        // For non-template fields: always preserve saved value (if defined)
        merged[fieldId] = savedValue as FormData[keyof FormData];
      }
    }
    
    return merged;
  }, [defaultValues, savedFormData, fieldsWithTemplateDefaults]);

  // Build Zod schema from descriptor
  const zodSchema = useMemo(() => buildZodSchemaFromDescriptor(descriptor), [descriptor]);

  // Initialize react-hook-form with Zod resolver
  const form = useForm<FieldValues>({
    defaultValues: initialValues,
    resolver: zodResolver(zodSchema),
    mode: 'onChange', // Validate on change for immediate feedback
  });

  console.log(form.getValues())

  // Track registered fields (for compatibility, but not needed with Zod)
  const registeredFields = useRef(new Set<string>());

  // Get discriminant fields
  const discriminantFields = useMemo(
    () => (descriptor ? identifyDiscriminantFields(descriptor) : []),
    [descriptor]
  );

  // Register a field (kept for API compatibility, but Zod handles validation)
  const registerField = useCallback(
    (fieldId: string) => {
      if (!descriptor || registeredFields.current.has(fieldId)) {
        return;
      }
      // With Zod resolver, fields are automatically validated
      // This is kept for API compatibility but doesn't need to do anything
      registeredFields.current.add(fieldId);
    },
    [descriptor]
  );

  // Unregister a field (kept for API compatibility)
  const unregisterField = useCallback(
    (fieldId: string) => {
      if (registeredFields.current.has(fieldId)) {
        registeredFields.current.delete(fieldId);
      }
    },
    []
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

  // Watch all form values and sync to Redux for restoration on remount
  // This ensures form values are preserved when form remounts due to validation rule changes
  // Use useWatch instead of form.watch() to avoid React Compiler memoization issues
  const watchedValues = useWatch({ control: form.control });
  
  // Use ref to track previous values and prevent infinite loops
  // Only sync when values actually change, not just when object reference changes
  const previousValuesRef = useRef<string | null>(null);

  useEffect(() => {
    if (!descriptor || !onDiscriminantChange) {
      return;
    }

    // Serialize current values to compare with previous
    // Handle null/undefined by converting to empty object for comparison
    const currentValues = watchedValues ?? {};
    const currentValuesString = JSON.stringify(currentValues);
    
    // Only sync if values actually changed (not just object reference)
    if (currentValuesString === previousValuesRef.current) {
      return;
    }

    // Update ref with new values
    previousValuesRef.current = currentValuesString;

    // Sync all form data to Redux whenever any field changes
    // This allows form values to be restored when the form remounts
    // The container's handleDiscriminantChange will handle discriminant field logic
    const formData = currentValues as Partial<FormData>;
    onDiscriminantChange(formData);
  }, [descriptor, watchedValues, onDiscriminantChange]);

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
