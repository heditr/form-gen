/**
 * Field Wrapper Component
 * 
 * Handles field visibility, validation display, and delegates to specific field components.
 */

import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { getErrorByPath } from '@/utils/form-errors';
import { evaluateValidationArrayTemplate } from '@/utils/array-template-evaluator';
import TextField from './text-field';
import LookupTextField from './lookup-text-field';
import DropdownField from './dropdown-field';
import MultiselectField from './multiselect-field';
import AutocompleteField from './autocomplete-field';
import CheckboxField from './checkbox-field';
import RadioField from './radio-field';
import DateField from './date-field';
import FileField from './file-field';
import NumberField from './number-field';
import ButtonField from './button-field';

export interface FieldWrapperProps {
  field: FieldDescriptor;
  isDisabled: boolean;
  isHidden: boolean;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
  onAutoFillSelection?: (fieldId: string, selectedPayload: Record<string, unknown>) => void;
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
  formContext,
  onLoadDataSource,
  dataSourceCache,
  onAutoFillSelection,
}: FieldWrapperProps) {
  // Don't render if hidden
  if (isHidden) {
    return null;
  }
  const isRequired = evaluateValidationArrayTemplate(field.validation, formContext).some(
    (rule) => rule.type === 'required'
  );

  // Render appropriate field component based on field type
  switch (field.type) {
    case 'text':
      if (field.manualLookup || field.autoFilledUpdate) {
        return (
          <LookupTextField
            field={field}
            form={form}
            isDisabled={isDisabled}
            required={isRequired}
          />
        );
      }
      return (
        <TextField
          field={field}
          form={form}
          isDisabled={isDisabled}
          required={isRequired}
        />
      );
    case 'dropdown':
      return (
        <DropdownField
          field={field}
          form={form}
          formContext={formContext}
          isDisabled={isDisabled}
          required={isRequired}
          onLoadDataSource={onLoadDataSource}
          dataSourceCache={dataSourceCache}
          onAutoFillSelection={onAutoFillSelection}
        />
      );
    case 'multiselect':
      return (
        <MultiselectField
          field={field}
          form={form}
          formContext={formContext}
          isDisabled={isDisabled}
          required={isRequired}
          onLoadDataSource={onLoadDataSource}
          dataSourceCache={dataSourceCache}
        />
      );
    case 'autocomplete':
      return (
        <AutocompleteField
          field={field}
          form={form}
          formContext={formContext}
          isDisabled={isDisabled}
          required={isRequired}
          onLoadDataSource={onLoadDataSource}
          dataSourceCache={dataSourceCache}
          onAutoFillSelection={onAutoFillSelection}
        />
      );
    case 'checkbox':
      return (
        <CheckboxField
          field={field}
          form={form}
          isDisabled={isDisabled}
          required={isRequired}
        />
      );
    case 'radio':
      return (
        <RadioField
          field={field}
          form={form}
          formContext={formContext}
          isDisabled={isDisabled}
          required={isRequired}
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
          required={isRequired}
        />
      );
    case 'number':
      return (
        <NumberField
          field={field}
          form={form}
          isDisabled={isDisabled}
          required={isRequired}
        />
      );
    case 'file':
      return (
        <FileField
          field={field}
          form={form}
          isDisabled={isDisabled}
          required={isRequired}
        />
      );
    case 'button':
      return (
        <ButtonField
          field={field}
          isDisabled={isDisabled}
        />
      );
    default: {
      const error = getErrorByPath(form.formState.errors, field.id) ?? form.formState.errors[field.id];
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
}
