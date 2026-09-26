/**
 * Renders one `document` field: checkboxes live inline; uploads open {@link DocumentCardUploadPopin}
 * via {@link useDocumentPopin} so multipart work survives `FormInner` `key` churn.
 */

import { useCallback, useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { DocumentCardData, FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { useFieldError } from '@/hooks/use-field-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  applyRequestedToSlot,
  reconcileDocumentProspectsForConfig,
} from '@/hooks/use-document-card';
import {
  formatSlotCategorySubtitle,
  getSlotDescriptors,
  getSlotKey,
  getSlotData,
  normalizeDocumentCardData,
  prospectConfigIdsKey,
  updateSlotData,
} from '@/utils/document-card-slots';
import { useDocumentPopin } from '@/components/document-popin-provider';

/** Presentation props for descriptor `type: 'document'` (container supplies `form` + disability flags). */
export interface DocumentCardProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
  isReadonly?: boolean;
  required?: boolean;
}

/**
 * Renders one `document` descriptor field bound to {@link DocumentCardData} at `field.id`.
 */
export default function DocumentCard({
  field,
  form,
  isDisabled,
  isReadonly = false,
  required = false,
}: DocumentCardProps) {
  const config = field.document;
  const error = useFieldError(form, field.id);
  const errorMessage = error?.message as string | undefined;
  const [documentError, setDocumentError] = useState<string | null>(null);
  const { openDocumentPopin } = useDocumentPopin();

  const prospectIdsKey = prospectConfigIdsKey(field.document?.prospects);

  const setFailure = useCallback(
    (message: string) => {
      setDocumentError(message);
      form.setError(field.id, {
        type: 'document',
        message,
      });
    },
    [field.id, form]
  );

  useEffect(() => {
    const cfg = field.document;
    if (!cfg || cfg.layout !== 'perProspect') {
      return;
    }

    const current = normalizeDocumentCardData(
      cfg,
      form.getValues(field.id as never) as DocumentCardData | undefined
    );
    const next = reconcileDocumentProspectsForConfig(current, cfg.prospects ?? []);
    if (next !== current) {
      form.setValue(field.id as never, next as never, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
    // Deliberately only when prospect IDs list changes (`prospectIdsKey`).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- summarized by `prospectIdsKey`
  }, [prospectIdsKey, field.id, form]);

  const openManageDialog = useCallback(
    (slotId: string) => {
      setDocumentError(null);
      form.clearErrors(field.id as never);
      openDocumentPopin({
        fieldId: field.id,
        slotId,
        ...(required ? { requireFileForValidate: true } : {}),
      });
    },
    [field.id, form, openDocumentPopin, required]
  );

  if (!config) {
    return null;
  }

  const slots = getSlotDescriptors(config);

  return (
    <div
      data-testid={`document-card-${field.id}`}
      data-readonly={isReadonly ? 'true' : undefined}
      aria-readonly={isReadonly}
      className="space-y-3 rounded-md border bg-background p-4"
    >
      <div className="space-y-1">
        <Label>
          {field.label}
          {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
        </Label>
        {field.description && (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatSlotCategorySubtitle(config)}</p>
      </div>

      <Controller
        name={field.id}
        control={form.control}
        render={({ field: controllerField }) => {
          const value = normalizeDocumentCardData(config, controllerField.value as DocumentCardData | null | undefined);

          return (
            <div className="space-y-3">
              {slots.map((slot) => {
                const slotData = getSlotData(value, slot);

                const setRequestedCheckbox = (checked: boolean) => {
                  const next = applyRequestedToSlot({ data: value, slot, requested: checked });
                  if (next === null) {
                    setFailure('Requested cannot be cleared while files are attached.');
                    return;
                  }
                  setDocumentError(null);
                  controllerField.onChange(next);
                };

                const setOptionalCheckbox = (checked: boolean) => {
                  controllerField.onChange(updateSlotData(value, slot, { optional: checked }));
                };

                const slotReadable = !(isDisabled || isReadonly || config.category === 'prefilledOnly');

                return (
                  <div key={`${slot.kind}-${slot.id}`} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">{slot.label}</p>
                        {slotData.files.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {slotData.files.length} uploaded file{slotData.files.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={slotData.requested}
                            disabled={isDisabled || isReadonly || config.requestedDisabled}
                            aria-readonly={isReadonly}
                            data-readonly={isReadonly ? 'true' : undefined}
                            onChange={(event) =>
                              setRequestedCheckbox(event.currentTarget.checked)}
                          />
                          Requested
                        </label>
                        {config.allowOptional && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={slotData.optional ?? false}
                              disabled={isDisabled || isReadonly}
                              aria-readonly={isReadonly}
                              onChange={(event) => setOptionalCheckbox(event.currentTarget.checked)}
                            />
                            Optional
                          </label>
                        )}
                      </div>
                    </div>

                    {slotData.files.length > 0 && (
                      <ul className="space-y-1">
                        {slotData.files.map((fileItem) => (
                          <li
                            key={fileItem.id}
                            className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-sm"
                          >
                            <a
                              href={fileItem.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-blue-600 hover:underline"
                            >
                              {fileItem.frontOfficeName ?? fileItem.filename}
                            </a>
                            {fileItem.clientConfirmationRequested && (
                              <span className="text-xs text-muted-foreground">Confirmation requested</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!slotReadable || isDisabled || isReadonly || config.requestedDisabled}
                      aria-label={`Manage uploads · ${slot.label}`}
                      onClick={() => openManageDialog(slot.id)}
                      data-slot-key={getSlotKey(slot)}
                    >
                      Manage uploads…
                    </Button>
                  </div>
                );
              })}

              {config.allowComment && (
                <div className="space-y-1">
                  <Label htmlFor={`${field.id}-comment`}>Comment</Label>
                  <textarea
                    id={`${field.id}-comment`}
                    value={value.comment ?? ''}
                    disabled={isDisabled || isReadonly}
                    readOnly={isReadonly}
                    aria-readonly={isReadonly}
                    onChange={(event) => controllerField.onChange({
                      ...value,
                      comment: event.currentTarget.value,
                    })}
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          );
        }}
      />

      {(errorMessage || documentError) && (
        <div id={`${field.id}-error`} className="text-sm text-destructive" role="alert">
          {documentError || errorMessage}
        </div>
      )}
    </div>
  );
}
