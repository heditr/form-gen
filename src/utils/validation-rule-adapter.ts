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
        // Always create a new RegExp instance to avoid mutating the one in Redux state
        // RegExp.test() mutates lastIndex, which violates Redux immutability rules
        const regexPattern = typeof rule.value === 'string' 
          ? new RegExp(rule.value) 
          : new RegExp(rule.value.source, rule.value.flags);
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
  // Preprocess undefined values to appropriate defaults to prevent type errors
  // This allows validation rules (like required) to show proper error messages
  let baseSchema: z.ZodTypeAny;
  let needsPreprocessing = false;
  let preprocessFn: ((val: unknown) => unknown) | null = null;
  
  switch (fieldType) {
    case 'checkbox':
      baseSchema = z.boolean();
      // Preprocess undefined to false so validation can run
      needsPreprocessing = true;
      preprocessFn = (val) => (val === undefined || val === null ? false : val);
      break;
    case 'file':
      baseSchema = z.union([z.instanceof(File), z.array(z.instanceof(File)), z.null()]);
      // Preprocess undefined to null so validation can run
      needsPreprocessing = true;
      preprocessFn = (val) => (val === undefined ? null : val);
      break;
    case 'radio':
      baseSchema = z.union([z.string(), z.number()]);
      // Preprocess undefined to empty string so validation can run
      needsPreprocessing = true;
      preprocessFn = (val) => (val === undefined || val === null ? '' : val);
      break;
    case 'number':
      // Use union to accept number or undefined, then refine will check if required
      baseSchema = z.union([z.number(), z.undefined()]);
      // Don't preprocess - let refine handle undefined for required validation
      needsPreprocessing = false;
      break;
    default:
      // For string fields, preprocess undefined to empty string
      baseSchema = z.string();
      needsPreprocessing = true;
      preprocessFn = (val) => (val === undefined || val === null ? '' : val);
      break;
  }

  // Apply preprocessing to handle undefined values
  let schema: z.ZodTypeAny = needsPreprocessing && preprocessFn
    ? z.preprocess(preprocessFn, baseSchema)
    : baseSchema;

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
          // For number, required means it must be a valid number (not NaN or undefined)
          schema = schema.refine((val) => {
            if (val === undefined || val === null) {
              return false;
            }
            const numVal = typeof val === 'number' ? val : Number(val);
            return !isNaN(numVal);
          }, {
            message: rule.message,
          });
        } else {
          // For string fields (text, dropdown, autocomplete, date), ensure not empty
          // Use refine instead of min() since schema is now ZodEffects from preprocessing
          schema = schema.refine((val) => {
            const strVal = String(val ?? '');
            return strVal.length >= 1;
          }, {
            message: rule.message,
          });
        }
        break;

      case 'minLength':
        if (fieldType === 'text' || fieldType === 'dropdown' || fieldType === 'autocomplete' || fieldType === 'date') {
          // Use refine since schema might be ZodEffects from preprocessing
          schema = schema.refine((val) => {
            const strVal = String(val ?? '');
            return strVal.length >= rule.value;
          }, {
            message: rule.message,
          });
        }
        // minLength doesn't apply to checkbox, file, radio, or number
        break;

      case 'maxLength':
        if (fieldType === 'text' || fieldType === 'dropdown' || fieldType === 'autocomplete' || fieldType === 'date') {
          // Use refine since schema might be ZodEffects from preprocessing
          schema = schema.refine((val) => {
            const strVal = String(val ?? '');
            return strVal.length <= rule.value;
          }, {
            message: rule.message,
          });
        }
        // maxLength doesn't apply to checkbox, file, radio, or number
        break;

      case 'pattern':
        if (fieldType === 'text' || fieldType === 'dropdown' || fieldType === 'autocomplete' || fieldType === 'date') {
          // Always create a new RegExp instance to avoid mutating the one in Redux state
          // RegExp.test() mutates lastIndex, which violates Redux immutability rules
          let regexPattern: RegExp;
          if (typeof rule.value === 'string') {
            // Strip leading/trailing slashes if present (common when patterns are serialized from JSON)
            let patternString = rule.value;
            if (patternString.startsWith('/') && patternString.endsWith('/')) {
              patternString = patternString.slice(1, -1);
            }
            regexPattern = new RegExp(patternString);
          } else {
            regexPattern = new RegExp(rule.value.source, rule.value.flags);
          }
          // Use refine since schema might be ZodEffects from preprocessing
          // Skip pattern validation for empty strings - let required validation handle those
          schema = schema.refine((val) => {
            const strVal = String(val ?? '');
            // If empty, skip pattern validation (required validation will catch it)
            if (strVal.length === 0) {
              return true;
            }
            return regexPattern.test(strVal);
          }, {
            message: rule.message,
          });
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
