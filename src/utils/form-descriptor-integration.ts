/**
 * Form Descriptor Integration - Utilities for integrating react-hook-form with form descriptors
 * 
 * Provides utility functions to extract default values, get validation rules,
 * map backend errors, and identify discriminant fields from form descriptors.
 */

import type { FieldError } from 'react-hook-form';
import { z } from 'zod';
import type { GlobalFormDescriptor, FormData, BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import { convertToReactHookFormRules, convertToZodSchema } from './validation-rule-adapter';
import { evaluateDefaultValue } from './default-value-evaluator';
import type { FormContext } from './template-evaluator';

/**
 * Extract default values from form descriptor fields
 * 
 * @param descriptor - Global form descriptor
 * @param context - Optional form context for template evaluation (formData, caseContext)
 * @returns Object with field IDs as keys and default values as values
 */
export function extractDefaultValues(
  descriptor: GlobalFormDescriptor | null,
  context: FormContext = {}
): Partial<FormData> {
  if (!descriptor) {
    return {};
  }

  const defaultValues: Partial<FormData> = {};

  for (const block of descriptor.blocks) {
    for (const field of block.fields) {
      // Always set a default value to ensure controlled inputs
      if (field.defaultValue !== undefined) {
        // Evaluate defaultValue as Handlebars template if it's a string, otherwise use directly
        const evaluatedValue = evaluateDefaultValue(
          field.defaultValue,
          field.type,
          context
        );
        defaultValues[field.id as keyof FormData] = evaluatedValue as FormData[keyof FormData];
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
          case 'number':
            defaultValues[field.id as keyof FormData] = 0 as unknown as FormData[keyof FormData];
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
 * Check if a block is repeatable
 * 
 * @param block - Block descriptor to check
 * @returns true if block is marked as repeatable, false otherwise
 */
export function isRepeatableBlock(block: BlockDescriptor): boolean {
  return block.repeatable === true;
}

/**
 * Group fields by their repeatableGroupId
 * 
 * @param fields - Array of field descriptors
 * @returns Object mapping repeatableGroupId to array of fields in that group
 */
export function groupFieldsByRepeatableGroupId(
  fields: FieldDescriptor[]
): Record<string, FieldDescriptor[]> {
  const groups: Record<string, FieldDescriptor[]> = {};

  for (const field of fields) {
    if (field.repeatableGroupId) {
      if (!groups[field.repeatableGroupId]) {
        groups[field.repeatableGroupId] = [];
      }
      groups[field.repeatableGroupId].push(field);
    }
  }

  return groups;
}

/**
 * Build a complete Zod schema object from form descriptor
 * 
 * For repeatable blocks, builds array schemas (z.array(z.object({...}))) for each repeatable group.
 * For non-repeatable fields, builds individual field schemas.
 * 
 * @param descriptor - Global form descriptor
 * @returns Zod schema object with field IDs or group IDs as keys and Zod schemas as values
 */
export function buildZodSchemaFromDescriptor(
  descriptor: GlobalFormDescriptor | null
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!descriptor) {
    return z.object({});
  }

  const schemaShape: Record<string, z.ZodTypeAny> = {};
  const processedRepeatableGroups = new Set<string>();

  for (const block of descriptor.blocks) {
    if (isRepeatableBlock(block)) {
      // Handle repeatable blocks - group fields by repeatableGroupId
      const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
      
      for (const [groupId, fields] of Object.entries(fieldGroups)) {
        // Skip if we've already processed this group (e.g., multiple blocks with same group)
        if (processedRepeatableGroups.has(groupId)) {
          continue;
        }
        
      // Build object schema for fields in this repeatable group
      const objectShape: Record<string, z.ZodTypeAny> = {};
      for (const field of fields) {
        // Skip button fields - they don't have values to validate
        if (field.type === 'button') {
          continue;
        }
        // Type assertion: we've already checked it's not a button
        const fieldType = field.type as Exclude<typeof field.type, 'button'>;
        objectShape[field.id] = convertToZodSchema(field.validation, fieldType);
      }
        
        // Create array schema for this repeatable group
        schemaShape[groupId] = z.array(z.object(objectShape));
        processedRepeatableGroups.add(groupId);
      }
    } else {
      // Handle non-repeatable blocks - add fields as individual properties
      for (const field of block.fields) {
        // Skip fields that belong to a repeatable group (they're handled above)
        // Skip button fields - they don't have values to validate
        if (!field.repeatableGroupId && field.type !== 'button') {
          // Type assertion: we've already checked it's not a button
          const fieldType = field.type as Exclude<typeof field.type, 'button'>;
          schemaShape[field.id] = convertToZodSchema(field.validation, fieldType);
        }
      }
    }
  }

  return z.object(schemaShape);
}
