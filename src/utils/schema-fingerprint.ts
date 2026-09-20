/**
 * Schema fingerprint utilities — shared definition of which fields participate
 * in validation for main form, popin, and submit-time checks.
 */

import type { GlobalFormDescriptor, CaseContext, FormData } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { evaluateHiddenStatus } from '@/utils/template-evaluator';
import { evaluateValidationArrayTemplate } from '@/utils/array-template-evaluator';
import {
  isRepeatableBlock,
  groupFieldsByRepeatableGroupId,
  isSubmitSkippedFieldType,
} from '@/utils/form-descriptor-integration';

export type ValidationScope = 'main' | 'popin';

export interface ValidationTarget {
  id: string;
  ruleFingerprint: string;
}

function shouldIncludeBlockInScope(
  block: { includeInMainValidation?: boolean },
  scope: ValidationScope
): boolean {
  if (scope === 'popin') {
    return true;
  }
  return block.includeInMainValidation !== false;
}

function buildRuleFingerprint(
  field: { validation?: unknown },
  formContext: FormContext
): string {
  const rules = evaluateValidationArrayTemplate(field.validation, formContext);
  return rules
    .map((rule) => {
      if (rule.type === 'pattern') {
        const patternValue =
          typeof rule.value === 'string' ? rule.value : String(rule.value);
        return `${rule.type}:${patternValue}`;
      }
      return `${rule.type}:${'value' in rule ? rule.value : ''}`;
    })
    .join(',') || 'none';
}

export function buildFormContextFromValues(
  formValues: Partial<FormData>,
  caseContext: CaseContext = {}
): FormContext {
  return {
    ...formValues,
    caseContext: caseContext as unknown as FormContext,
    formData: formValues,
  };
}

/**
 * Collect field ids that are status-hidden (block or field), including file/document.
 * Used for value membership — distinct from Zod validation targets.
 */
function cloneValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (
    value instanceof Date ||
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof Blob !== 'undefined' && value instanceof Blob)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      cloneValue(nestedValue),
    ])
  );
}

function deleteNestedValue(target: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let current: Record<string, unknown> | undefined = target;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const next = current?.[parts[i]];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return;
    }
    current = next as Record<string, unknown>;
  }

  delete current?.[parts[parts.length - 1]];
}

function overlayRowContext(
  formContext: FormContext,
  row: Record<string, unknown>
): FormContext {
  const parentFormData =
    formContext.formData &&
    typeof formContext.formData === 'object' &&
    !Array.isArray(formContext.formData)
      ? (formContext.formData as Record<string, unknown>)
      : {};

  return {
    ...formContext,
    ...row,
    formData: { ...parentFormData, ...row },
  } as FormContext;
}

function hasNestedKey(target: Record<string, unknown>, path: string): boolean {
  const parts = path.split('.');
  let current: unknown = target;

  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return false;
    }
    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, part)) {
      return false;
    }
    current = record[part];
  }

  return true;
}

type HiddenDeletion =
  | { kind: 'group'; groupId: string }
  | { kind: 'path'; path: string }
  | { kind: 'row'; groupId: string; rowIndex: number; path: string };

/**
 * Drop status-hidden keys, including per-row keys in repeatable groups.
 * Row templates overlay the row onto parent context so address `country`
 * wins over jurisdiction `country`. Returns the input object when nothing
 * present is hidden, so submit of an already-clean payload does not clone.
 */
export function omitStatusHiddenFormValues(
  descriptor: GlobalFormDescriptor | null,
  formValues: Partial<FormData>,
  caseContext: CaseContext = {},
  scope: ValidationScope = 'main'
): Partial<FormData> {
  if (!descriptor) {
    return formValues;
  }

  const source = formValues as Record<string, unknown>;
  const formContext = buildFormContextFromValues(formValues, caseContext);
  const deletions: HiddenDeletion[] = [];

  for (const block of descriptor.blocks) {
    if (!shouldIncludeBlockInScope(block, scope)) {
      continue;
    }

    const blockHidden = evaluateHiddenStatus(block, formContext);

    if (isRepeatableBlock(block)) {
      const groups = groupFieldsByRepeatableGroupId(block.fields);
      for (const [groupId, fields] of Object.entries(groups)) {
        if (blockHidden) {
          if (Object.prototype.hasOwnProperty.call(source, groupId)) {
            deletions.push({ kind: 'group', groupId });
          }
          continue;
        }

        const groupValue = source[groupId];
        if (!Array.isArray(groupValue)) {
          continue;
        }

        groupValue.forEach((row, rowIndex) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) {
            return;
          }

          const rowRecord = row as Record<string, unknown>;
          const rowContext = overlayRowContext(formContext, rowRecord);

          for (const field of fields) {
            if (field.type === 'button' || isSubmitSkippedFieldType(field.type)) {
              continue;
            }
            if (!evaluateHiddenStatus(field, rowContext)) {
              continue;
            }
            const baseFieldId = field.id.startsWith(`${groupId}.`)
              ? field.id.slice(groupId.length + 1)
              : field.id;
            if (hasNestedKey(rowRecord, baseFieldId)) {
              deletions.push({ kind: 'row', groupId, rowIndex, path: baseFieldId });
            }
          }
        });
      }
      continue;
    }

    for (const field of block.fields) {
      if (
        field.type === 'button' ||
        field.repeatableGroupId ||
        isSubmitSkippedFieldType(field.type)
      ) {
        continue;
      }
      if (!(blockHidden || evaluateHiddenStatus(field, formContext))) {
        continue;
      }
      if (hasNestedKey(source, field.id)) {
        deletions.push({ kind: 'path', path: field.id });
      }
    }
  }

  if (deletions.length === 0) {
    return formValues;
  }

  const stripped = cloneValue(formValues) as Record<string, unknown>;
  for (const deletion of deletions) {
    if (deletion.kind === 'group') {
      delete stripped[deletion.groupId];
      continue;
    }
    if (deletion.kind === 'path') {
      deleteNestedValue(stripped, deletion.path);
      continue;
    }

    const groupValue = stripped[deletion.groupId];
    if (!Array.isArray(groupValue)) {
      continue;
    }
    const row = groupValue[deletion.rowIndex];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      continue;
    }
    deleteNestedValue(row as Record<string, unknown>, deletion.path);
  }

  return stripped as Partial<FormData>;
}

