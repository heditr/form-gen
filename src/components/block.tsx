/**
 * Block Component
 * 
 * Renders a form block with title, description, and fields.
 * Handles visibility and disabled states with smooth animations.
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import type { BlockDescriptor, GlobalFormDescriptor, FormData } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FormContext } from '@/utils/template-evaluator';
import { evaluateHiddenStatus, evaluateDisabledStatus } from '@/utils/template-evaluator';
import { isRepeatableBlock, isRepeatablePopinBlock, groupFieldsByRepeatableGroupId, buildAutoFillPatchFromSelection } from '@/utils/form-descriptor-integration';
import { buildBlockLayoutRows } from '@/utils/block-layout';
import { cn } from '@/lib/utils';
import FieldWrapper from './field-wrapper';
import RepeatableFieldGroup from './repeatable-field-group';
import RepeatablePopinSummary from './repeatable-popin-summary';

export interface BlockProps {
  block: BlockDescriptor;
  isDisabled: boolean;
  isHidden: boolean;
  form: UseFormReturn<FieldValues>;
  formContext: FormContext;
  onLoadDataSource: (fieldPath: string, url: string, auth?: { type: 'bearer' | 'apikey'; token?: string; headerName?: string }) => void;
  dataSourceCache: Record<string, unknown>;
  /**
   * When true, repeatable popin blocks render summaries instead of inline fields.
   * Use this on the main form; popin dialogs should always render inline fields.
   */
  renderRepeatablesAsSummary?: boolean;
}

/**
 * Block Component
 * 
 * Renders a block with its fields. Handles visibility and disabled states
 * with smooth fade/slide animations.
 */
