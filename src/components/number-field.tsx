/**
 * NumberField Component
 * 
 * Renders a number input field using react-hook-form with Shadcn UI Input component.
 * Handles validation errors, disabled states, and ensures only numeric values are accepted.
 */

import { Controller } from 'react-hook-form';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface NumberFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
}

/**
 * NumberField Component
 * 
 * Renders a number input with label, description, and validation error display.
 * Uses Controller from react-hook-form with Shadcn UI Input component.
 * Note: For discriminant fields, the watch() subscription in useFormDescriptor
 * will automatically sync changes to Redux and trigger re-hydration.
 */
export default function NumberField({
  field,
  form,
  isDisabled,
}: NumberFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  return (
    <div data-testid={`number-field-${field.id}`} className="space-y-2">
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
            type="number"
            {...controllerField}
            value={controllerField.value ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              // Convert empty string to undefined, otherwise parse as number
              const numValue = value === '' ? undefined : Number(value);
              controllerField.onChange(numValue);
            }}
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
