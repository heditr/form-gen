/**
 * Form Validator - Utility to validate form values against merged descriptor rules
 * 
 * Provides functions to validate form values against validation rules and data sources
 * from a merged GlobalFormDescriptor.
 */

import type {
  GlobalFormDescriptor,
  FieldDescriptor,
  ValidationRule,
  FormData,
  FieldItem,
} from '@/types/form-descriptor';
import { loadDataSource } from './data-source-loader';
import type { FormContext } from './template-evaluator';

/**
 * Validation error format
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validate a single field value against its validation rules
 * 
 * @param field - Field descriptor with validation rules
 * @param value - Field value to validate
 * @returns Array of validation errors (empty if valid)
 */
function validateField(
  field: FieldDescriptor,
  value: unknown
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!field.validation || field.validation.length === 0) {
    return errors;
  }

  for (const rule of field.validation) {
    const error = validateRule(rule, value);
    if (error) {
      errors.push({
        field: field.id,
        message: error,
      });
    }
  }

  return errors;
}

/**
 * Validate a value against a single validation rule
 * 
 * @param rule - Validation rule to apply
 * @param value - Value to validate
 * @returns Error message if validation fails, null if valid
 */
function validateRule(
  rule: ValidationRule,
  value: unknown
): string | null {
  switch (rule.type) {
    case 'required': {
      // Check if value is present and non-empty
      if (value === null || value === undefined || value === '') {
        return rule.message;
      }
      // For arrays, check if empty
      if (Array.isArray(value) && value.length === 0) {
        return rule.message;
      }
      // For booleans, any value is considered present
      if (typeof value === 'boolean') {
        // Boolean fields are always considered to have a value (true or false)
        return null;
      }
      return null;
    }

    case 'minLength': {
      if (value === null || value === undefined) {
        return null; // Let required rule handle null/undefined
      }
      const stringValue = String(value);
      if (stringValue.length < rule.value) {
        return rule.message;
      }
      return null;
    }

    case 'maxLength': {
      if (value === null || value === undefined) {
        return null; // Let required rule handle null/undefined
      }
      const stringValue = String(value);
      if (stringValue.length > rule.value) {
        return rule.message;
      }
      return null;
    }

    case 'pattern': {
      if (value === null || value === undefined) {
        return null; // Let required rule handle null/undefined
      }
      const stringValue = String(value);
      const regex = typeof rule.value === 'string' 
        ? new RegExp(rule.value) 
        : rule.value;
      if (!regex.test(stringValue)) {
        return rule.message;
      }
      return null;
    }

    case 'custom': {
      if (value === null || value === undefined) {
        return null; // Let required rule handle null/undefined
      }
      const result = rule.value(value);
      if (result === true) {
        return null;
      }
      // If result is a string, use it as the error message
      // Otherwise, use the rule's message
      return typeof result === 'string' ? result : rule.message;
    }

    default:
      return null;
  }
}

/**
 * Validate a single field value against its validation rules and data source
 * 
 * @param field - Field descriptor with validation rules and optional data source
 * @param value - Field value to validate
 * @param formContext - Form context for template evaluation (for data source URL templates)
 * @returns Array of validation errors (empty if valid)
 */
export async function validateFieldValue(
  field: FieldDescriptor,
  value: unknown,
  formContext: FormContext
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Validate field against its validation rules
  const ruleErrors = validateField(field, value);
  errors.push(...ruleErrors);

  // Validate data source if field has dataSource and value is provided
  if (field.dataSource && value !== null && value !== undefined && value !== '') {
    try {
      // Load data source items
      const items = await loadDataSource(field.dataSource, formContext);
      
      // Check if value exists in items
      const valueExists = items.some((item: FieldItem) => {
        // Compare by value property
        return item.value === value || String(item.value) === String(value);
      });

      if (!valueExists) {
        errors.push({
          field: field.id,
          message: `Value "${value}" is not from valid data source options`,
          code: 'INVALID_DATA_SOURCE_VALUE',
        });
      }
    } catch (error) {
      // If data source loading fails, we can't validate the value
      // Log the error but don't fail validation (data source might be temporarily unavailable)
      console.error(`Failed to load data source for field ${field.id}:`, error);
      // Optionally, we could add a warning error here, but for now we'll skip it
      // to avoid false positives when data sources are temporarily unavailable
    }
  }

  return errors;
}

/**
 * Validate form values against merged descriptor
 * 
 * @param descriptor - Merged GlobalFormDescriptor with all validation rules
 * @param formValues - Form values to validate
 * @returns Array of validation errors
 */
export async function validateFormValues(
  descriptor: GlobalFormDescriptor,
  formValues: Partial<FormData>
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Create form context from formValues for template evaluation
  const formContext: FormContext = {
    ...formValues,
    formData: formValues,
  };

  // Iterate through all blocks and fields
  for (const block of descriptor.blocks) {
    for (const field of block.fields) {
      const value = formValues[field.id];
      
      // Validate field against its validation rules and data source
      const fieldErrors = await validateFieldValue(field, value, formContext);
      errors.push(...fieldErrors);
    }
  }

  return errors;
}
