/**
 * Row value helpers shared by default extraction, schema building, and repeatable rows.
 *
 * Pure functions with no dependency on the descriptor integration module.
 */

import type { FieldDescriptor } from '@/types/form-descriptor';
import { evaluateHiddenStatus } from './template-evaluator';
import type { FormContext } from './template-evaluator';

/**
 * Fields persisted out-of-band by their own backend interactions should remain
 * in RHF state for UI/draft purposes, but should not participate in final submit
 * payloads or submit-time required validation.
 */
export function isSubmitSkippedFieldType(fieldType: FieldDescriptor['type'] | string): boolean {
  return fieldType === 'file' || fieldType === 'document';
}

/**
 * Helper to set a nested value on an object using dot-notation path
 * (e.g. "businessAddress.line1" → obj.businessAddress.line1).
 */
export function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  if (!path) {
    return;
  }
  const parts = path.split('.');
  let current: Record<string, unknown> = target;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const existing = current[key];

    if (
      !existing ||
      typeof existing !== 'object' ||
      Array.isArray(existing)
    ) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  const lastKey = parts[parts.length - 1];
  current[lastKey] = value;
}

/**
 * Helper to get a nested value from an object using dot-notation path
 * (e.g. "businessAddress.line1" ← obj.businessAddress.line1).
 */
export function getNestedValue(
  source: Record<string, unknown> | undefined,
  path: string
): unknown {
  if (!source || !path) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = source;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part)) {
        return undefined;
      }
      current = current[Number(part)];
      continue;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Context for evaluating a default value's hidden status: the source row and the
 * row built so far overlaid on the parent context.
 */
export function defaultStatusContext(
  parent: FormContext,
  sourceRow: Record<string, unknown> | undefined,
  builtRow: Record<string, unknown>
): FormContext {
  const parentFormData =
    parent.formData &&
    typeof parent.formData === 'object' &&
    !Array.isArray(parent.formData)
      ? (parent.formData as Record<string, unknown>)
      : {};
  const row = { ...(sourceRow ?? {}), ...builtRow };

  return {
    ...parent,
    ...row,
    formData: { ...parentFormData, ...row },
  } as FormContext;
}

export function shouldSkipHiddenDefault(field: FieldDescriptor, statusContext: FormContext): boolean {
  if (field.type === 'button' || isSubmitSkippedFieldType(field.type)) {
    return false;
  }
  // An explicit default belongs on the row even while a main-form condition hides the field.
  // Fields with no default are omitted so a row-local hide (for example companyName on a
  // residential address) does not copy a value that does not apply.
  if (field.defaultValue !== undefined) {
    return false;
  }
  return evaluateHiddenStatus(field, statusContext);
}
