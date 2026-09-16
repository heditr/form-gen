/**
 * Popin form context helpers — instance seeding and Handlebars evaluation context.
 *
 * Repeatable popins edit one group-array row in an isolated RHF instance.
 * Status templates (hidden/disabled) must see that row's field values, not the
 * main form's colliding keys (e.g. main `country` vs address `country`).
 */

import type { CaseContext, FormData } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';

export interface PopinEditContext {
  groupId: string;
  index: number;
}

export interface BuildPopinFormContextParams {
  mainFormValues?: Record<string, unknown>;
  popinValues?: Record<string, unknown>;
  initialFormContext?: FormContext;
  popinLoadData?: Record<string, unknown> | null;
  caseContext?: CaseContext;
}

export interface GetPopinLoadFieldValuesParams {
  fields: Array<{ id: string; repeatableGroupId?: string }>;
  popinLoadData?: Record<string, unknown> | null;
  groupId?: string;
}

/**
 * Read a cloned row from a repeatable group array for popin edit seeding.
 * Returns undefined for create mode (index < 0) or missing data.
 */
export function getRepeatablePopinInstanceValues(
  mainFormValues: Record<string, unknown>,
  popinEditContext: PopinEditContext | null
): Record<string, unknown> | undefined {
  if (!popinEditContext) {
    return undefined;
  }

  const { groupId, index } = popinEditContext;
  if (typeof index !== 'number' || index < 0) {
    return undefined;
  }

  const groupArray = mainFormValues[groupId];
  if (!Array.isArray(groupArray)) {
    return undefined;
  }

  const instanceData = groupArray[index];
  if (!instanceData || typeof instanceData !== 'object' || Array.isArray(instanceData)) {
    return undefined;
  }

  return structuredClone(instanceData) as Record<string, unknown>;
}

/**
 * Map popinLoad response keys onto popin form field ids.
 * Repeatable create uses base ids (group prefix stripped); standalone skips group fields.
 */
export function getPopinLoadFieldValues({
  fields,
  popinLoadData = null,
  groupId,
}: GetPopinLoadFieldValuesParams): Record<string, unknown> {
  if (!popinLoadData) {
    return {};
  }

  const values: Record<string, unknown> = {};

  for (const field of fields) {
    if (groupId) {
      if (field.repeatableGroupId && field.repeatableGroupId !== groupId) {
        continue;
      }
      const baseId = field.id.startsWith(`${groupId}.`)
        ? field.id.slice(groupId.length + 1)
        : field.id;
      if (popinLoadData[baseId] !== undefined) {
        values[baseId] = popinLoadData[baseId];
      }
      continue;
    }

    if (field.repeatableGroupId) {
      continue;
    }
    if (popinLoadData[field.id] !== undefined) {
      values[field.id] = popinLoadData[field.id];
    }
  }

  return values;
}

/**
 * Build Handlebars/status context for a popin session.
 * Popin field values always win over main-form keys with the same name.
 */
export function buildPopinFormContext({
  mainFormValues = {},
  popinValues = {},
  initialFormContext = {},
  popinLoadData = null,
  caseContext,
}: BuildPopinFormContextParams): FormContext {
  const mergedValues = {
    ...mainFormValues,
    ...popinValues,
  } as FormData;

  const resolvedCaseContext =
    (initialFormContext.caseContext as FormContext | undefined) ??
    (caseContext as unknown as FormContext | undefined);

  return {
    ...initialFormContext,
    ...mergedValues,
    ...(popinLoadData ?? {}),
    ...popinValues,
    ...(resolvedCaseContext ? { caseContext: resolvedCaseContext } : {}),
    formData: mergedValues,
  };
}
