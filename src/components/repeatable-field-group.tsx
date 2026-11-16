/**
 * RepeatableFieldGroup Component
 * 
 * Renders a repeatable field group with add/remove functionality using react-hook-form's useFieldArray.
 * Each instance in the group contains all fields with the same repeatableGroupId.
 */

import { useEffect, useRef } from 'react';
import { useFieldArray } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor, FormData, GlobalFormDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import {
  evaluateDisabledStatus,
  evaluateHiddenStatus,
  evaluateReadonlyStatus,
} from '@/utils/template-evaluator';
import { buildAutoFillPatchFromSelection, getNestedValue } from '@/utils/form-descriptor-integration';
import { clearHiddenAutoFillHoldsForSource, setHiddenAutoFillHold } from '@/utils/auto-fill-hidden-hold';
import { buildBlockLayoutRows } from '@/utils/block-layout';
import { cn } from '@/lib/utils';
import RepeatableRowFields from './repeatable-row-fields';
import RepeatableChildGroup from './repeatable-child-group';
import FieldWrapper from './field-wrapper';
import {
  buildNewRowValues,
  buildRowContext,
  childArrayPath,
  childRowPath,
  rowOpensChild,
} from '@/utils/repeatable-child';
import { useRepeatableChildClear } from '@/hooks/use-repeatable-child-clear';
import { useInvalidateQueriesForBlock, useFlushDraftSave } from './popin-manager';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

export interface RepeatableFieldGroupProps {
  block: BlockDescriptor;
  groupId: string;
  fields: FieldDescriptor[];
  isDisabled: boolean;
  isHidden: boolean;
  isReadonly?: boolean;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
}

/**
 * RepeatableFieldGroup Component
 * 
 * Renders a repeatable field group with add/remove functionality.
 * Uses useFieldArray from react-hook-form to manage array of field instances.
 */
