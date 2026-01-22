/**
 * TextField Component
 * 
 * Renders a text input field using react-hook-form with Shadcn UI Input component.
 * Handles validation errors, disabled states, and discriminant field blur events.
 */

import { Controller } from 'react-hook-form';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface TextFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
}

/**
 * TextField Component
 * 
 * Renders a text input with label, description, and validation error display.
 * Uses Controller from react-hook-form with Shadcn UI Input component.
 * Note: For discriminant fields, the watch() subscription in useFormDescriptor
 * will automatically sync changes to Redux and trigger re-hydration.
 */
export default function TextField({
  field,
  form,
  isDisabled,
}: TextFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  return (
    <div data-testid={`text-field-${field.id}`} className="space-y-2">
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
            type="text"
            {...controllerField}
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
