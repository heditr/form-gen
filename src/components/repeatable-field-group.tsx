/**
 * RepeatableFieldGroup Component
 * 
 * Renders a repeatable field group with add/remove functionality using react-hook-form's useFieldArray.
 * Each instance in the group contains all fields with the same repeatableGroupId.
 */

import { useFieldArray } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import FieldWrapper from './field-wrapper';
import { evaluateHiddenStatus, evaluateDisabledStatus } from '@/utils/template-evaluator';
import { evaluateDefaultValue } from '@/utils/default-value-evaluator';
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

  // Build default values for a new instance from field descriptors
  const getDefaultInstanceValues = (): Record<string, unknown> => {
    const defaultInstance: Record<string, unknown> = {};
    
    for (const field of fields) {
      // Skip button fields - they don't have values
      if (field.type === 'button') {
        continue;
      }
      
      if (field.defaultValue !== undefined) {
        // Evaluate defaultValue as Handlebars template if it's a string, otherwise use directly
        const evaluatedValue = evaluateDefaultValue(
          field.defaultValue,
          field.type,
          formContext
        );
        defaultInstance[field.id] = evaluatedValue;
      } else {
        // Set type-appropriate default values for fields without explicit defaultValue
        switch (field.type) {
          case 'text':
          case 'dropdown':
          case 'autocomplete':
          case 'date':
            defaultInstance[field.id] = '';
            break;
          case 'checkbox':
            defaultInstance[field.id] = false;
            break;
          case 'radio':
            defaultInstance[field.id] = '';
            break;
          case 'number':
            defaultInstance[field.id] = 0;
            break;
          case 'file':
            defaultInstance[field.id] = null;
            break;
          default:
            defaultInstance[field.id] = '';
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
              const instanceFormContext: FormContext = {
                ...formContext,
                // Add current instance data to context for template evaluation
                [groupId]: groupArray,
                // Add current instance values directly for easy access (e.g., {{street}})
                ...(currentInstance || {}),
                // Add @index helper for accessing current index in templates
                '@index': index,
                // Add @first and @last helpers for convenience
                '@first': index === 0,
                '@last': index === (groupArray?.length ?? 0) - 1,
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
                  {fields.map((field) => {
                    // Extract original field ID by removing the groupId prefix if present
                    // Field IDs are prefixed during block resolution (e.g., "addresses.street")
                    // We need the base field ID (e.g., "street") for the indexed name
                    const baseFieldId = field.id.startsWith(`${groupId}.`)
                      ? field.id.slice(groupId.length + 1) // Remove "groupId." prefix
                      : field.id;
                    
                    // Create indexed field name for react-hook-form (e.g., addresses.0.street)
                    const indexedFieldName = `${groupId}.${index}.${baseFieldId}`;
                    
                    // Create a modified field descriptor with indexed name
                    const indexedField: FieldDescriptor = {
                      ...field,
                      id: indexedFieldName,
                    };

                    // Evaluate field visibility and disabled status
                    const fieldHidden = evaluateHiddenStatus(field, instanceFormContext);
                    const fieldDisabled = evaluateDisabledStatus(field, instanceFormContext) || isDisabled;

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
                      />
                    );
                  })}
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
