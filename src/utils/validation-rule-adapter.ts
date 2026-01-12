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
  validate?: (value: any) => boolean | string;
}

/**
 * Convert ValidationRule[] to react-hook-form validation rules object
 * 
 * @param rules - Array of validation rules from form descriptor
 * @returns React Hook Form validation rules object
 */
export function convertToReactHookFormRules(rules: ValidationRule[]): ReactHookFormRules {
  const result: ReactHookFormRules = {};

  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        result.required = rule.message;
        break;

      case 'minLength':
        if (typeof rule.value === 'number') {
          result.minLength = {
            value: rule.value,
            message: rule.message,
          };
        }
        break;

      case 'maxLength':
        if (typeof rule.value === 'number') {
          result.maxLength = {
            value: rule.value,
            message: rule.message,
          };
        }
        break;

      case 'pattern':
        if (rule.value instanceof RegExp) {
          result.pattern = {
            value: rule.value,
            message: rule.message,
          };
        }
        break;

      case 'custom':
        if (typeof rule.value === 'function') {
          // If validate function already exists, combine them
          const existingValidate = result.validate;
          const customValidator = rule.value;
          const ruleMessage = rule.message;
          
          if (existingValidate) {
            result.validate = (value: any) => {
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
            result.validate = (value: any) => {
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
        }
        break;
    }
  }

  return result;
}

/**
 * Convert ValidationRule[] to Zod schema
 * 
 * @param rules - Array of validation rules from form descriptor
 * @returns Zod schema with applied validations
 */
export function convertToZodSchema(rules: ValidationRule[]): z.ZodString {
  let schema = z.string();

  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        // For required, we need to ensure the string is not empty
        // Use min(1) to enforce non-empty string with custom message
        schema = schema.min(1, rule.message);
        break;

      case 'minLength':
        if (typeof rule.value === 'number') {
          schema = schema.min(rule.value, rule.message);
        }
        break;

      case 'maxLength':
        if (typeof rule.value === 'number') {
          schema = schema.max(rule.value, rule.message);
        }
        break;

      case 'pattern':
        if (rule.value instanceof RegExp) {
          schema = schema.regex(rule.value, rule.message);
        }
        break;

      case 'custom':
        if (typeof rule.value === 'function') {
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
        }
        break;
    }
  }

  return schema;
}
