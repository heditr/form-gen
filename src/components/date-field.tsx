/**
 * DateField Component
 * 
 * Renders a date input field using react-hook-form with Shadcn UI Input component.
 * Handles validation errors, disabled states, and date format/range validation.
 */

import { Controller } from 'react-hook-form';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { getErrorByPath } from '@/utils/form-errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface DateFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
}

/**
 * DateField Component
 * 
 * Renders a date input with label, description, and validation error display.
 * Uses Controller from react-hook-form with Shadcn UI Input component.
 * Date format and range validation is handled by react-hook-form validation rules.
 */
export default function DateField({
  field,
  form,
  isDisabled,
}: DateFieldProps) {
  const error = getErrorByPath(form.formState.errors, field.id) ?? form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  return (
    <div data-testid={`date-field-${field.id}`} className="space-y-2">
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
          <Input
            id={field.id}
            type="date"
            {...controllerField}
            value={controllerField.value ?? ''}
            disabled={isDisabled}
            className={cn(
              errorMessage && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={errorMessage ? 'true' : 'false'}
            aria-describedby={errorMessage ? `${field.id}-error` : undefined}
          />
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
