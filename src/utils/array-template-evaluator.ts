import type { FieldItem, ValidationRule } from '@/types/form-descriptor';
import { evaluateTemplate, type FormContext } from '@/utils/template-evaluator';

function hasHandlebarsSyntax(value: string): boolean {
  return value.includes('{{') && value.includes('}}');
}

function parseJsonArray(value: string): unknown[] | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function evaluateTemplateJsonArray(
  value: unknown,
  context: FormContext,
  fallback: unknown[] = []
): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const output = hasHandlebarsSyntax(value) ? evaluateTemplate(value, context) : value;
  const parsed = parseJsonArray(output);
  return parsed ?? fallback;
}

function isFieldItem(value: unknown): value is FieldItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.label === 'string' && 'value' in v;
}

export function evaluateItemsArrayTemplate(
  items: FieldItem[] | string | undefined,
  context: FormContext
): FieldItem[] {
  if (!items) {
    return [];
  }
  if (Array.isArray(items)) {
    return items;
  }

  const parsed = evaluateTemplateJsonArray(items, context, []);
  return parsed.filter(isFieldItem).map((item) => item as FieldItem);
}

function isValidationRule(value: unknown): value is ValidationRule {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (typeof v.type !== 'string' || typeof v.message !== 'string') {
    return false;
  }

  if (v.type === 'minLength' || v.type === 'maxLength') {
    return typeof v.value === 'number';
  }
  if (v.type === 'pattern') {
    return typeof v.value === 'string';
  }
  if (v.type === 'required') {
    return true;
  }

  // We intentionally exclude 'custom' from template parsing since it cannot be
  // represented in JSON safely.
  return false;
}

export function evaluateValidationArrayTemplate(
  validation: ValidationRule[] | string | undefined,
  context: FormContext
): ValidationRule[] {
  if (!validation) {
    return [];
  }
  if (Array.isArray(validation)) {
    return validation;
  }

  const parsed = evaluateTemplateJsonArray(validation, context, []);
  return parsed.filter(isValidationRule).map((rule) => rule as ValidationRule);
}

