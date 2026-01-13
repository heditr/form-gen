/**
 * Block Component
 * 
 * Renders a form block with title, description, and fields.
 * Handles visibility and disabled states.
 */

import { useMemo } from 'react';
import type { BlockDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { evaluateHiddenStatus, evaluateDisabledStatus } from '@/utils/template-evaluator';
import FieldWrapper from './field-wrapper';

export interface BlockProps {
  block: BlockDescriptor;
  isDisabled: boolean;
  isHidden: boolean;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
}

/**
 * Block Component
 * 
 * Renders a block with its fields. Handles visibility and disabled states.
 */
export default function Block({
  block,
  isDisabled,
  isHidden,
  form,
  formContext,
  onLoadDataSource,
}: BlockProps) {
  // Don't render if hidden
  if (isHidden) {
    return null;
  }

  return (
    <div data-testid={`block-${block.id}`} className="form-block">
      {block.title && (
        <h2 data-testid={`block-title-${block.id}`} className="block-title">
          {block.title}
        </h2>
      )}
      {block.description && (
        <p className="block-description">{block.description}</p>
      )}
      <div className="block-fields">
        {block.fields.map((field) => {
          // Evaluate field visibility
          const fieldHidden = evaluateHiddenStatus(field, formContext);
          const fieldDisabled = evaluateDisabledStatus(field, formContext) || isDisabled;

          return (
            <FieldWrapper
              key={field.id}
              field={field}
              isDisabled={fieldDisabled}
              isHidden={fieldHidden}
              form={form}
              onLoadDataSource={onLoadDataSource}
            />
          );
        })}
      </div>
    </div>
  );
}
