/**
 * Resolve hidden, disabled, and readonly for one field.
 * Context mode reads the form status map. Local mode evaluates templates.
 */

import type { FieldDescriptor } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';
import {
  evaluateDisabledStatus,
  evaluateHiddenStatus,
  evaluateReadonlyStatus,
} from './template-evaluator';

export type StatusMode = 'context' | 'local';

export interface ResolvedFieldStatus {
  hidden: boolean;
  disabled: boolean;
  readonly: boolean;
}

export interface FieldStatusSource {
  getFieldStatus: (fieldId: string) => ResolvedFieldStatus;
}

export function resolveFieldStatus({
  field,
  formContext,
  statusContext = null,
  statusMode = 'local',
  blockDisabled = false,
  blockReadonly = false,
}: {
  field: FieldDescriptor;
  formContext: FormContext;
  statusContext?: FieldStatusSource | null;
  statusMode?: StatusMode;
  blockDisabled?: boolean;
  blockReadonly?: boolean;
}): ResolvedFieldStatus {
  const ownStatus =
    statusMode === 'context' && statusContext
      ? statusContext.getFieldStatus(field.id)
      : {
          hidden: evaluateHiddenStatus(field, formContext),
          disabled: evaluateDisabledStatus(field, formContext),
          readonly: evaluateReadonlyStatus(field, formContext),
        };

  return {
    hidden: ownStatus.hidden,
    disabled: ownStatus.disabled || blockDisabled,
    readonly: ownStatus.readonly || blockReadonly,
  };
}
