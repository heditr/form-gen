/**
 * Default Value Evaluator - Utility for evaluating Handlebars templates in field default values
 * 
 * Provides function to evaluate defaultValue templates with form context and convert
 * results to the appropriate type based on field type.
 */

import { evaluateTemplate, type FormContext } from './template-evaluator';
import type { DocumentCardData, FieldType } from '@/types/form-descriptor';

export interface EvaluateDefaultValueOptions {
  /**
   * Row index used to bind the `@index` preprocessor token before Handlebars compile.
   * Only integers >= 0 are applied; unbound `@index` templates return a type default
   * without compiling (Handlebars cannot parse `foo.@index.bar`).
   */
  index?: number;
}

/**
 * Replace the `@index` preprocessor token with a numeric path segment.
 * This is not Handlebars data-frame `@index` — it rewrites the template string
 * so `{{caseContext.items.@index.name}}` becomes `{{caseContext.items.0.name}}`.
 */
export function bindTemplateIndex(template: string, index: number): string {
  return template.replaceAll('@index', String(index));
}

function typeDefaultForField(
  fieldType: FieldType
): string | number | boolean | Date | null {
  switch (fieldType) {
    case 'checkbox':
      return false;
    case 'number':
      return 0;
    case 'date':
    case 'file':
      return null;
    default:
      return '';
  }
}

function parseDateDefaultValue(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/**
 * Evaluate a field's defaultValue, handling both static values and Handlebars templates
 * 
 * @param defaultValue - The default value (can be string template or static value)
 * @param fieldType - The type of field (determines return type and conversion)
 * @param context - Form context for template evaluation
 * @param options - Optional `@index` bind for repeatable / popin instance defaults
 * @returns Evaluated and type-converted default value
 */
export function evaluateDefaultValue(
  defaultValue: string | string[] | number | boolean | DocumentCardData | null | undefined,
  fieldType: FieldType,
  context: FormContext,
  options: EvaluateDefaultValueOptions = {}
): string | number | boolean | Date | string[] | DocumentCardData | null | undefined {
  // If defaultValue is not a string, return it unchanged (static value)
  if (typeof defaultValue !== 'string') {
    return defaultValue;
  }

  // Check if this looks like a Handlebars template (contains {{ or }})
  // If not, treat it as a plain string value
  const isTemplate = defaultValue.includes('{{') && defaultValue.includes('}}');
  if (!isTemplate) {
    // For file fields, convert 'null' string to null even if not a template
    // This handles cases where defaultValue is explicitly set to the string 'null'
    if (fieldType === 'file') {
      const trimmed = defaultValue.trim();
      if (trimmed === '' || trimmed.toLowerCase() === 'null') {
        return null;
      }
    }
    // For checkbox/number, allow plain string values to be parsed for convenience
    if (fieldType === 'checkbox') {
      return parseBoolean(defaultValue);
    }
    if (fieldType === 'number') {
      return parseNumber(defaultValue);
    }
    if (fieldType === 'date') {
      return parseDateDefaultValue(defaultValue);
    }

    // For other field types, return the string as-is (no parsing for non-templates)
    return defaultValue;
  }

  const { index } = options;
  const shouldBindIndex = typeof index === 'number' && Number.isInteger(index) && index >= 0;
  const template = shouldBindIndex ? bindTemplateIndex(defaultValue, index) : defaultValue;

  // Unbound `@index` is a preprocessor token, not valid Handlebars — skip compile
  if (template.includes('@index')) {
    return typeDefaultForField(fieldType);
  }

  // Evaluate Handlebars template
  const evaluated = evaluateTemplate(template, context);

  // Convert result based on field type
  switch (fieldType) {
    case 'text':
    case 'dropdown':
    case 'autocomplete':
      return evaluated;

    case 'date':
      return parseDateDefaultValue(evaluated);

    case 'checkbox':
      return parseBoolean(evaluated);

    case 'number':
      return parseNumber(evaluated);

    case 'radio':
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
