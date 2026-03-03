/**
 * RepeatablePopinSummary Component
 *
 * Renders clickable summary rows for each repeatable instance.
 * Clicking a summary opens a popin to add or edit that instance.
 */

import { useFieldArray } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { evaluateTemplate } from '@/utils/template-evaluator';
import { evaluateDefaultValue } from '@/utils/default-value-evaluator';
import { usePopinManager } from './popin-manager';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RepeatablePopinSummaryProps {
  block: BlockDescriptor;
  groupId: string;
  fields: FieldDescriptor[];
  isDisabled: boolean;
  isHidden: boolean;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
}

/**
 * Renders summaries for repeatable instances; each summary opens a popin to edit.
 */
export default function RepeatablePopinSummary({
  block,
  groupId,
  fields,
  isDisabled,
  isHidden,
  form,
  formContext,
}: RepeatablePopinSummaryProps) {
  const { openPopin } = usePopinManager();
  const { fields: fieldArrayFields, append, remove } = useFieldArray({
    control: form.control,
    name: groupId,
  });

  const getDefaultInstanceValues = (): Record<string, unknown> => {
    const defaultInstance: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === 'button') continue;
      const baseFieldId = field.id.startsWith(`${groupId}.`)
        ? field.id.slice(groupId.length + 1)
        : field.id;
      if (field.defaultValue !== undefined) {
        defaultInstance[baseFieldId] = evaluateDefaultValue(field.defaultValue, field.type, formContext);
      } else {
        switch (field.type) {
          case 'text':
          case 'dropdown':
          case 'autocomplete':
          case 'date':
          case 'radio':
            defaultInstance[baseFieldId] = '';
            break;
          case 'checkbox':
            defaultInstance[baseFieldId] = false;
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

  const handleAdd = () => {
    // Append new instance and immediately open popin to edit it
    append(getDefaultInstanceValues());
    const groupArray = form.getValues()[groupId] as unknown[] | undefined;
    const newIndex = groupArray && groupArray.length > 0 ? groupArray.length - 1 : 0;
    openPopin(block.id, { groupId, index: newIndex });
  };

  const handleRemove = (index: number) => {
    remove(index);
  };

  const canRemove = (): boolean => {
    if (block.minInstances === undefined) return true;
    return fieldArrayFields.length > block.minInstances;
  };

  const handleSummaryClick = (index: number) => {
    if (isDisabled) return;
    openPopin(block.id, { groupId, index });
  };

  const getSummaryText = (index: number, currentInstance: Record<string, unknown> | undefined): string => {
    const instanceContext: FormContext = {
      ...formContext,
      [groupId]: form.watch(groupId),
      ...(currentInstance || {}),
      '@index': index,
      '@first': index === 0,
      '@last': index === (fieldArrayFields.length ?? 0) - 1,
    };

    const template = block.repeatableSummaryTemplate;
    if (template) {
      const result = evaluateTemplate(template, instanceContext);
      if (result.trim()) return result;
    }

    // Fallback: first non-empty field value or "Item N"
    if (currentInstance && typeof currentInstance === 'object') {
      const firstValue = Object.values(currentInstance).find(
        (v) => v !== undefined && v !== null && v !== '' && String(v).trim() !== ''
      );
      if (firstValue !== undefined) return String(firstValue);
    }

    return `Item ${index + 1}`;
  };

  if (isHidden) return null;

  const arrayError = form.formState.errors[groupId];
  const arrayErrorMessage = arrayError?.message as string | undefined;

  return (
    <div
      data-testid={`repeatable-popin-summary-${groupId}`}
      className="repeatable-popin-summary"
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
      {arrayErrorMessage && (
        <div
          className="text-sm text-destructive mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
          role="alert"
          data-testid={`repeatable-popin-summary-error-${groupId}`}
        >
          {arrayErrorMessage}
        </div>
      )}
      <div className="space-y-2">
        {fieldArrayFields.length === 0 ? (
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
              const groupArray = form.watch(groupId) as unknown[] | undefined;
              const currentInstance = groupArray?.[index] as Record<string, unknown> | undefined;
              const summaryText = getSummaryText(index, currentInstance);

              return (
                <div
                  key={fieldArrayField.id}
                  data-testid={`repeatable-popin-summary-item-${groupId}-${index}`}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors',
                    isDisabled
                      ? 'cursor-not-allowed opacity-60 bg-muted/50'
                      : 'cursor-pointer hover:bg-muted/50'
                  )}
                  role="button"
                  tabIndex={isDisabled ? -1 : 0}
                  onClick={() => handleSummaryClick(index)}
                  onKeyDown={(e) => {
                    if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleSummaryClick(index);
                    }
                  }}
                  aria-label={`Edit ${summaryText}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{summaryText}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDisabled || !canRemove()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                    aria-label={`Remove ${summaryText}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              onClick={handleAdd}
              disabled={isDisabled || (block.maxInstances !== undefined && fieldArrayFields.length >= block.maxInstances)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {block.title || 'Instance'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