export default function Block({
  block,
  isDisabled,
  isHidden,
  form,
  formContext,
  onLoadDataSource,
  dataSourceCache,
  renderRepeatablesAsSummary,
}: BlockProps) {
  // Track visibility state for smooth animations
  const [shouldRender, setShouldRender] = useState(!isHidden);
  const [isVisible, setIsVisible] = useState(!isHidden);
  const prevIsHiddenRef = useRef(isHidden);

  // Detect if this is a repeatable block (must be before early return)
  const isRepeatable = isRepeatableBlock(block);

  // Group fields by repeatableGroupId if block is repeatable (must be before early return)
  const fieldGroups = useMemo(() => {
    if (!isRepeatable) {
      return null;
    }
    return groupFieldsByRepeatableGroupId(block.fields);
  }, [block.fields, isRepeatable]);

  const nonRepeatableFields = useMemo(() => {
    if (!isRepeatable) {
      return block.fields;
    }
    return block.fields.filter(f => !f.repeatableGroupId);
  }, [block.fields, isRepeatable]);

  // Handle smooth enter/exit animations
  useEffect(() => {
    // Only update if isHidden actually changed
    if (prevIsHiddenRef.current === isHidden) {
      return;
    }

    prevIsHiddenRef.current = isHidden;

    if (isHidden) {
      // Start exit animation - update visibility state asynchronously
      const rafId = requestAnimationFrame(() => {
        setIsVisible(false);
      });
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match transition duration
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer);
      };
    } else {
      // Start enter animation - add to DOM first (async to avoid synchronous setState)
      const rafId = requestAnimationFrame(() => {
        setShouldRender(true);
        // Trigger visible state after a brief delay for smooth entry
        setTimeout(() => {
          requestAnimationFrame(() => {
            setIsVisible(true);
          });
        }, 10);
      });
      return () => {
        cancelAnimationFrame(rafId);
      };
    }
  }, [isHidden]);

  // Don't render if not needed
  if (!shouldRender) {
    return null;
  }

  const handleAutoFillSelection = (
    selectionFieldId: string,
    selectedPayload: Record<string, unknown>
  ) => {
    if (!selectedPayload) {
      return;
    }

    const descriptorForBlock: GlobalFormDescriptor = {
      blocks: [block],
      submission: {
        url: '',
        method: 'POST',
      },
    };

    const hiddenFieldIds: string[] = [];
    const disabledFieldIds: string[] = [];

    for (const field of nonRepeatableFields) {
      const fieldHidden = evaluateHiddenStatus(field, formContext);
      const fieldDisabled = evaluateDisabledStatus(field, formContext) || isDisabled;
      if (fieldHidden) {
        hiddenFieldIds.push(field.id);
      }
      if (fieldDisabled) {
        disabledFieldIds.push(field.id);
      }
    }

    const currentValues = form.getValues() as Partial<FormData>;

    const patch = buildAutoFillPatchFromSelection({
      descriptor: descriptorForBlock,
      selectionFieldId,
      selectedPayload,
      currentValues,
      hiddenFieldIds,
      disabledFieldIds,
    });

    for (const [key, value] of Object.entries(patch)) {
      form.setValue(key, value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  };

  return (
    <div
      data-testid={`block-${block.id}`}
      className={cn(
        'form-block',
        'transition-all duration-300 ease-in-out',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2',
        isDisabled && 'opacity-60 pointer-events-none'
      )}
    >
      {block.title && (
        <h2
          data-testid={`block-title-${block.id}`}
          className="block-title text-xl font-semibold mb-2"
        >
          {block.title}
        </h2>
      )}
      {block.description && (
        <p className="block-description text-sm text-muted-foreground mb-4">
          {block.description}
        </p>
      )}
      <div className="block-fields space-y-4">
        {isRepeatable && fieldGroups ? (
          // Render repeatable groups: popin mode (summaries) or inline mode
          Object.entries(fieldGroups).map(([groupId, fields]) => {
            const groupHidden = evaluateHiddenStatus(block, formContext);
            const groupDisabled = evaluateDisabledStatus(block, formContext) || isDisabled;

            if (renderRepeatablesAsSummary && isRepeatablePopinBlock(block)) {
              return (
                <RepeatablePopinSummary
                  key={groupId}
                  block={block}
                  groupId={groupId}
                  fields={fields}
                  isDisabled={groupDisabled}
                  isHidden={groupHidden}
                  form={form}
                  formContext={formContext}
                />
              );
            }

            return (
              <RepeatableFieldGroup
                key={groupId}
                block={block}
                groupId={groupId}
                fields={fields}
                isDisabled={groupDisabled}
                isHidden={groupHidden}
                form={form}
                formContext={formContext}
                onLoadDataSource={onLoadDataSource}
                dataSourceCache={dataSourceCache}
              />
            );
          })
        ) : null}
        {/* Render non-repeatable fields */}
        {(() => {
          const layoutMode = block.layout?.mode ?? 'default';

          if (layoutMode !== 'grid') {
            return nonRepeatableFields.map((field) => {
              const fieldHidden = evaluateHiddenStatus(field, formContext);
              const fieldDisabled = evaluateDisabledStatus(field, formContext) || isDisabled;

              return (
                <FieldWrapper
                  key={field.id}
                  field={field}
                  isDisabled={fieldDisabled}
                  isHidden={fieldHidden}
                  form={form}
                  formContext={formContext}
                  onLoadDataSource={onLoadDataSource}
                  dataSourceCache={dataSourceCache}
                  onAutoFillSelection={handleAutoFillSelection}
                />
              );
            });
          }

          const rows = buildBlockLayoutRows(block, nonRepeatableFields);
          const columns = block.layout?.columns ?? 1;
          const gap = block.layout?.gap ?? 'md';
          const gapYClass =
            gap === 'sm' ? 'gap-y-2' : gap === 'lg' ? 'gap-y-6' : 'gap-y-4';

          const gridColsClass =
            columns === 1
              ? 'md:grid-cols-1'
              : columns === 2
              ? 'md:grid-cols-2'
              : 'md:grid-cols-3';

          return rows.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className={cn(
                'grid grid-cols-1',
                gridColsClass,
                'gap-x-4',
                gapYClass
              )}
            >
              {row.slots.map((slot, slotIndex) => (
                <div key={`slot-${slotIndex}`} className={slot.colSpan ? `col-span-${slot.colSpan}` : undefined}>
                  {slot.fields.map((field) => {
                    const fieldHidden = evaluateHiddenStatus(field, formContext);
                    const fieldDisabled =
                      evaluateDisabledStatus(field, formContext) || isDisabled;

                    return (
                      <FieldWrapper
                        key={field.id}
                        field={field}
                        isDisabled={fieldDisabled}
                        isHidden={fieldHidden}
                        form={form}
                        formContext={formContext}
                        onLoadDataSource={onLoadDataSource}
                        dataSourceCache={dataSourceCache}
                        onAutoFillSelection={handleAutoFillSelection}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
