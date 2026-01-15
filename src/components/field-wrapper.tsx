/**
 * Field Wrapper Component
 * 
 * Handles field visibility, validation display, and delegates to specific field components.
 */

import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import TextField from './text-field';
import DropdownField from './dropdown-field';
import AutocompleteField from './autocomplete-field';
import CheckboxField from './checkbox-field';
import RadioField from './radio-field';
import DateField from './date-field';
import FileField from './file-field';
import NumberField from './number-field';

export interface FieldWrapperProps {
  field: FieldDescriptor;
  isDisabled: boolean;
  isHidden: boolean;
  form: UseFormReturn<FieldValues>;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
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
  dataSourceCache,
}: FieldWrapperProps) {
  // Don't render if hidden
  if (isHidden) {
    return null;
  }

  // Render appropriate field component based on field type
  switch (field.type) {
    case 'text':
      return (
        <TextField
          field={field}
          form={form}
          isDisabled={isDisabled}
        />
      );
    case 'dropdown':
      return (
        <DropdownField
          field={field}
          form={form}
          isDisabled={isDisabled}
          onLoadDataSource={onLoadDataSource}
          dataSourceCache={dataSourceCache}
        />
      );
    case 'autocomplete':
      return (
        <AutocompleteField
          field={field}
          form={form}
          isDisabled={isDisabled}
          onLoadDataSource={onLoadDataSource}
          dataSourceCache={dataSourceCache}
        />
      );
    case 'checkbox':
      return (
        <CheckboxField
          field={field}
          form={form}
          isDisabled={isDisabled}
        />
      );
    case 'radio':
      return (
        <RadioField
          field={field}
          form={form}
          isDisabled={isDisabled}
          onLoadDataSource={onLoadDataSource}
          dataSourceCache={dataSourceCache}
        />
      );
    case 'date':
      return (
        <DateField
          field={field}
          form={form}
          isDisabled={isDisabled}
        />
      );
    case 'number':
      return (
        <NumberField
          field={field}
          form={form}
          isDisabled={isDisabled}
        />
      );
    case 'file':
      return (
        <FileField
          field={field}
          form={form}
          isDisabled={isDisabled}
        />
      );
    default:
      // Fallback for unsupported field types
      const error = form.formState.errors[field.id];
      const errorMessage = error?.message as string | undefined;
      return (
        <div data-testid={`field-${field.id}`} className="field-wrapper">
          <label className="field-label">{field.label}</label>
          {field.description && (
            <p className="field-description">{field.description}</p>
          )}
          <div className="field-input">
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
}
