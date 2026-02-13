/**
 * DropdownField Component
 * 
 * Renders a dropdown/select field using react-hook-form with Shadcn UI Select component.
 * Supports static items and dynamic data sources with loading states.
 */

import { useMemo } from 'react';
import { Controller } from 'react-hook-form';
import type { FieldDescriptor, FieldItem } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { useDataSource } from '@/hooks/use-form-query';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface DropdownFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  isDisabled: boolean;
  onLoadDataSource?: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache?: Record<string, unknown>;
}

/**
 * DropdownField Component
 * 
 * Renders a dropdown with label, description, and validation error display.
 * Uses Controller from react-hook-form with Shadcn UI Select component.
 * Supports both static items and dynamic data sources.
 */
export default function DropdownField({
  field,
  form,
  formContext,
  isDisabled,
  onLoadDataSource,
  dataSourceCache = {},
}: DropdownFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  // Use useDataSource hook - always call it (React hooks rule), but disable when no dataSource
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

  // Derive items from field.items or data source query result
  const items = useMemo<FieldItem[]>(() => {
    // If field has static items, use them
    if (field.items) {
      return field.items;
    }

    // If field has dataSource, use hook data or fallback to cache
    if (field.dataSource) {
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

    return [];
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
    return !cachedData;
  }, [field.dataSource, field.id, dataSourceQuery.isLoading, dataSourceCache]);

  return (
    <div data-testid={`dropdown-field-${field.id}`} className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
      </Label>
      {field.description && (
        <p className="text-sm text-muted-foreground">
          {field.description}
        </p>
      )}
      <Controller
        name={field.id}
        control={form.control}
        render={({ field: controllerField }) => (
          <Select
            id={field.id}
            {...controllerField}
            disabled={isDisabled || isLoading}
            className={cn(
              errorMessage && 'border-destructive focus:ring-destructive'
            )}
            aria-invalid={errorMessage ? 'true' : 'false'}
            aria-describedby={errorMessage ? `${field.id}-error` : undefined}
          >
            {isLoading ? (
              <option value="">Loading...</option>
            ) : (
              <>
                <option value="">Select an option</option>
                {items.map((item) => (
                  <option key={String(item.value)} value={String(item.value)}>
                    {item.label}
                  </option>
                ))}
              </>
            )}
          </Select>
        )}
      />
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
