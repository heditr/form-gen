/**
 * Form Presentation Component
 *
 * Pure presentation component that renders form blocks and fields.
 * Reads visibility from FormStatusProvider when available.
 */

import { memo, useContext } from 'react';
import type { BlockDescriptor } from '@/types/form-descriptor';
import type { FormPresentationProps } from './form-container';
import {
  FormStatusContext,
  type FieldStatus,
  type FormStatusContextValue,
} from '@/context/form-status-context';
import { evaluateHiddenStatus, evaluateDisabledStatus, evaluateReadonlyStatus } from '@/utils/template-evaluator';
import Block from './block';

function resolveBlockStatus(
  block: BlockDescriptor,
  formContext: FormPresentationProps['formContext'],
  statusContext: FormStatusContextValue | null
): FieldStatus {
  if (statusContext) {
    return statusContext.getBlockStatus(block.id);
  }
  return {
    hidden: evaluateHiddenStatus(block, formContext ?? {}),
    disabled: evaluateDisabledStatus(block, formContext ?? {}),
    readonly: evaluateReadonlyStatus(block, formContext ?? {}),
  };
}

function FormPresentationBlock({
  block,
  form,
  formContext,
  onLoadDataSource,
  dataSourceCache,
}: {
  block: BlockDescriptor;
  form: FormPresentationProps['form'];
  formContext: FormPresentationProps['formContext'];
  onLoadDataSource: FormPresentationProps['onLoadDataSource'];
  dataSourceCache: FormPresentationProps['dataSourceCache'];
}) {
  const statusContext = useContext(FormStatusContext);
  const { hidden: isHidden, disabled: isDisabled, readonly: isReadonly } = resolveBlockStatus(
    block,
    formContext,
    statusContext
  );

  if (isHidden) {
    return null;
  }

  return (
    <Block
      block={block}
      isDisabled={isDisabled}
      isHidden={false}
      isReadonly={isReadonly}
      statusMode="context"
      form={form}
      formContext={formContext}
      onLoadDataSource={onLoadDataSource}
      dataSourceCache={dataSourceCache}
      renderRepeatablesAsSummary
    />
  );
}

const MemoFormPresentationBlock = memo(FormPresentationBlock);

function FormPresentation({
  form,
  formContext: formContextProp,
  visibleBlocks: _visibleBlocks,
  visibleFields: _visibleFields,
  isRehydrating: _isRehydrating,
  mergedDescriptor,
  onLoadDataSource,
  dataSourceCache,
}: FormPresentationProps) {
  const statusContext = useContext(FormStatusContext);
  const formContext = statusContext?.formContext ?? formContextProp ?? {};

  if (!mergedDescriptor) {
    return (
      <div data-testid="form-presentation" className="form-presentation">
        <p>No form descriptor available</p>
      </div>
    );
  }

  return (
    <form data-testid="form-presentation" className="form-presentation" onSubmit={form.handleSubmit(() => {})}>
      {mergedDescriptor.blocks.map((block) => {
        if (block.popin) {
          return null;
        }

        return (
          <MemoFormPresentationBlock
            key={block.id}
            block={block}
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

export default memo(FormPresentation);