export function collectStatusHiddenFieldIds(
  descriptor: GlobalFormDescriptor | null,
  formContext: FormContext,
  scope: ValidationScope = 'main'
): string[] {
  if (!descriptor) {
    return [];
  }

  const hiddenIds: string[] = [];

  for (const block of descriptor.blocks) {
    if (!shouldIncludeBlockInScope(block, scope)) {
      continue;
    }

    const blockHidden = evaluateHiddenStatus(block, formContext);

    if (isRepeatableBlock(block)) {
      const groups = groupFieldsByRepeatableGroupId(block.fields);
      for (const [groupId, fields] of Object.entries(groups)) {
        const allHidden =
          blockHidden ||
          fields.every(
            (field) =>
              field.type === 'button' || evaluateHiddenStatus(field, formContext)
          );
        if (allHidden) {
          hiddenIds.push(groupId);
        }
      }
      continue;
    }

    for (const field of block.fields) {
      if (field.type === 'button' || field.repeatableGroupId) {
        continue;
      }
      if (blockHidden || evaluateHiddenStatus(field, formContext)) {
        hiddenIds.push(field.id);
      }
    }
  }

  return hiddenIds;
}

/**
 * Collect field/group ids that participate in validation plus per-field rule fingerprints.
 */
export function collectValidationTargets(
  descriptor: GlobalFormDescriptor | null,
  formContext: FormContext,
  scope: ValidationScope = 'main'
): ValidationTarget[] {
  if (!descriptor) {
    return [];
  }

  const targets: ValidationTarget[] = [];

  for (const block of descriptor.blocks) {
    if (!shouldIncludeBlockInScope(block, scope)) {
      continue;
    }

    if (evaluateHiddenStatus(block, formContext)) {
      continue;
    }

    if (isRepeatableBlock(block)) {
      const groups = groupFieldsByRepeatableGroupId(block.fields);
      for (const [groupId, fields] of Object.entries(groups)) {
        const visibleFields = fields.filter(
          (field) =>
            field.type !== 'button' &&
            !isSubmitSkippedFieldType(field.type) &&
            !evaluateHiddenStatus(field, formContext)
        );
        if (visibleFields.length === 0) {
          continue;
        }
        const ruleFingerprint = visibleFields
          .map((field) => {
            const baseFieldId = field.id.startsWith(`${groupId}.`)
              ? field.id.slice(groupId.length + 1)
              : field.id;
            return `${baseFieldId}:${buildRuleFingerprint(field, formContext)}`;
          })
          .join('|');
        targets.push({ id: groupId, ruleFingerprint });
      }
      continue;
    }

    for (const field of block.fields) {
      if (
        field.type === 'button' ||
        isSubmitSkippedFieldType(field.type) ||
        field.repeatableGroupId ||
        evaluateHiddenStatus(field, formContext)
      ) {
        continue;
      }
      targets.push({
        id: field.id,
        ruleFingerprint: buildRuleFingerprint(field, formContext),
      });
    }
  }

  return targets;
}

export function buildSchemaFingerprint({
  descriptor,
  caseContext,
  targets,
}: {
  descriptor: GlobalFormDescriptor | null;
  caseContext: CaseContext;
  targets: ValidationTarget[];
}): string {
  const descriptorIdentity = descriptor
    ? `${descriptor.version ?? 'v0'}:${descriptor.blocks.map((b) => b.id).join(',')}`
    : 'no-descriptor';
  const contextHash = JSON.stringify(caseContext);
  const targetsHash = targets
    .map((target) => `${target.id}:${target.ruleFingerprint}`)
    .sort()
    .join('|');
  return `${descriptorIdentity}::${contextHash}::${targetsHash}`;
}

export function diffValidationTargets(
  previous: ValidationTarget[],
  next: ValidationTarget[]
): { newlyVisible: string[]; newlyHidden: string[] } {
  const previousIds = new Set(previous.map((target) => target.id));
  const nextIds = new Set(next.map((target) => target.id));

  const newlyVisible = [...nextIds].filter((id) => !previousIds.has(id));
  const newlyHidden = [...previousIds].filter((id) => !nextIds.has(id));

  return { newlyVisible, newlyHidden };
}

/**
 * Flat list of active validation target ids (for submit orchestrator).
 */
export function getActiveValidationTargetIds(
  descriptor: GlobalFormDescriptor,
  formValues: Partial<FormData>,
  scope: ValidationScope = 'main',
  caseContext: CaseContext = {}
): string[] {
  const context = buildFormContextFromValues(formValues, caseContext);
  return collectValidationTargets(descriptor, context, scope).map((target) => target.id);
}
