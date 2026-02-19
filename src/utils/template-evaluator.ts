/**
 * Template Evaluator - Utility functions for evaluating Handlebars templates with form context
 * 
 * Provides functions to evaluate templates and status conditions for blocks and fields
 */

import Handlebars from 'handlebars';
import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';

/**
 * Type for values that can be used in Handlebars templates
 */
type TemplateValue = string | number | boolean | null | undefined;

/**
 * Type for form context used in template evaluation
 * Supports nested objects for dot notation access (e.g., user.name, person.address.city)
 * 
 * The context typically contains:
 * - formData: Current form field values
 * - caseContext: Discriminant field values (may include arrays e.g. addresses for repeatableDefaultSource)
 * - Other dynamic properties for template evaluation
 */
export type FormContext = {
  [key: string]:
    | TemplateValue
    | FormContext
    | TemplateValue[]
    | FormContext[]
    | Array<Record<string, unknown>>;
};

/**
 * Evaluate a Handlebars template with the given context
 * 
 * @param template - Handlebars template string (can be undefined)
 * @param context - Form context for template evaluation
 * @returns Evaluated template result as string, or empty string if template is undefined/empty
 */
export function evaluateTemplate(template: string | undefined, context: FormContext): string {
  if (!template) {
    return '';
  }

  try {
    const compiled = Handlebars.compile(template);
    const result = compiled(context);
    return result;
  } catch (error) {
    console.error('Error evaluating template:', error, 'Template:', template, 'Context:', context);
    return '';
  }
}

/**
 * Convert template result to boolean
 * Handlebars templates return strings, so we need to parse "true"/"false" strings
 * 
 * @param result - Template evaluation result
 * @returns Boolean value
 */
function parseBooleanResult(result: string): boolean {
  const normalized = result.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

/**
 * Evaluate hidden status template for a block or field descriptor
 * 
 * @param descriptor - Block or field descriptor with optional status templates
 * @param context - Form context for template evaluation
 * @returns true if hidden, false if visible
 */
export function evaluateHiddenStatus(
  descriptor: BlockDescriptor | FieldDescriptor,
  context: FormContext
): boolean {
  const template = descriptor.status?.hidden;
  if (!template) {
    return false; // Visible by default
  }

  const result = evaluateTemplate(template, context);
  return parseBooleanResult(result);
}

/**
 * Evaluate disabled status template for a block or field descriptor
 * 
 * @param descriptor - Block or field descriptor with optional status templates
 * @param context - Form context for template evaluation
 * @returns true if disabled, false if enabled
 */
export function evaluateDisabledStatus(
  descriptor: BlockDescriptor | FieldDescriptor,
  context: FormContext
): boolean {
  const template = descriptor.status?.disabled;
  if (!template) {
    return false; // Enabled by default
  }

  const result = evaluateTemplate(template, context);
  return parseBooleanResult(result);
}

/**
 * Evaluate readonly status template for a block or field descriptor
 * 
 * @param descriptor - Block or field descriptor with optional status templates
 * @param context - Form context for template evaluation
 * @returns true if readonly, false if editable
 */
export function evaluateReadonlyStatus(
  descriptor: BlockDescriptor | FieldDescriptor,
  context: FormContext
): boolean {
  const template = descriptor.status?.readonly;
  if (!template) {
    return false; // Editable by default
  }

  const result = evaluateTemplate(template, context);
  return parseBooleanResult(result);
}