export default function RepeatableFieldGroup({
  block,
  groupId,
  fields,
  isDisabled,
  isHidden,
  isReadonly = false,
  form,
  formContext,
  onLoadDataSource,
  dataSourceCache,
}: RepeatableFieldGroupProps) {
  // Initialize useFieldArray for this repeatable group
  // Must be called before any conditional returns (React Hook rules)
  const { fields: fieldArrayFields, append, remove } = useFieldArray({
    control: form.control,
    name: groupId,
  });
  const groupArray = form.watch(groupId) as unknown[] | undefined;
  const invalidateQueriesForBlock = useInvalidateQueriesForBlock();
  const flushDraftSave = useFlushDraftSave();

  const childConfig = block.repeatableChild;
  const rowFields = fields.filter((field) => field.repeatOnce !== true);
  const groupedAt = block.fields.flatMap((field, index) => (field.repeatableGroupId ? [index] : []));
  const firstGrouped = groupedAt[0] ?? block.fields.length;
  const lastGrouped = groupedAt.length > 0 ? groupedAt[groupedAt.length - 1] : -1;
  const leadingOnce = block.fields.slice(0, firstGrouped).filter((field) => field.repeatOnce === true);
  const trailingOnce =
    lastGrouped < 0 ? [] : block.fields.slice(lastGrouped + 1).filter((field) => field.repeatOnce === true);
  const onceFields = [...leadingOnce, ...trailingOnce];
  const baseFieldIdOf = (field: FieldDescriptor) =>
    field.id.startsWith(`${groupId}.`) ? field.id.slice(groupId.length + 1) : field.id;

  const handleOnceAutoFill = (
    selectionFieldId: string,
    selectedPayload: Record<string, unknown> | null
  ) => {
    if (!selectedPayload) {
      clearHiddenAutoFillHoldsForSource(form, selectionFieldId);
      return;
    }

    const descriptorForOnce: GlobalFormDescriptor = {
      blocks: [{ ...block, fields: onceFields }],
      submission: { url: '', method: 'POST' },
    };
    const hiddenFieldIds = onceFields
      .filter((field) => evaluateHiddenStatus(field, formContext))
      .map((field) => field.id);
    const disabledFieldIds = onceFields
      .filter((field) => evaluateDisabledStatus(field, formContext) || isDisabled)
      .map((field) => field.id);
    const { patch, deferredPatch } = buildAutoFillPatchFromSelection({
      descriptor: descriptorForOnce,
      selectionFieldId,
      selectedPayload,
      currentValues: form.getValues() as Partial<FormData>,
      hiddenFieldIds,
      disabledFieldIds,
    });

    for (const [key, value] of Object.entries(patch)) {
      form.setValue(key, value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }

    clearHiddenAutoFillHoldsForSource(form, selectionFieldId);
    const sourceValue = form.getValues(selectionFieldId as never);
    for (const fieldId of hiddenFieldIds) {
      const value = getNestedValue(deferredPatch as Record<string, unknown>, fieldId);
      if (value === undefined) {
        continue;
      }
      setHiddenAutoFillHold(form, fieldId, {
        sourceFieldId: selectionFieldId,
        sourceValue,
        value,
      });
    }
  };

  const renderOnceField = (field: FieldDescriptor) => (
    <FieldWrapper
      key={field.id}
      field={field}
      isDisabled={evaluateDisabledStatus(field, formContext) || isDisabled}
      isHidden={evaluateHiddenStatus(field, formContext)}
      isReadonly={evaluateReadonlyStatus(field, formContext) || isReadonly}
      form={form}
      formContext={formContext}
      onLoadDataSource={onLoadDataSource}
      dataSourceCache={dataSourceCache}
      onAutoFillSelection={handleOnceAutoFill}
    />
  );

  const renderOnceBand = (bandFields: FieldDescriptor[], band: 'leading' | 'trailing') => {
    if (bandFields.length === 0) {
      return null;
    }
    const layoutRows = buildBlockLayoutRows(block, bandFields);
    const grid = (block.layout?.mode ?? 'default') === 'grid';
    const columns = block.layout?.columns ?? 1;
    const gap = block.layout?.gap ?? 'md';
    const gapYClass = gap === 'sm' ? 'gap-y-2' : gap === 'lg' ? 'gap-y-6' : 'gap-y-4';
    const gridColsClass =
      columns === 1 ? 'md:grid-cols-1' : columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

    return (
      <div data-testid={`repeat-once-${band}-${groupId}`} className="repeat-once-fields space-y-4">
        {layoutRows.map((layoutRow, rowIndex) => {
          const rowGridColsClass =
            layoutRow.gridColumns === 1
              ? 'md:grid-cols-1'
              : layoutRow.gridColumns === 2
                ? 'md:grid-cols-2'
                : layoutRow.gridColumns === 3
                  ? 'md:grid-cols-3'
                  : gridColsClass;
          return (
            <div
              key={`${band}-${rowIndex}`}
              className={grid ? cn('grid grid-cols-1', rowGridColsClass, 'gap-x-4', gapYClass) : undefined}
            >
              {layoutRow.slots.map((slot, slotIndex) => (
                <div
                  key={`${band}-slot-${slotIndex}`}
                  className={slot.colSpan ? `col-span-${slot.colSpan}` : undefined}
                >
                  {slot.fields.map(renderOnceField)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };
  const triggerLabel = (
    rowFields.find((field) => childConfig && baseFieldIdOf(field) === childConfig.triggerField)?.label ?? ''
  ).toLowerCase();
  const childAnnouncement = childConfig
    ? `${childConfig.title}s removed because the ${triggerLabel} changed`
    : '';
  const childAnnouncementText = useRepeatableChildClear({
    form,
    groupId,
    config: childConfig,
    announcement: childAnnouncement,
    flushDraftSave,
  });

  // Path of the child field to focus after the first child row is created
  const pendingFocus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (pendingFocus.current) {
      form.setFocus(pendingFocus.current);
      pendingFocus.current = undefined;
    }
  });

  // The first child row creates the list; later rows are added by RepeatableChildGroup
  const handleCreateChildList = (rootIndex: number) => {
    if (!childConfig) {
      return;
    }
    const path = childArrayPath({ groupId, rootIndex, property: childConfig.property });
    form.setValue(path, [buildNewRowValues({ fields: rowFields, groupId, formContext })], { shouldDirty: true });
    const firstField = rowFields.find((field) => field.type !== 'button');
    if (firstField) {
      pendingFocus.current = `${childRowPath({
        groupId,
        rootIndex,
        property: childConfig.property,
        childIndex: 0,
      })}.${baseFieldIdOf(firstField)}`;
    }
  };

  // Handle adding a new instance
  const handleAdd = () => {
    append(buildNewRowValues({ fields: rowFields, groupId, formContext }));
  };

  // Handle removing an instance
  const handleRemove = async (index: number) => {
    remove(index);
    await flushDraftSave();
    await invalidateQueriesForBlock(block.id);
  };

  // Check if remove should be disabled (at minInstances)
  const canRemove = (): boolean => {
    if (block.minInstances === undefined) {
      return true; // No minimum, can always remove
    }
    return fieldArrayFields.length > block.minInstances;
  };

  // Don't render if hidden
  if (isHidden) {
    return null;
  }

  return (
    <div
      data-testid={`repeatable-field-group-${groupId}`}
      className="repeatable-field-group"
    >
      {block.title && (
        <h2 className="repeatable-group-title text-xl font-semibold mb-2">
          {block.title}
        </h2>
      )}
      {block.description && (
        <p className="repeatable-group-description text-sm text-muted-foreground mb-4">
          {block.description}
        </p>
      )}
      {/* Display array-level validation errors */}
      {(() => {
        const arrayError = form.formState.errors[groupId];
        const arrayErrorMessage = arrayError?.message as string | undefined;
        if (arrayErrorMessage) {
          return (
            <div
              className="text-sm text-destructive mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              role="alert"
              data-testid={`repeatable-group-error-${groupId}`}
            >
              {arrayErrorMessage}
            </div>
          );
        }
        return null;
      })()}
      {renderOnceBand(leadingOnce, 'leading')}
      <div className="repeatable-group-instances space-y-4">
        {fieldArrayFields.length === 0 ? (
          // Empty state
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-4">No instances yet. Click &ldquo;Add&rdquo; to create one.</p>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={isDisabled}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {block.title || 'Instance'}
            </Button>
          </div>
        ) : (
          <>
            {fieldArrayFields.map((fieldArrayField, index) => {
              const rowContext = buildRowContext({
                formContext,
                groupId,
                rows: groupArray,
                index,
                ...(block.repeatableChild ? { depth: 1 } : {}),
              });

              return (
                <div
                  key={fieldArrayField.id}
                  data-testid={`repeatable-instance-${groupId}-${index}`}
                  className="repeatable-instance border rounded-lg p-4 space-y-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {block.title || 'Instance'} {index + 1}
                    </h3>
                    <Button
                      type="button"
                      onClick={() => handleRemove(index)}
                      disabled={isDisabled || !canRemove()}
                      variant="outline"
                      size="sm"
                      aria-label={`Remove ${block.title || 'instance'} ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                  <RepeatableRowFields
                    block={block}
                    groupId={groupId}
                    fields={rowFields}
                    rowPath={`${groupId}.${index}`}
                    rowContext={rowContext}
                    isDisabled={isDisabled}
                    isReadonly={isReadonly}
                    form={form}
                    onLoadDataSource={onLoadDataSource}
                    dataSourceCache={dataSourceCache}
                  />
                  {childConfig &&
                    groupArray?.[index] &&
                    rowOpensChild(groupArray[index] as Record<string, unknown>, block, rowContext) &&
                    (Array.isArray((groupArray[index] as Record<string, unknown>)[childConfig.property]) ? (
                      <RepeatableChildGroup
                        block={block}
                        groupId={groupId}
                        fields={rowFields}
                        config={childConfig}
                        rootIndex={index}
                        rootRows={groupArray}
                        isDisabled={isDisabled}
                        isReadonly={isReadonly}
                        form={form}
                        formContext={formContext}
                        onLoadDataSource={onLoadDataSource}
                        dataSourceCache={dataSourceCache}
                      />
                    ) : (
                      <div className="flex justify-start">
                        <Button
                          type="button"
                          onClick={() => handleCreateChildList(index)}
                          disabled={isDisabled}
                          variant="outline"
                          data-testid={`repeatable-child-add-${groupId}-${index}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {childConfig.addLabel}
                        </Button>
                      </div>
                    ))}
                </div>
              );
            })}
            {/* Add button for adding more instances */}
            <div className="flex justify-start">
              <Button
                type="button"
                onClick={handleAdd}
                disabled={isDisabled || (block.maxInstances !== undefined && fieldArrayFields.length >= block.maxInstances)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {block.title || 'Instance'}
              </Button>
            </div>
          </>
        )}
      </div>
      {renderOnceBand(trailingOnce, 'trailing')}
      {childConfig && (
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
          data-testid={`repeatable-child-announcer-${groupId}`}
        >
          {childAnnouncementText}
        </div>
      )}
    </div>
  );
}
