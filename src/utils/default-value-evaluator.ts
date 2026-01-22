/**
 * Default Value Evaluator - Utility for evaluating Handlebars templates in field default values
 * 
 * Provides function to evaluate defaultValue templates with form context and convert
 * results to the appropriate type based on field type.
 */

import { evaluateTemplate, type FormContext } from './template-evaluator';
import type { FieldType } from '@/types/form-descriptor';

/**
 * Evaluate a field's defaultValue, handling both static values and Handlebars templates
 * 
 * @param defaultValue - The default value (can be string template or static value)
 * @param fieldType - The type of field (determines return type and conversion)
 * @param context - Form context for template evaluation
 * @returns Evaluated and type-converted default value
 */
export function evaluateDefaultValue(
  defaultValue: string | number | boolean | null | undefined,
  fieldType: FieldType,
  context: FormContext
): string | number | boolean | string[] | null | undefined {
  // If defaultValue is not a string, return it unchanged (static value)
  if (typeof defaultValue !== 'string') {
    return defaultValue;
  }

  // Check if this looks like a Handlebars template (contains {{ or }})
  // If not, treat it as a plain string value
  const isTemplate = defaultValue.includes('{{') && defaultValue.includes('}}');
  if (!isTemplate) {
    return defaultValue;
  }

  // Evaluate Handlebars template
  const evaluated = evaluateTemplate(defaultValue, context);

  // Convert result based on field type
  switch (fieldType) {
    case 'text':
    case 'dropdown':
    case 'autocomplete':
    case 'date':
      return evaluated;

    case 'checkbox':
      return parseBoolean(evaluated);

    case 'number':
      return parseNumber(evaluated);

    case 'radio':
      // Radio can be string or number, but template always returns string
      // Try to parse as number if it's a pure number string
      const numValue = parseNumber(evaluated);
      if (numValue !== 0 || evaluated === '0') {
        // If it parsed to a number (including 0), return as number
        // But only if the original string was a pure number
        if (/^-?\d+(\.\d+)?$/.test(evaluated.trim())) {
          return numValue;
        }
      }
      return evaluated;

    case 'file':
      // File fields: return null for empty/null strings, otherwise return URL string
      const trimmed = evaluated.trim();
      if (trimmed === '' || trimmed.toLowerCase() === 'null') {
        return null;
      }
      return evaluated;

    default:
      return evaluated;
  }
}

/**
 * Parse a string to boolean
 * Handlebars templates return strings, so we need to parse "true"/"false" strings
 * 
 * @param value - String value to parse
 * @returns Boolean value
 */
function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

/**
 * Parse a string to number
 * Returns 0 if parsing fails (fallback for number fields)
 * 
 * @param value - String value to parse
 * @returns Number value, or 0 if parsing fails
 */
function parseNumber(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') {
    return 0;
  }
  const parsed = Number(trimmed);
  return isNaN(parsed) ? 0 : parsed;
}
