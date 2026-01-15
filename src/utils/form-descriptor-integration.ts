/**
 * Form Descriptor Integration - Utilities for integrating react-hook-form with form descriptors
 * 
 * Provides utility functions to extract default values, get validation rules,
 * map backend errors, and identify discriminant fields from form descriptors.
 */

import type { FieldError } from 'react-hook-form';
import { z } from 'zod';
import type { GlobalFormDescriptor, FormData } from '@/types/form-descriptor';
import { convertToReactHookFormRules, convertToZodSchema } from './validation-rule-adapter';

/**
 * Extract default values from form descriptor fields
 * 
 * @param descriptor - Global form descriptor
 * @returns Object with field IDs as keys and default values as values
 */
export function extractDefaultValues(descriptor: GlobalFormDescriptor | null): Partial<FormData> {
  if (!descriptor) {
    return {};
  }

  const defaultValues: Partial<FormData> = {};

  for (const block of descriptor.blocks) {
    for (const field of block.fields) {
      // Always set a default value to ensure controlled inputs
      if (field.defaultValue !== undefined) {
        defaultValues[field.id as keyof FormData] = field.defaultValue as FormData[keyof FormData];
      } else {
        // Set type-appropriate default values for uncontrolled -> controlled transition
        switch (field.type) {
          case 'text':
          case 'dropdown':
          case 'autocomplete':
          case 'date':
            defaultValues[field.id as keyof FormData] = '' as FormData[keyof FormData];
            break;
          case 'checkbox':
            defaultValues[field.id as keyof FormData] = false as unknown as FormData[keyof FormData];
            break;
          case 'radio':
            defaultValues[field.id as keyof FormData] = '' as FormData[keyof FormData];
            break;
          case 'file':
            defaultValues[field.id as keyof FormData] = null as FormData[keyof FormData];
            break;
          default:
            defaultValues[field.id as keyof FormData] = '' as FormData[keyof FormData];
        }
      }
    }
  }

  return defaultValues;
}

/**
 * Get validation rules for a specific field from descriptor
 * 
 * @param descriptor - Global form descriptor
 * @param fieldId - Field ID to get validation rules for
 * @returns React Hook Form validation rules object
 */
export function getFieldValidationRules(
  descriptor: GlobalFormDescriptor | null,
  fieldId: string
): ReturnType<typeof convertToReactHookFormRules> {
  if (!descriptor) {
    return {};
  }

  for (const block of descriptor.blocks) {
    const field = block.fields.find((f) => f.id === fieldId);
    if (field && field.validation) {
      return convertToReactHookFormRules(field.validation);
    }
  }

  return {};
}

/**
 * Backend error format
 */
export interface BackendError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Mapped error format for react-hook-form setError
 */
export interface MappedFormError {
  field: string;
  error: FieldError;
}

/**
 * Map backend validation errors to react-hook-form setError format
 * 
 * @param errors - Array of backend validation errors
 * @returns Array of mapped errors ready for setError() calls
 */
export function mapBackendErrorsToForm(errors: BackendError[]): MappedFormError[] {
  return errors.map((error) => ({
    field: error.field,
    error: {
      type: 'server',
      message: error.message,
    } as FieldError,
  }));
}

/**
 * Identify all discriminant fields from descriptor
 * 
 * @param descriptor - Global form descriptor
 * @returns Array of field IDs that are marked as discriminant
 */
export function identifyDiscriminantFields(descriptor: GlobalFormDescriptor | null): string[] {
  if (!descriptor) {
    return [];
  }

  const discriminantFields: string[] = [];

  for (const block of descriptor.blocks) {
    for (const field of block.fields) {
      if (field.isDiscriminant === true) {
        discriminantFields.push(field.id);
      }
    }
  }

  return discriminantFields;
}

/**
 * Build a complete Zod schema object from form descriptor
 * 
 * @param descriptor - Global form descriptor
 * @returns Zod schema object with field IDs as keys and Zod schemas as values
 */
export function buildZodSchemaFromDescriptor(
  descriptor: GlobalFormDescriptor | null
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!descriptor) {
    return z.object({});
  }

  const schemaShape: Record<string, z.ZodTypeAny> = {};

  for (const block of descriptor.blocks) {
    for (const field of block.fields) {
      schemaShape[field.id] = convertToZodSchema(field.validation, field.type);
    }
  }

  return z.object(schemaShape);
}
