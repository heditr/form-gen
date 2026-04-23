/**
 * RepeatableFieldGroup Component
 * 
 * Renders a repeatable field group with add/remove functionality using react-hook-form's useFieldArray.
 * Each instance in the group contains all fields with the same repeatableGroupId.
 */

import { useFieldArray } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor, GlobalFormDescriptor, FormData } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import FieldWrapper from './field-wrapper';
import { evaluateHiddenStatus, evaluateDisabledStatus } from '@/utils/template-evaluator';
import { evaluateDefaultValue } from '@/utils/default-value-evaluator';
import { buildAutoFillPatchFromSelection } from '@/utils/form-descriptor-integration';
import { buildBlockLayoutRows } from '@/utils/block-layout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

export interface RepeatableFieldGroupProps {
  block: BlockDescriptor;
  groupId: string;
  fields: FieldDescriptor[];
  isDisabled: boolean;
  isHidden: boolean;
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

  // Build default values for a new instance using base field id (no groupId prefix)
  const getDefaultInstanceValues = (): Record<string, unknown> => {
    const defaultInstance: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === 'button') {
        continue;
      }
      const baseFieldId = field.id.startsWith(`${groupId}.`)
        ? field.id.slice(groupId.length + 1)
        : field.id;
      if (field.defaultValue !== undefined) {
        const evaluatedValue = evaluateDefaultValue(
          field.defaultValue,
          field.type,
          formContext
        );
        defaultInstance[baseFieldId] = evaluatedValue;
      } else {
        switch (field.type) {
          case 'text':
          case 'dropdown':
          case 'autocomplete':
          case 'date':
            defaultInstance[baseFieldId] = '';
            break;
          case 'checkbox':
            defaultInstance[baseFieldId] = false;
            break;
          case 'radio':
            defaultInstance[baseFieldId] = '';
            break;
          case 'number':
            defaultInstance[baseFieldId] = 0;
            break;
          case 'file':
            defaultInstance[baseFieldId] = null;
            break;
          default:
            defaultInstance[baseFieldId] = '';
        }
      }
    }
    return defaultInstance;
  };

  // Handle adding a new instance
  const handleAdd = () => {
    const defaultValues = getDefaultInstanceValues();
    append(defaultValues);
  };

  // Handle removing an instance
  const handleRemove = (index: number) => {
    remove(index);
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
              // Get current instance values from form
              const groupArray = form.watch(groupId) as unknown[] | undefined;
              const currentInstance = groupArray?.[index] as Record<string, unknown> | undefined;
              
              // Build instance-specific form context for template evaluation
              // This allows templates to reference current instance data and index
              const first = index === 0;
              const last = index === (groupArray?.length ?? 0) - 1;

              const instanceFormContext: FormContext = {
                ...formContext,
                // Add current instance data to context for template evaluation
                [groupId]: groupArray,
                // Add current instance values directly for easy access (e.g., {{street}})
                ...(currentInstance || {}),
                // Repeatable meta: use non-@ keys for Handlebars compatibility
                // (Handlebars `@index/@first/@last` are data vars, not normal context vars)
                index,
                first,
                last,
              };

              const withRepeatableMeta = (template: string | undefined): string | undefined =>
                template
                  ? template
                      .replaceAll('@index', 'index')
                      .replaceAll('@first', 'first')
                      .replaceAll('@last', 'last')
                  : template;

              const handleInstanceAutoFillSelection = (
                selectionFieldId: string,
                selectedPayload: Record<string, unknown>
              ) => {
                if (!selectedPayload) {
                  return;
                }

                const basePrefix = `${groupId}.${index}.`;
                const selectionBaseId = selectionFieldId.startsWith(basePrefix)
                  ? selectionFieldId.slice(basePrefix.length)
                  : selectionFieldId;

                const groupFieldsWithBaseIds: FieldDescriptor[] = fields.map((f) => {
                  const baseId = f.id.startsWith(`${groupId}.`)
                    ? f.id.slice(groupId.length + 1)
                    : f.id;
                  return {
                    ...f,
                    id: baseId,
                  };
                });

                const descriptorForGroup: GlobalFormDescriptor = {
                  version: 'auto-fill-group',
                  blocks: [
                    {
                      ...block,
                      fields: groupFieldsWithBaseIds,
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
                  const baseFieldId = field.id.startsWith(`${groupId}.`)
                    ? field.id.slice(groupId.length + 1)
                    : field.id;
                  const fieldWithMeta = field.status
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

                  const fieldHidden = evaluateHiddenStatus(fieldWithMeta, instanceFormContext);
                  const fieldDisabled = evaluateDisabledStatus(fieldWithMeta, instanceFormContext) || isDisabled;
                  if (fieldHidden) {
                    hiddenFieldIds.push(baseFieldId);
                  }
                  if (fieldDisabled) {
                    disabledFieldIds.push(baseFieldId);
                  }
                }

                const currentValuesForInstance = (currentInstance || {}) as Partial<FormData>;

                const patch = buildAutoFillPatchFromSelection({
                  descriptor: descriptorForGroup,
                  selectionFieldId: selectionBaseId,
                  selectedPayload,
                  currentValues: currentValuesForInstance,
                  hiddenFieldIds,
                  disabledFieldIds,
                });

                for (const [key, value] of Object.entries(patch)) {
                  const targetPath = `${groupId}.${index}.${key}`;
                  form.setValue(targetPath, value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }
              };

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
                  {(() => {
                    const layoutMode = block.layout?.mode ?? 'default';

                    const renderField = (field: FieldDescriptor) => {
                      const baseFieldId = field.id.startsWith(`${groupId}.`)
                        ? field.id.slice(groupId.length + 1)
                        : field.id;
                      const indexedFieldName = `${groupId}.${index}.${baseFieldId}`;
                      const indexedField: FieldDescriptor = { ...field, id: indexedFieldName };

                      const fieldWithMeta = field.status
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

                      const fieldHidden = evaluateHiddenStatus(fieldWithMeta, instanceFormContext);
                      const fieldDisabled = evaluateDisabledStatus(fieldWithMeta, instanceFormContext) || isDisabled;

                      return (
                        <FieldWrapper
                          key={indexedFieldName}
                          field={indexedField}
                          isDisabled={fieldDisabled}
                          isHidden={fieldHidden}
                          form={form}
                          formContext={instanceFormContext}
                          onLoadDataSource={onLoadDataSource}
                          dataSourceCache={dataSourceCache}
                          onAutoFillSelection={handleInstanceAutoFillSelection}
                        />
                      );
                    };

                    if (layoutMode !== 'grid') {
                      return fields.map(renderField);
                    }

                    const rows = buildBlockLayoutRows(block, fields);
                    const columns = block.layout?.columns ?? 1;
                    const gap = block.layout?.gap ?? 'md';
                    const gapYClass =
                      gap === 'sm' ? 'gap-y-2' : gap === 'lg' ? 'gap-y-6' : 'gap-y-4';
                    const gridColsClass =
                      columns === 1
                        ? 'md:grid-cols-1'
                        : columns === 2
                        ? 'md:grid-cols-2'
                        : 'md:grid-cols-3';

                    return rows.map((row, rowIndex) => {
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
                    });
                  })()}
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
    </div>
  );
}
