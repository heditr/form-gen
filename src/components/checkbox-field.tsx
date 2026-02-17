/**
 * CheckboxField Component
 * 
 * Renders a checkbox field using react-hook-form with Shadcn UI styling.
 * Handles validation errors, disabled states, and discriminant field change events.
 */

import { Controller } from 'react-hook-form';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { getErrorByPath } from '@/utils/form-errors';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface CheckboxFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
}

/**
 * CheckboxField Component
 * 
 * Renders a checkbox with label, description, and validation error display.
 * Uses Controller from react-hook-form.
 * Note: For discriminant fields, the watch() subscription in useFormDescriptor
 * will automatically sync changes to Redux and trigger re-hydration.
 */
export default function CheckboxField({
  field,
  form,
  isDisabled,
}: CheckboxFieldProps) {
  const error = getErrorByPath(form.formState.errors, field.id) ?? form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  return (
    <div data-testid={`checkbox-field-${field.id}`} className="space-y-2">
      <div className="flex items-center space-x-2">
        <Controller
          name={field.id}
          control={form.control}
          render={({ field: controllerField }) => (
            <input
              id={field.id}
              name={controllerField.name}
              type="checkbox"
              checked={controllerField.value || false}
              onChange={(e) => controllerField.onChange(e.target.checked)}
              onBlur={controllerField.onBlur}
              disabled={isDisabled}
              className={cn(
                'h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                errorMessage && 'border-destructive focus:ring-destructive'
              )}
              aria-invalid={errorMessage ? 'true' : 'false'}
              aria-describedby={errorMessage ? `${field.id}-error` : undefined}
            />
          )}
        />
        <Label htmlFor={field.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {field.label}
        </Label>
      </div>
      {field.description && (
        <p className="text-sm text-muted-foreground pl-6">
          {field.description}
        </p>
      )}
      {errorMessage && (
        <div
          id={`${field.id}-error`}
          className="text-sm text-destructive pl-6"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
