/**
 * DocumentCard Component
 *
 * Renders descriptor-driven document request/upload metadata as a single RHF field.
 */

import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';
import type {
  DocumentCardConfig,
  DocumentCardData,
  DocumentCardSlotData,
  FieldDescriptor,
  UploadedFileMeta,
} from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { getErrorByPath } from '@/utils/form-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface DocumentCardProps {
  field: FieldDescriptor;
  form: UseFormReturn<FieldValues>;
  isDisabled: boolean;
  required?: boolean;
}

type SlotKind = 'root' | 'prospects';

interface SlotDescriptor {
  id: string;
  label: string;
  kind: SlotKind;
  requestedDefault?: boolean;
  optionalDefault?: boolean;
  filesDefault?: UploadedFileMeta[];
}

const defaultUploadUrl = '/api/upload';

const getSlotKey = (slot: SlotDescriptor): string => `${slot.kind}:${slot.id}`;

const emptySlot = ({
  requestedDefault = false,
  optionalDefault = false,
  filesDefault = [],
}: Pick<SlotDescriptor, 'requestedDefault' | 'optionalDefault' | 'filesDefault'>): DocumentCardSlotData => ({
  requested: requestedDefault,
  optional: optionalDefault,
  files: filesDefault,
});

const getSlotDescriptors = (config: DocumentCardConfig): SlotDescriptor[] => {
  if (config.layout === 'perProspect') {
    return (config.prospects ?? []).map((prospect) => ({
      id: prospect.id,
      label: prospect.name,
      kind: 'prospects',
      requestedDefault: prospect.requestedDefault,
      optionalDefault: prospect.optionalDefault,
      filesDefault: prospect.defaultFiles,
    }));
  }

  return [
    {
      id: 'document',
      label: 'Document',
      kind: 'root',
      requestedDefault: config.requestedDefault,
      optionalDefault: config.optionalDefault,
    },
  ];
};

const normalizeDocumentCardData = (
  config: DocumentCardConfig,
  value: DocumentCardData | null | undefined
): DocumentCardData => ({
  requested: value?.requested ?? config.requestedDefault ?? false,
  optional: value?.optional ?? config.optionalDefault,
  comment: value?.comment,
  files: value?.files ?? [],
  prospects: Object.fromEntries(
    getSlotDescriptors(config)
      .filter((slot) => slot.kind === 'prospects')
      .map((slot) => [
        slot.id,
        value?.prospects?.[slot.id] ?? emptySlot(slot),
      ])
  ),
});

const getSlotData = (data: DocumentCardData, slot: SlotDescriptor): DocumentCardSlotData => {
  if (slot.kind === 'prospects') {
    return data.prospects?.[slot.id] ?? emptySlot(slot);
  }
  return data;
};

const updateSlotData = (
  data: DocumentCardData,
  slot: SlotDescriptor,
  patch: Partial<DocumentCardSlotData>
): DocumentCardData => {
  if (slot.kind === 'prospects') {
    const current = getSlotData(data, slot);
    return {
      ...data,
      prospects: {
        ...data.prospects,
        [slot.id]: { ...current, ...patch },
      },
    };
  }

  return { ...data, ...patch };
};

const canUpload = (config: DocumentCardConfig): boolean =>
  config.category === 'nominativeUploadableByProspect' ||
  config.category === 'uploadableByProspect';

const formatCategory = (config: DocumentCardConfig): string =>
  [config.category, config.subcategory].filter(Boolean).join(' / ');

const getAcceptedFormats = (config: DocumentCardConfig): string[] =>
  config.file?.acceptedFormats?.map((format) => format.replace(/^\./, '').toLowerCase()) ?? [];

const getAcceptAttribute = (config: DocumentCardConfig): string | undefined => {
  const formats = getAcceptedFormats(config);
  return formats.length === 0 ? undefined : formats.map((format) => `.${format}`).join(',');
};

const getFileExtension = (fileName: string): string =>
  fileName.split('.').pop()?.toLowerCase() ?? '';

const validateSelectedFiles = (files: File[], config: DocumentCardConfig): string | null => {
  const maxSizeBytes = config.file?.maxSizeBytes;
  const acceptedFormats = getAcceptedFormats(config);

  return files
    .map((file) => {
      if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
        return `File exceeds the maximum size of ${maxSizeBytes} bytes`;
      }
      if (acceptedFormats.length > 0 && !acceptedFormats.includes(getFileExtension(file.name))) {
        return `File format must be one of: ${acceptedFormats.join(', ')}`;
      }
      return null;
    })
    .find((message): message is string => message !== null) ?? null;
};

const uploadDocumentFile = async (
  file: File,
  fieldId: string,
  config: DocumentCardConfig
): Promise<UploadedFileMeta> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fieldId', fieldId);
  formData.append('docType', config.docType);

  const response = await fetch(config.file?.uploadUrl ?? defaultUploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || `Upload failed with status ${response.status}`);
  }

  const result = await response.json();
  const url = result.url ?? result.fileUrl ?? result.path ?? '';

  return {
    id: result.id ?? url ?? file.name,
    url,
    filename: result.filename ?? file.name,
    uploadedAt: result.uploadedAt ?? new Date().toISOString(),
    sizeBytes: result.sizeBytes ?? file.size,
    contentType: result.contentType ?? file.type,
    clientConfirmationRequested: result.clientConfirmationRequested,
    frontOfficeName: result.frontOfficeName,
  };
};

