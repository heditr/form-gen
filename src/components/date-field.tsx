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

function formatDateForInput(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

function parseInputDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export interface DateFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
  required?: boolean;
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
  required = false,
}: DateFieldProps) {
  const error = getErrorByPath(form.formState.errors, field.id) ?? form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  return (
    <div data-testid={`date-field-${field.id}`} className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
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
            value={formatDateForInput(controllerField.value)}
            onChange={(event) => {
              controllerField.onChange(parseInputDate(event.target.value));
            }}
            disabled={isDisabled}
            required={required}
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
