/**
 * Field Wrapper Component
 * 
 * Handles field visibility, validation display, and delegates to specific field components.
 */

import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';

export interface FieldWrapperProps {
  field: FieldDescriptor;
  isDisabled: boolean;
  isHidden: boolean;
  form: UseFormReturn<FieldValues>;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
}

/**
 * Field Wrapper Component
 * 
 * Conditionally renders field based on visibility and delegates to appropriate field component.
 */
export default function FieldWrapper({
  field,
  isDisabled,
  isHidden,
  form,
  onLoadDataSource,
}: FieldWrapperProps) {
  // Don't render if hidden
  if (isHidden) {
    return null;
  }

  // Get validation error for this field
  const error = form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;

  // For now, render a simple placeholder
  // Specific field components will be created in later tasks
  return (
    <div data-testid={`field-${field.id}`} className="field-wrapper">
      <label className="field-label">{field.label}</label>
      {field.description && (
        <p className="field-description">{field.description}</p>
      )}
      <div className="field-input">
        {/* TODO: Render appropriate field component based on field.type */}
        <input
          type="text"
          disabled={isDisabled}
          {...form.register(field.id)}
        />
      </div>
      {errorMessage && (
        <div className="field-error" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
