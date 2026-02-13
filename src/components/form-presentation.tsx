/**
 * Form Presentation Component
 * 
 * Pure presentation component that renders form blocks and fields.
 * Receives form methods and state as props from container.
 */

import { useMemo } from 'react';
import type { FormPresentationProps } from './form-container';
import type { FormContext } from '@/utils/template-evaluator';
import { evaluateHiddenStatus, evaluateDisabledStatus } from '@/utils/template-evaluator';
import Block from './block';

/**
 * Form Presentation Component
 * 
 * Renders form based on merged descriptor with conditional visibility.
 * Uses react-hook-form for form management.
 */
export default function FormPresentation({
  form,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visibleBlocks: _visibleBlocks, // Used by container for selector, but we evaluate status here
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visibleFields: _visibleFields, // Used by container for selector, but we evaluate status here
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isRehydrating: _isRehydrating, // Reserved for future loading state UI
  mergedDescriptor,
  onLoadDataSource,
  dataSourceCache,
}: FormPresentationProps) {
  // Get current form values for template evaluation
  const formValues = form.watch();

  // Build form context for template evaluation
  // Context includes form data (spread for direct access) and nested formData property
  // Note: caseContext is not available here, but discriminant fields are included in formValues
  const formContext: FormContext = useMemo(
    () => ({
      ...formValues,
      formData: formValues, // Nested property for template access
    }),
    [formValues]
  );

  // If no descriptor, render empty form
  if (!mergedDescriptor) {
    return (
      <div data-testid="form-presentation" className="form-presentation">
        <p>No form descriptor available</p>
      </div>
    );
  }

  // Render blocks from merged descriptor
  // We use mergedDescriptor.blocks instead of visibleBlocks to evaluate status templates
  return (
    <form data-testid="form-presentation" className="form-presentation" onSubmit={form.handleSubmit(() => {})}>
      {mergedDescriptor.blocks.map((block) => {
        // Skip popin blocks - they never render inline, only via button triggers
        if (block.popin) {
          return null;
        }

        // Evaluate block visibility
        const isHidden = evaluateHiddenStatus(block, formContext);
        const isDisabled = evaluateDisabledStatus(block, formContext);

        // Skip hidden blocks
        if (isHidden) {
          return null;
        }

        return (
          <Block
            key={block.id}
            block={block}
            isDisabled={isDisabled}
            isHidden={false} // Already filtered above
            form={form}
            formContext={formContext}
            onLoadDataSource={onLoadDataSource}
            dataSourceCache={dataSourceCache}
          />
        );
      })}
    </form>
  );
}
