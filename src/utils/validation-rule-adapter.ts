/**
 * Validation Rule Adapter - Convert ValidationRule[] to react-hook-form rules and Zod schema
 * 
 * Provides functions to convert ValidationRule[] from form descriptors into:
 * 1. react-hook-form validation rules (for use with register() or Controller)
 * 2. Zod schema (for use with @hookform/resolvers)
 */

import { z } from 'zod';
import type { ValidationRule } from '@/types/form-descriptor';

/**
 * React Hook Form validation rules type
 * Matches the structure expected by react-hook-form's register() and Controller
 */
export interface ReactHookFormRules {
  required?: string | boolean;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  validate?: (value: unknown) => boolean | string;
}

/**
 * Convert ValidationRule[] to react-hook-form validation rules object
 * 
 * @param rules - Array of validation rules from form descriptor
 * @returns React Hook Form validation rules object
 */
export function convertToReactHookFormRules(rules: ValidationRule[] | undefined | null): ReactHookFormRules {
  const result: ReactHookFormRules = {};

  // Handle undefined, null, or non-array values
  if (!rules || !Array.isArray(rules)) {
    return result;
  }

  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        result.required = rule.message;
        break;

      case 'minLength':
        result.minLength = {
          value: rule.value,
          message: rule.message,
        };
        break;

      case 'maxLength':
        result.maxLength = {
          value: rule.value,
          message: rule.message,
        };
        break;

      case 'pattern': {
        // Convert string pattern to RegExp if needed (e.g., when loaded from JSON)
        const regexPattern = typeof rule.value === 'string' 
          ? new RegExp(rule.value) 
          : rule.value;
        result.pattern = {
          value: regexPattern,
          message: rule.message,
        };
        break;
      }

      case 'custom': {
        // If validate function already exists, combine them
        const existingValidate = result.validate;
        const customValidator = rule.value;
        const ruleMessage = rule.message;
        
        if (existingValidate) {
          result.validate = (value: unknown) => {
            const existingResult = existingValidate(value);
            if (existingResult !== true) {
              return existingResult;
            }
            
            const customResult = customValidator(value);
            // If validator returns boolean true, validation passes
            if (customResult === true) {
              return true;
            }
            // If validator returns boolean false, use rule message
            if (customResult === false) {
              return ruleMessage;
            }
            // If validator returns string (error message), use rule message instead
            // This ensures consistent error messages from the descriptor
            return ruleMessage;
          };
        } else {
          result.validate = (value: unknown) => {
            const customResult = customValidator(value);
            // If validator returns boolean true, validation passes
            if (customResult === true) {
              return true;
            }
            // If validator returns boolean false, use rule message
            if (customResult === false) {
              return ruleMessage;
            }
            // If validator returns string (error message), use rule message instead
            // This ensures consistent error messages from the descriptor
            return ruleMessage;
          };
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Convert ValidationRule[] to Zod schema for a specific field type
 * 
 * @param rules - Array of validation rules from form descriptor
 * @param fieldType - Type of field (text, checkbox, file, etc.)
 * @returns Zod schema with applied validations
 */
export function convertToZodSchema(
  rules: ValidationRule[] | undefined | null,
  fieldType: 'text' | 'dropdown' | 'autocomplete' | 'date' | 'radio' | 'checkbox' | 'file' | 'number' = 'text'
): z.ZodTypeAny {
  // Handle undefined, null, or non-array values
  if (!rules || !Array.isArray(rules)) {
    // Return appropriate base schema based on field type
    switch (fieldType) {
      case 'checkbox':
        return z.boolean();
      case 'file':
        return z.union([z.instanceof(File), z.array(z.instanceof(File)), z.null()]);
      case 'radio':
        return z.union([z.string(), z.number()]);
      case 'number':
        return z.number();
      default:
        return z.string();
    }
  }

  // Start with base schema based on field type
  let schema: z.ZodTypeAny;
  switch (fieldType) {
    case 'checkbox':
      schema = z.boolean();
      break;
    case 'file':
      schema = z.union([z.instanceof(File), z.array(z.instanceof(File)), z.null()]);
      break;
    case 'radio':
      schema = z.union([z.string(), z.number()]);
      break;
    case 'number':
      schema = z.number();
      break;
    default:
      schema = z.string();
  }

  // Apply validation rules
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (fieldType === 'checkbox') {
          // For checkbox, required means it must be true
          schema = (schema as z.ZodBoolean).refine((val) => val === true, {
            message: rule.message,
          });
        } else if (fieldType === 'file') {
          // For file, required means it cannot be null
          schema = (schema as z.ZodUnion<[z.ZodType<File>, z.ZodType<File[]>, z.ZodNull]>).refine((val) => val !== null, {
            message: rule.message,
          });
        } else if (fieldType === 'radio') {
          // For radio, required means it cannot be empty string or undefined
          schema = schema.refine((val) => {
            if (typeof val === 'string') {
              return val !== '';
            }
            if (typeof val === 'number') {
              return val !== null && val !== undefined;
            }
            return false;
          }, {
            message: rule.message,
          });
        } else if (fieldType === 'number') {
          // For number, required means it must be a valid number (not NaN)
          schema = (schema as z.ZodNumber).refine((val) => !isNaN(val) && val !== null && val !== undefined, {
            message: rule.message,
          });
        } else {
          // For string fields (text, dropdown, autocomplete, date), ensure not empty
          schema = (schema as z.ZodString).min(1, rule.message);
        }
        break;

      case 'minLength':
        if (fieldType === 'text' || fieldType === 'dropdown' || fieldType === 'autocomplete' || fieldType === 'date') {
          schema = (schema as z.ZodString).min(rule.value, rule.message);
        }
        // minLength doesn't apply to checkbox, file, radio, or number
        break;

      case 'maxLength':
        if (fieldType === 'text' || fieldType === 'dropdown' || fieldType === 'autocomplete' || fieldType === 'date') {
          schema = (schema as z.ZodString).max(rule.value, rule.message);
        }
        // maxLength doesn't apply to checkbox, file, radio, or number
        break;

      case 'pattern':
        if (fieldType === 'text' || fieldType === 'dropdown' || fieldType === 'autocomplete' || fieldType === 'date') {
          // Convert string pattern to RegExp if needed (e.g., when loaded from JSON)
          const regexPattern = typeof rule.value === 'string' 
            ? new RegExp(rule.value) 
            : rule.value;
          schema = (schema as z.ZodString).regex(regexPattern, rule.message);
        }
        // pattern doesn't apply to checkbox, file, radio, or number
        break;

      case 'custom':
        schema = schema.refine(
          (value) => {
            const result = rule.value(value);
            // If validator returns boolean, use it directly
            if (typeof result === 'boolean') {
              return result;
            }
            // If validator returns string (error message), treat as validation failure
            return false;
          },
          {
            message: rule.message,
          }
        );
        break;
    }
  }

  return schema;
}
