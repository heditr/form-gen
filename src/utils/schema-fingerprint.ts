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
