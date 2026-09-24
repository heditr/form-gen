import { memo } from 'react';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { useFieldError } from '@/hooks/use-field-error';
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
import DocumentCard from './document-card';
import NumberField from './number-field';
import ButtonField from './button-field';

export interface FieldWrapperProps {
  field: FieldDescriptor;
  isDisabled: boolean;
  isHidden: boolean;
  isReadonly?: boolean;
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
function FieldWrapper({
  field,
  isDisabled,
  isHidden,
  isReadonly = false,
  form,
  formContext,
  onLoadDataSource,
  dataSourceCache,
  onAutoFillSelection,
}: FieldWrapperProps) {
  const fieldError = useFieldError(form, field.id);

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
      if (field.manualLookup) {
        return (
          <LookupTextField
            field={field}
            form={form}
            isDisabled={isDisabled}
            isReadonly={isReadonly}
            required={isRequired}
          />
        );
      }
      return (
        <TextField
          field={field}
          form={form}
          isDisabled={isDisabled}
          isReadonly={isReadonly}
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
          isReadonly={isReadonly}
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
          isReadonly={isReadonly}
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
          isReadonly={isReadonly}
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
          isReadonly={isReadonly}
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
          isReadonly={isReadonly}
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
          isReadonly={isReadonly}
          required={isRequired}
        />
      );
    case 'number':
      return (
        <NumberField
          field={field}
          form={form}
          isDisabled={isDisabled}
          isReadonly={isReadonly}
          required={isRequired}
        />
      );
    case 'file':
      return (
        <FileField
          field={field}
          form={form}
          isDisabled={isDisabled}
          isReadonly={isReadonly}
          required={isRequired}
        />
      );
    case 'document':
      return (
        <DocumentCard
          field={field}
          form={form}
          isDisabled={isDisabled}
          isReadonly={isReadonly}
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
      const errorMessage = fieldError?.message as string | undefined;
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
              readOnly={isReadonly}
              aria-readonly={isReadonly}
              data-readonly={isReadonly ? 'true' : undefined}
              className={isReadonly && !isDisabled ? 'bg-muted' : undefined}
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

export default memo(FieldWrapper);
