import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { useFieldError } from '@/hooks/use-field-error';
import { Label } from '@/components/ui/label';
import TextFieldInputControl from './text-field-input-control';

export interface LookupTextFieldProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
  isReadonly?: boolean;
  required?: boolean;
}

export default function LookupTextField({
  field,
  form,
  isDisabled,
  isReadonly = false,
  required = false,
}: LookupTextFieldProps) {
  const error = useFieldError(form, field.id);
  const errorMessage = error?.message as string | undefined;

  return (
    <div data-testid={`text-field-${field.id}`} className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </Label>
      {field.description && (
        <p className="text-sm text-muted-foreground">
          {field.description}
        </p>
      )}
      <TextFieldInputControl
        field={field}
        form={form}
        isDisabled={isDisabled}
        isReadonly={isReadonly}
        required={required}
        errorMessage={errorMessage}
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
