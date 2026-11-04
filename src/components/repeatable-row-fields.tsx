/**
 * RepeatableRowFields Component
 *
 * Renders the fields of one repeatable row at any form path: a root row
 * (`addresses.0`) or a child row (`businessSectors.0.subsectors.1`).
 * Owns the per-row field rendering, grid layout, row-template status
 * evaluation, and selection autoFill handling.
 */

import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type {
  BlockDescriptor,
  FieldDescriptor,
  FormData,
  GlobalFormDescriptor,
} from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import FieldWrapper from './field-wrapper';
import {
  evaluateHiddenStatus,
  evaluateDisabledStatus,
  evaluateReadonlyStatus,
} from '@/utils/template-evaluator';
import { buildAutoFillPatchFromSelection } from '@/utils/form-descriptor-integration';
import {
  clearRepeatableAutoFillHold,
  getRepeatableAutoFillHold,
  setRepeatableAutoFillHold,
} from '@/utils/auto-fill-hidden-hold';
import { buildBlockLayoutRows } from '@/utils/block-layout';
import { withRepeatableMeta } from '@/utils/repeatable-child';
import { cn } from '@/lib/utils';

export interface RepeatableRowFieldsProps {
  block: BlockDescriptor;
  groupId: string;
  fields: FieldDescriptor[];
  /** Form path of the row, for example `addresses.0` or `businessSectors.0.subsectors.1`. */
  rowPath: string;
  /** Template context of the row (row values plus index, first, last, and optional depth). */
  rowContext: FormContext;
  isDisabled: boolean;
  isReadonly?: boolean;
  form: UseFormReturn<FieldValues>;
  onLoadDataSource: (
    fieldPath: string,
    url: string,
    auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }
  ) => void;
  dataSourceCache: Record<string, unknown>;
}

const baseFieldIdOf = (field: FieldDescriptor, groupId: string): string =>
  field.id.startsWith(`${groupId}.`) ? field.id.slice(groupId.length + 1) : field.id;

const withStatusMeta = (field: FieldDescriptor): FieldDescriptor =>
  field.status
    ? {
        ...field,
        status: {
          ...field.status,
          hidden: withRepeatableMeta(field.status.hidden),
          disabled: withRepeatableMeta(field.status.disabled),
          readonly: withRepeatableMeta(field.status.readonly),
        },
      }
    : field;

export default function RepeatableRowFields({
  block,
  groupId,
  fields,
  rowPath,
  rowContext,
  isDisabled,
  isReadonly = false,
  form,
  onLoadDataSource,
  dataSourceCache,
}: RepeatableRowFieldsProps) {
  const handleSelectionAutoFill = (
    selectionFieldId: string,
    selectedPayload: Record<string, unknown> | null
  ) => {
    const basePrefix = `${rowPath}.`;
    if (!selectedPayload) {
      const hold = getRepeatableAutoFillHold(form, selectionFieldId);
      if (hold) {
        const row = (form.getValues(rowPath as never) ?? {}) as Record<string, unknown>;
        for (const [key, heldValue] of Object.entries(hold.values)) {
          if (row[key] === heldValue) {
            form.setValue(`${rowPath}.${key}`, '', {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }
        }
        clearRepeatableAutoFillHold(form, selectionFieldId);
      }
      return;
    }

    const selectionBaseId = selectionFieldId.startsWith(basePrefix)
      ? selectionFieldId.slice(basePrefix.length)
      : selectionFieldId;

    const descriptorForGroup: GlobalFormDescriptor = {
      version: 'auto-fill-group',
      blocks: [
        {
          ...block,
          fields: fields.map((field) => ({ ...field, id: baseFieldIdOf(field, groupId) })),
        },
      ],
      submission: {
        url: '',
        method: 'POST',
      },
    };

    const hiddenFieldIds: string[] = [];
    const disabledFieldIds: string[] = [];

    for (const field of fields) {
      const fieldWithMeta = withStatusMeta(field);
      if (evaluateHiddenStatus(fieldWithMeta, rowContext)) {
        hiddenFieldIds.push(baseFieldIdOf(field, groupId));
      }
      if (evaluateDisabledStatus(fieldWithMeta, rowContext) || isDisabled) {
        disabledFieldIds.push(baseFieldIdOf(field, groupId));
      }
    }

    const currentValuesForRow = (form.getValues(rowPath as never) ?? {}) as Partial<FormData>;

    const { patch, deferredPatch } = buildAutoFillPatchFromSelection({
      descriptor: descriptorForGroup,
      selectionFieldId: selectionBaseId,
      selectedPayload,
      currentValues: currentValuesForRow,
      hiddenFieldIds,
      disabledFieldIds,
    });

    const written: Record<string, unknown> = {};
    for (const source of [patch, deferredPatch]) {
      for (const [key, value] of Object.entries(source)) {
        form.setValue(`${rowPath}.${key}`, value, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        written[key] = value;
      }
    }
    setRepeatableAutoFillHold(form, selectionFieldId, {
      sourceValue: form.getValues(selectionFieldId as never),
      values: written,
    });
  };

  const renderField = (field: FieldDescriptor) => {
    const indexedFieldName = `${rowPath}.${baseFieldIdOf(field, groupId)}`;
    const indexedField: FieldDescriptor = { ...field, id: indexedFieldName };
    const fieldWithMeta = withStatusMeta(field);

    return (
      <FieldWrapper
        key={indexedFieldName}
        field={indexedField}
        isDisabled={evaluateDisabledStatus(fieldWithMeta, rowContext) || isDisabled}
        isHidden={evaluateHiddenStatus(fieldWithMeta, rowContext)}
        isReadonly={evaluateReadonlyStatus(fieldWithMeta, rowContext) || isReadonly}
        form={form}
        formContext={rowContext}
        onLoadDataSource={onLoadDataSource}
        dataSourceCache={dataSourceCache}
        onAutoFillSelection={handleSelectionAutoFill}
      />
    );
  };

  if ((block.layout?.mode ?? 'default') !== 'grid') {
    return <>{fields.map(renderField)}</>;
  }

  const rows = buildBlockLayoutRows(block, fields);
  const columns = block.layout?.columns ?? 1;
  const gap = block.layout?.gap ?? 'md';
  const gapYClass = gap === 'sm' ? 'gap-y-2' : gap === 'lg' ? 'gap-y-6' : 'gap-y-4';
  const gridColsClass =
    columns === 1 ? 'md:grid-cols-1' : columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  return (
    <>
      {rows.map((row, rowIndex) => {
        const rowGridColsClass =
          row.gridColumns === 1
            ? 'md:grid-cols-1'
            : row.gridColumns === 2
            ? 'md:grid-cols-2'
            : row.gridColumns === 3
            ? 'md:grid-cols-3'
            : gridColsClass;

        return (
          <div
            key={`row-${rowIndex}`}
            className={cn('grid grid-cols-1', rowGridColsClass, 'gap-x-4', gapYClass)}
          >
            {row.slots.map((slot, slotIndex) => (
              <div
                key={`slot-${slotIndex}`}
                className={slot.colSpan ? `col-span-${slot.colSpan}` : undefined}
              >
                {slot.fields.map(renderField)}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
