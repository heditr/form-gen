/**
 * RepeatableChildGroup Component
 *
 * The child list of one root row of an inline repeatable block: an indented,
 * labelled fieldset with its own useFieldArray, Add and Remove controls, and
 * per-list limits. Child rows reuse the group's fields and never hold a further
 * child list, so this component receives the child config but passes none down.
 *
 * Mount it only when the list already exists: useFieldArray writes `[]` into the
 * form values for an absent key. The root row creates the first child row itself.
 */

import { get, useFieldArray } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor, RepeatableChildConfig } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import RepeatableRowFields from './repeatable-row-fields';
import { buildNewRowValues, buildRowContext, childArrayPath, childRowPath } from '@/utils/repeatable-child';
import { useInvalidateQueriesForBlock, useFlushDraftSave } from './popin-manager';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

export interface RepeatableChildGroupProps {
  block: BlockDescriptor;
  groupId: string;
  fields: FieldDescriptor[];
  config: RepeatableChildConfig;
  rootIndex: number;
  /** Watched rows of the root list, exposed to child row templates under the group key. */
  rootRows: unknown[] | undefined;
  isDisabled: boolean;
  isReadonly?: boolean;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  onLoadDataSource: (
    fieldPath: string,
    url: string,
    auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }
  ) => void;
  dataSourceCache: Record<string, unknown>;
}

export default function RepeatableChildGroup({
  block,
  groupId,
  fields,
  config,
  rootIndex,
  rootRows,
  isDisabled,
  isReadonly = false,
  form,
  formContext,
  onLoadDataSource,
  dataSourceCache,
}: RepeatableChildGroupProps) {
  const arrayPath = childArrayPath({ groupId, rootIndex, property: config.property });
  const { fields: childFields, append, remove } = useFieldArray({ control: form.control, name: arrayPath });
  const flushDraftSave = useFlushDraftSave();
  const invalidateQueriesForBlock = useInvalidateQueriesForBlock();

  const rootRow = rootRows?.[rootIndex] as Record<string, unknown> | undefined;
  const childRows = rootRow?.[config.property] as unknown[] | undefined;
  const rootName = (block.title || 'row').toLowerCase();
  const childName = config.title.toLowerCase();
  const listError = get(form.formState.errors, arrayPath)?.message as string | undefined;

  const canAdd = config.maxInstances === undefined || childFields.length < config.maxInstances;
  const canRemove = config.minInstances === undefined || childFields.length > config.minInstances;

  const handleAdd = () => append(buildNewRowValues({ fields, groupId, formContext }));

  const handleRemove = async (childIndex: number) => {
    remove(childIndex);
    await flushDraftSave();
    await invalidateQueriesForBlock(block.id);
  };

  return (
    <fieldset
      data-testid={`repeatable-child-group-${groupId}-${rootIndex}`}
      className="repeatable-child-group ml-6 border-l-2 pl-4 space-y-3"
    >
      <legend className="text-sm font-medium px-1">
        {`${config.title}s of ${block.title || 'row'} ${rootIndex + 1}`}
      </legend>
      {listError && (
        <div
          className="text-sm text-destructive p-3 bg-destructive/10 border border-destructive/20 rounded-md"
          role="alert"
          data-testid={`repeatable-child-error-${groupId}-${rootIndex}`}
        >
          {listError}
        </div>
      )}
      {childFields.map((childField, childIndex) => (
        <div
          key={childField.id}
          data-testid={`repeatable-child-instance-${groupId}-${rootIndex}-${childIndex}`}
          className="repeatable-child-instance border rounded-lg p-3 space-y-3"
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              {`${config.title} ${childIndex + 1} of ${rootName} ${rootIndex + 1}`}
            </h4>
            <Button
              type="button"
              onClick={() => handleRemove(childIndex)}
              disabled={isDisabled || !canRemove}
              variant="outline"
              size="sm"
              aria-label={`Remove ${childName} ${childIndex + 1} of ${rootName} ${rootIndex + 1}`}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
          <RepeatableRowFields
            block={block}
            groupId={groupId}
            fields={fields}
            rowPath={childRowPath({ groupId, rootIndex, property: config.property, childIndex })}
            rowContext={buildRowContext({
              formContext,
              groupId,
              rows: childRows,
              groupRows: rootRows,
              index: childIndex,
              depth: 2,
              parentIndex: rootIndex,
            })}
            isDisabled={isDisabled}
            isReadonly={isReadonly}
            form={form}
            onLoadDataSource={onLoadDataSource}
            dataSourceCache={dataSourceCache}
          />
        </div>
      ))}
      <div className="flex justify-start">
        <Button
          type="button"
          onClick={handleAdd}
          disabled={isDisabled || !canAdd}
          variant="outline"
          data-testid={`repeatable-child-add-${groupId}-${rootIndex}`}
        >
          <Plus className="h-4 w-4 mr-2" />
          {config.addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
