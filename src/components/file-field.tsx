/**
 * FileField Component
 * 
 * Renders a file upload field using react-hook-form with Shadcn UI Input component.
 * Handles validation errors, disabled states, and file type/size validation.
 */

import { Controller } from 'react-hook-form';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FileFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
}

/**
 * FileField Component
 * 
 * Renders a file input with label, description, and validation error display.
 * Uses Controller from react-hook-form with Shadcn UI Input component.
 * File type and size validation is handled by react-hook-form validation rules.
 */
export default function FileField({
  field,
  form,
  isDisabled,
}: FileFieldProps) {
  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  return (
    <div data-testid={`file-field-${field.id}`} className="space-y-2">
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
        defaultValue={field.defaultValue as File | File[] | null | undefined}
        render={({ field: controllerField }) => (
          <Input
            id={field.id}
            name={controllerField.name}
            type="file"
            onChange={(e) => {
              const files = e.target.files;
              if (!files || files.length === 0) {
                controllerField.onChange(null);
                return;
              }
              // Return single file or array of files based on multiple attribute
              if (files.length === 1) {
                controllerField.onChange(files[0]);
              } else {
                controllerField.onChange(Array.from(files));
              }
            }}
            onBlur={controllerField.onBlur}
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
