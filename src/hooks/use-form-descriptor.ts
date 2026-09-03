/**
 * useFormDescriptor Hook - Integrate react-hook-form with form descriptor system
 *
 * Custom hook that manages react-hook-form integration with the form descriptor,
 * including field registration, validation rule updates, and live Zod resolver.
 */

import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor, FormData, CaseContext } from '@/types/form-descriptor';
import {
  extractDefaultValues,
  mapBackendErrorsToForm,
  identifyDiscriminantFields,
} from '@/utils/form-descriptor-integration';
import { identifyFieldsWithTemplateDefaults } from '@/utils/field-descriptor-utils';
import type { FormContext } from '@/utils/template-evaluator';
import { useLiveZodResolver, useFormMembershipSync } from '@/hooks/use-live-zod-resolver';

export interface UseFormDescriptorOptions {
  onDiscriminantChange?: (formData: Partial<FormData>) => void;
  savedFormData?: Partial<FormData>;
  caseContext?: CaseContext;
  /** Initial form values for template default evaluation at mount only (not live schema deps) */
  formData?: Partial<FormData>;
  validationScope?: 'main' | 'popin';
}

export interface UseFormDescriptorReturn {
  form: UseFormReturn<FieldValues>;
  registerField: (fieldId: string) => void;
  unregisterField: (fieldId: string) => void;
  updateValidationRules: (descriptor: GlobalFormDescriptor) => void;
  setBackendErrors: (errors: Array<{ field: string; message: string }>) => void;
  getDiscriminantFields: () => string[];
}

export function useFormDescriptor(
  descriptor: GlobalFormDescriptor | null,
  options: UseFormDescriptorOptions = {}
): UseFormDescriptorReturn {
  const {
    savedFormData,
    caseContext = {},
    formData: initialFormData = {},
    validationScope = 'main',
  } = options;

  const initFormContext: FormContext = useMemo(
    () => ({
      caseContext: caseContext as unknown as FormContext,
      formData: { ...initialFormData, ...(savedFormData ?? {}) },
      ...initialFormData,
      ...(savedFormData ?? {}),
    }),
    [caseContext, initialFormData, savedFormData]
  );

  const defaultValues = useMemo(
    () => extractDefaultValues(descriptor, initFormContext, validationScope),
    [descriptor, initFormContext, validationScope]
  );

  const fieldsWithTemplateDefaults = useMemo(
    () => identifyFieldsWithTemplateDefaults(descriptor),
    [descriptor]
  );

  const initialValues = useMemo(() => {
    if (!savedFormData || Object.keys(savedFormData).length === 0) {
      return defaultValues;
    }

    const merged: Partial<FormData> = { ...defaultValues };

    for (const [key, savedValue] of Object.entries(savedFormData)) {
      const fieldId = key as keyof FormData;
      const newDefault = defaultValues[fieldId];

      if (savedValue === undefined || savedValue === null) {
        continue;
      }

      if (fieldsWithTemplateDefaults.has(key)) {
        const valuesDiffer = JSON.stringify(savedValue) !== JSON.stringify(newDefault);
        if (valuesDiffer) {
          merged[fieldId] = savedValue as FormData[keyof FormData];
        }
      } else {
        merged[fieldId] = savedValue as FormData[keyof FormData];
      }
    }

    return merged;
  }, [defaultValues, savedFormData, fieldsWithTemplateDefaults]);

  const defaultValuesByFieldId = useMemo(
    () => defaultValues as Record<string, unknown>,
    [defaultValues]
  );

  const { resolver, applyMembershipChanges, refreshSchemaFromDescriptor } = useLiveZodResolver({
    descriptor,
    caseContext,
    validationScope,
    defaultValuesByFieldId,
  });

  const form = useForm<FieldValues>({
    defaultValues: initialValues,
    resolver,
    mode: 'onChange',
  });

  useFormMembershipSync(
    form,
    descriptor,
    applyMembershipChanges,
    refreshSchemaFromDescriptor
  );

  const registeredFields = useRef(new Set<string>());

  const discriminantFields = useMemo(
    () => (descriptor ? identifyDiscriminantFields(descriptor) : []),
    [descriptor]
  );

  const registerField = useCallback(
    (fieldId: string) => {
      if (!descriptor || registeredFields.current.has(fieldId)) {
        return;
      }
      registeredFields.current.add(fieldId);
    },
    [descriptor]
  );

  const unregisterField = useCallback((fieldId: string) => {
    if (registeredFields.current.has(fieldId)) {
      registeredFields.current.delete(fieldId);
    }
  }, []);

  const updateValidationRules = useCallback(
    (_updatedDescriptor: GlobalFormDescriptor) => {
      refreshSchemaFromDescriptor(form);
    },
    [form, refreshSchemaFromDescriptor]
  );

  const setBackendErrors = useCallback(
    (errors: Array<{ field: string; message: string }>) => {
      const mappedErrors = mapBackendErrorsToForm(errors);
      for (const { field, error } of mappedErrors) {
        form.setError(field, error);
      }
    },
    [form]
  );

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
