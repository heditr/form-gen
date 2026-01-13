/**
 * DropdownField Component
 * 
 * Renders a dropdown/select field using react-hook-form with Shadcn UI Select component.
 * Supports static items and dynamic data sources with loading states.
 */

import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { FieldDescriptor, FieldItem } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface DropdownFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
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
  isDisabled,
  onLoadDataSource,
  dataSourceCache = {},
}: DropdownFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  // Track loading state
  const [isLoading, setIsLoading] = useState(false);

  // Determine items to display
  const [items, setItems] = useState<FieldItem[]>(field.items || []);

  // Load data source when field becomes visible and has dataSource config
  useEffect(() => {
    if (!field.dataSource) {
      return;
    }

    const fieldPath = field.id;
    const cachedData = dataSourceCache[fieldPath];

    // If data is already cached, use it
    if (cachedData) {
      // For now, assume cached data is already transformed
      // TODO: Transform using Handlebars itemsTemplate
      if (Array.isArray(cachedData)) {
        setItems(cachedData as FieldItem[]);
      }
      return;
    }

    // Trigger data loading
    setIsLoading(true);
    // TODO: Evaluate URL template with form context
    // For now, use the URL directly
    onLoadDataSource(fieldPath, field.dataSource.url, field.dataSource.auth);
    
    // Note: Data will be loaded via Redux saga and cached
    // Component should re-render when dataSourceCache updates
    // For now, we'll set loading to false after a delay (this should be handled by Redux state)
    // In a real implementation, we'd watch dataSourceCache changes
  }, [field.dataSource, field.id, dataSourceCache, onLoadDataSource]);

  // Watch for data source cache updates
  useEffect(() => {
    if (!field.dataSource) {
      return;
    }

    const fieldPath = field.id;
    const cachedData = dataSourceCache[fieldPath];

    if (cachedData && Array.isArray(cachedData)) {
      setItems(cachedData as FieldItem[]);
      setIsLoading(false);
    }
  }, [dataSourceCache, field.id, field.dataSource]);

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
        defaultValue={field.defaultValue !== undefined ? (field.defaultValue as string) : ''}
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
