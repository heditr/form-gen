/**
 * RadioField Component
 * 
 * Renders a radio button group using react-hook-form with Shadcn UI styling.
 * Supports static items and dynamic data sources with loading states.
 */

import { useMemo } from 'react';
import { Controller } from 'react-hook-form';
import type { FieldDescriptor, FieldItem } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { useDataSource } from '@/hooks/use-form-query';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface RadioFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  isDisabled: boolean;
  onLoadDataSource?: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache?: Record<string, unknown>;
}

/**
 * RadioField Component
 * 
 * Renders radio buttons with label, description, and validation error display.
 * Uses Controller from react-hook-form.
 * Supports both static items and dynamic data sources.
 * Note: For discriminant fields, the watch() subscription in useFormDescriptor
 * will automatically sync changes to Redux and trigger re-hydration.
 */
export default function RadioField({
  field,
  form,
  formContext,
  isDisabled,
  onLoadDataSource,
  dataSourceCache = {},
}: RadioFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  // Use useDataSource hook - always call it (React hooks rule), but disable when no dataSource
  // Provide a minimal config when dataSource doesn't exist to satisfy TypeScript
  const dataSourceQuery = useDataSource(
    {
      fieldPath: field.id,
      config: field.dataSource || { url: '', itemsTemplate: '' }, // Minimal config when disabled
      formContext,
      enabled: !!field.dataSource,
    },
    {
      // Fallback to dataSourceCache for backward compatibility during migration
      initialData: field.dataSource ? (dataSourceCache[field.id] as FieldItem[] | undefined) : undefined,
    }
  );

  // Get items from field.items or data source query result
  const items = useMemo<FieldItem[]>(() => {
    if (field.dataSource) {
      // Use hook data if available, otherwise fallback to cache (for backward compatibility)
      const data = dataSourceQuery.data || dataSourceCache[field.id];
      if (data && Array.isArray(data)) {
        return data as FieldItem[];
      }
      // Fallback to callback pattern if hook hasn't loaded yet (backward compatibility)
      if (!data && onLoadDataSource && field.dataSource.auth) {
        // Only call callback if auth is compatible (bearer or apikey, not basic)
        const auth = field.dataSource.auth;
        if (auth.type === 'bearer' || auth.type === 'apikey') {
          onLoadDataSource(field.id, field.dataSource.url, {
            type: auth.type,
            token: auth.token,
            headerName: auth.headerName,
          });
        }
      }
    }
    return field.items || [];
  }, [field.items, field.dataSource, field.id, dataSourceQuery.data, dataSourceCache, onLoadDataSource]);

  // Derive loading state from hook or cache
  const isLoading = useMemo(() => {
    if (!field.dataSource) {
      return false;
    }
    // Use hook loading state if available
    if (dataSourceQuery.isLoading !== undefined) {
      return dataSourceQuery.isLoading;
    }
    // Fallback to cache check (backward compatibility)
    const cachedData = dataSourceCache[field.id];
    return !cachedData || !Array.isArray(cachedData);
  }, [field.dataSource, field.id, dataSourceQuery.isLoading, dataSourceCache]);

  return (
    <div data-testid={`radio-field-${field.id}`} className="space-y-2">
      <div>
        <Label>{field.label}</Label>
        {field.description && (
          <p className="text-sm text-muted-foreground">
            {field.description}
          </p>
        )}
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Controller
            name={field.id}
            control={form.control}
            render={({ field: controllerField }) => (
              <>
                {items.map((item) => {
                  const itemValue = String(item.value);
                  const isChecked = String(controllerField.value) === itemValue;
                  const radioId = `${field.id}-${itemValue}`;
                  
                  return (
                    <div key={itemValue} className="flex items-center space-x-2">
                      <input
                        id={radioId}
                        name={controllerField.name}
                        type="radio"
                        value={itemValue}
                        checked={isChecked}
                        onChange={() => controllerField.onChange(item.value)}
                        onBlur={controllerField.onBlur}
                        disabled={isDisabled}
                        className={cn(
                          'h-4 w-4 border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                          errorMessage && 'border-destructive focus:ring-destructive'
                        )}
                        aria-invalid={errorMessage ? 'true' : 'false'}
                        aria-describedby={errorMessage ? `${field.id}-error` : undefined}
                      />
                      <Label
                        htmlFor={radioId}
                        className="text-sm font-normal cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {item.label}
                      </Label>
                    </div>
                  );
                })}
              </>
            )}
          />
        )}
      </div>
      {errorMessage && (
        <div
          id={`${field.id}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