const resolveDeleteUrl = (deleteUrl: string, fileReference: string): string =>
  deleteUrl.includes('{id}')
    ? deleteUrl.replace('{id}', encodeURIComponent(fileReference))
    : deleteUrl;

const deleteDocumentFile = async (
  file: UploadedFileMeta,
  config: DocumentCardConfig
): Promise<void> => {
  if (!config.file?.deleteUrl) {
    return;
  }

  const response = await fetch(resolveDeleteUrl(config.file.deleteUrl, file.id || file.url), {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Delete failed' }));
    throw new Error(error.error || `Delete failed with status ${response.status}`);
  }
};

export default function DocumentCard({
  field,
  form,
  isDisabled,
  required = false,
}: DocumentCardProps) {
  const config = field.document;
  const error = getErrorByPath(form.formState.errors, field.id) ?? form.formState.errors[field.id];
  const errorMessage = error?.message as string | undefined;
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const setFailure = useCallback((message: string) => {
    setDocumentError(message);
    form.setError(field.id, {
      type: 'document',
      message,
    });
  }, [field.id, form]);

  if (!config) {
    return null;
  }

  const slots = getSlotDescriptors(config);
  const accept = getAcceptAttribute(config);
  const isMultiple = config.file?.multiple ?? false;

  return (
    <div data-testid={`document-card-${field.id}`} className="space-y-3 rounded-md border bg-background p-4">
      <div className="space-y-1">
        <Label>
          {field.label}
          {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
        </Label>
        {field.description && (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {config.docType}
          {formatCategory(config) && ` - ${formatCategory(config)}`}
        </p>
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
                const inputId = `${field.id}-${slot.kind}-${slot.id}`;
                const slotKey = getSlotKey(slot);

                const handleFilesSelected = async (files: File[]) => {
                  if (files.length === 0) {
                    return;
                  }

                  const validationError = validateSelectedFiles(files, config);
                  if (validationError) {
                    setFailure(validationError);
                    return;
                  }

                  setUploadingSlot(slotKey);
                  setDocumentError(null);

                  try {
                    const uploadedFiles = await Promise.all(
                      files.map((file) => uploadDocumentFile(file, field.id, config))
                    );
                    const nextFiles = isMultiple
                      ? [...slotData.files, ...uploadedFiles]
                      : uploadedFiles.slice(0, 1);
                    controllerField.onChange(updateSlotData(value, slot, { files: nextFiles }));
                  } catch (err) {
                    setFailure(err instanceof Error ? err.message : 'Failed to upload document');
                  } finally {
                    setUploadingSlot(null);
                  }
                };

                const handleRemoveFile = async (file: UploadedFileMeta) => {
                  setUploadingSlot(slotKey);
                  setDocumentError(null);

                  try {
                    await deleteDocumentFile(file, config);
                    controllerField.onChange(updateSlotData(value, slot, {
                      files: slotData.files.filter((existing) => existing.id !== file.id),
                    }));
                  } catch (err) {
                    setFailure(err instanceof Error ? err.message : 'Failed to delete document');
                  } finally {
                    setUploadingSlot(null);
                  }
                };

                return (
                  <div key={`${slot.kind}-${slot.id}`} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                            disabled={isDisabled || config.requestedDisabled}
                            onChange={(event) => controllerField.onChange(updateSlotData(value, slot, {
                              requested: event.currentTarget.checked,
                            }))}
                          />
                          Requested
                        </label>
                        {config.allowOptional && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={slotData.optional ?? false}
                              disabled={isDisabled}
                              onChange={(event) => controllerField.onChange(updateSlotData(value, slot, {
                                optional: event.currentTarget.checked,
                              }))}
                            />
                            Optional
                          </label>
                        )}
                      </div>
                    </div>

                    {slotData.files.length > 0 && (
                      <ul className="space-y-1">
                        {slotData.files.map((file) => (
                          <li key={file.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-sm">
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-blue-600 hover:underline"
                            >
                              {file.frontOfficeName ?? file.filename}
                            </a>
                            {file.clientConfirmationRequested && (
                              <span className="text-xs text-muted-foreground">Confirmation requested</span>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isDisabled || uploadingSlot === slotKey}
                              onClick={() => handleRemoveFile(file)}
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {canUpload(config) && (
                      <Input
                        id={inputId}
                        type="file"
                        disabled={isDisabled || uploadingSlot === slotKey}
                        accept={accept}
                        multiple={isMultiple}
                        onChange={(event) => {
                          handleFilesSelected(Array.from(event.currentTarget.files ?? []));
                          event.currentTarget.value = '';
                        }}
                        className={cn(errorMessage && 'border-destructive focus-visible:ring-destructive')}
                        aria-invalid={errorMessage ? 'true' : 'false'}
                        aria-describedby={errorMessage ? `${field.id}-error` : undefined}
                      />
                    )}
                    {uploadingSlot === slotKey && (
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    )}
                  </div>
                );
              })}

              {config.allowComment && (
                <div className="space-y-1">
                  <Label htmlFor={`${field.id}-comment`}>Comment</Label>
                  <textarea
                    id={`${field.id}-comment`}
                    value={value.comment ?? ''}
                    disabled={isDisabled}
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
