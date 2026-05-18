/**
 * Shadcn `Dialog` for one document field slot (`single` uses `slotId` `'document'`).
 *
 * Behaviour summary:
 * - **Session state** (`workingFiles`, metadata edits, session upload ids) lives here so FormInner remounts
 *   don’t discard in-flight uploads.
 * - **Validate** persists files + PATCH metadata deltas, deletes removed baseline attachments when
 *   `deleteUrl` exists, then `setValue` on the slot.
 * - **Cancel** deletes server objects created during this dialog session (`sessionUploadedIdsRef`)
 *   and drops unstaged edits; overlay close follows the cancel path as well.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { FieldDescriptor, GlobalFormDescriptor, UploadedFileMeta } from '@/types/form-descriptor';
import { resolveFieldByIdFromDescriptor } from '@/utils/document-field-resolve';
import {
  documentCategoryAllowsUpload,
  getAcceptAttribute,
  getSlotData,
  getSlotDescriptors,
  normalizeDocumentCardData,
  updateSlotData,
  validateSelectedFiles,
  type DocumentSlotDescriptor,
} from '@/utils/document-card-slots';
import {
  deleteDocumentFile,
  patchDocumentFileMetadata,
  uploadDocumentFile,
} from '@/utils/document-card-api';
import type { DocumentCardData } from '@/types/form-descriptor';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Arguments for {@link DocumentPopinContextValue.openDocumentPopin}. */
export interface DocumentUploadOpenPayload {
  /** RHF field id (`FieldDescriptor.id` for type `document`). */
  fieldId: string;
  /** Root slot `'document'` or a prospect row id when `layout === 'perProspect'`. */
  slotId: string;
  /** When true, disables Validate until at least one file sits in the working list (required fields). */
  requireFileForValidate?: boolean;
}

interface DocumentCardUploadPopinProps {
  open: DocumentUploadOpenPayload | null;
  onOpenChange: (open: boolean) => void;
  mergedDescriptor: GlobalFormDescriptor | null;
  /** Latest main RHF instance — survives remount when ref is refreshed from FormInner. */
  mainFormRef: RefObject<UseFormReturn<FieldValues> | null>;
}

/** Locates descriptor slot row for the given `slotId` string. */
function resolveSlot(descriptors: DocumentSlotDescriptor[], slotId: string): DocumentSlotDescriptor | null {
  return descriptors.find((s) => s.id === slotId) ?? null;
}

type MetadataEdits = Record<
  string,
  Partial<Pick<UploadedFileMeta, 'clientConfirmationRequested' | 'frontOfficeName'>>
>;

/** @internal Wired only from {@link DocumentPopinProvider}. */
export default function DocumentCardUploadPopin({
  open,
  onOpenChange,
  mergedDescriptor,
  mainFormRef,
}: DocumentCardUploadPopinProps) {
  const [workingFiles, setWorkingFiles] = useState<UploadedFileMeta[]>([]);
  const sessionUploadedIdsRef = useRef<Set<string>>(new Set());
  const baselineIdsRef = useRef<Set<string>>(new Set());
  const baselineMetaSnapshotRef = useRef<UploadedFileMeta[]>([]);

  const [metadataEdits, setMetadataEdits] = useState<MetadataEdits>({});
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const field = open
    ? resolveFieldByIdFromDescriptor(mergedDescriptor, open.fieldId)
    : null;
  const config = field?.document;

  const slot = useMemo(() => {
    if (!open || !config) return null;
    return resolveSlot(getSlotDescriptors(config), open.slotId);
  }, [open, config]);

  const hydrateFromMainForm = useCallback(() => {
    if (!open || !field || !config || !slot) return;

    const form = mainFormRef.current;
    if (!form) return;

    const raw = form.getValues(open.fieldId as never) as DocumentCardData | undefined;
    const value = normalizeDocumentCardData(config, raw);
    const slotData = getSlotData(value, slot);

    setWorkingFiles(slotData.files);
    sessionUploadedIdsRef.current = new Set();
    baselineIdsRef.current = new Set(slotData.files.map((f) => String(f.id)));
    baselineMetaSnapshotRef.current = slotData.files.map((f) => ({ ...f }));
    setMetadataEdits({});
    setPickerError(null);
    setBusy(false);
  }, [open, field, config, slot, mainFormRef]);

  const openTargetRef = useRef<string>('');

  useEffect(() => {
    if (!open || !field || !config || !slot) {
      if (!open) {
        openTargetRef.current = '';
      }
      return;
    }

    const targetKey = `${field.id}\u0001${slot.id}`;

    if (openTargetRef.current === targetKey) {
      return;
    }

    openTargetRef.current = targetKey;
    hydrateFromMainForm();
  }, [open, field, config, slot, hydrateFromMainForm]);

  const readonlySlot = !!(config && slotReadOnly(config));
  const allowUpload =
    !!(config && field && slot && documentCategoryAllowsUpload(config) && !readonlySlot);

  const allowRemoveRows = allowUpload;

  const showClientConfirmationToggle = !!(config?.allowClientConfirmation);
  const showFrontOfficeInput = !!(config?.allowFrontOfficeName);

  const accept = config ? getAcceptAttribute(config) : undefined;
  const multi = !!(config?.file?.multiple);

  const subtitle = open && slot ? `Slot: ${slot.label} · ${config!.docType}` : '';

  const mergeDisplayMeta = (file: UploadedFileMeta): UploadedFileMeta => {
    const e = metadataEdits[file.id];
    if (!e) return file;
    return {
      ...file,
      ...e,
    };
  };

  const handlePickFiles = async (filesList: FileList | null) => {
    const list = Array.from(filesList ?? []);
    if (!open || !config || !slot || list.length === 0) return;

    setPickerError(null);
    const err = validateSelectedFiles(list, config);
    if (err) {
      setPickerError(err);
      return;
    }

    const isMultiple = config.file?.multiple ?? false;
    setBusy(true);
    try {
      const uploads = await Promise.all(
        list.map((file) => uploadDocumentFile(file, open.fieldId, config))
      );
      const next = isMultiple ? [...workingFiles, ...uploads] : uploads.slice(0, 1);
      setWorkingFiles(next);
      for (const u of uploads) {
        sessionUploadedIdsRef.current.add(String(u.id));
      }
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveFileRow = async (file: UploadedFileMeta) => {
    if (!open || !config) return;

    const idStr = String(file.id);
    setBusy(true);

    try {
      if (config.file?.deleteUrl) {
        await deleteDocumentFile(file, config);
      }
      sessionUploadedIdsRef.current.delete(idStr);

      const nextWorking = workingFiles.filter((item) => String(item.id) !== idStr);
      setWorkingFiles(nextWorking);

      setMetadataEdits((prev) => {
        const next = { ...prev };
        delete next[file.id];
        return next;
      });
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const persistMetadataPatches = async (filesSnapshot: UploadedFileMeta[]) => {
    if (!config?.file?.metadataPatchUrl) return;

    const baselineIndex = baselineMetaSnapshotRef.current;

    await Promise.all(
      filesSnapshot.map(async (mergedFile) => {
        const edits = metadataEdits[mergedFile.id];
        if (!edits || Object.keys(edits).length === 0) return;

        const prior = baselineIndex.find((meta) => String(meta.id) === String(mergedFile.id));

        const patchBody: Partial<Pick<UploadedFileMeta, 'clientConfirmationRequested' | 'frontOfficeName'>> = {};

        if (
          edits.clientConfirmationRequested !== undefined &&
          edits.clientConfirmationRequested !== prior?.clientConfirmationRequested
        ) {
          patchBody.clientConfirmationRequested = edits.clientConfirmationRequested;
        }

        if (
          edits.frontOfficeName !== undefined &&
          edits.frontOfficeName !== prior?.frontOfficeName
        ) {
          patchBody.frontOfficeName = edits.frontOfficeName;
        }

        if (Object.keys(patchBody).length === 0) return;

        await patchDocumentFileMetadata(mergedFile.id, patchBody, config);
      })
    );
  };

  const handleValidate = async () => {
    if (!open || !config || !slot || !field) return;
    const form = mainFormRef.current;
    if (!form) return;

    const requireFiles = !!(open.requireFileForValidate ?? false);

    const mergedSnap = workingFiles.map(mergeDisplayMeta);

    if (requireFiles && mergedSnap.length === 0) return;

    setBusy(true);

    try {
      await persistMetadataPatches(mergedSnap);

      const removals = [...baselineIdsRef.current].filter(
        (baselineId) => !mergedSnap.some((f) => String(f.id) === baselineId)
      );

      for (const staleId of removals) {
        const prevFile =
          baselineMetaSnapshotRef.current.find((f) => String(f.id) === staleId)
          ?? { id: staleId, filename: staleId } as UploadedFileMeta;
        if (config.file?.deleteUrl) {
          await deleteDocumentFile({ ...prevFile, url: prevFile.url ?? '' } as UploadedFileMeta, config);
        }
      }

      const raw = form.getValues(open.fieldId as never) as DocumentCardData | undefined;
      const value = normalizeDocumentCardData(config, raw);

      form.setValue(
        open.fieldId as never,
        updateSlotData(value, slot, { files: mergedSnap }) as never,
        { shouldDirty: true, shouldTouch: true, shouldValidate: true }
      );

      sessionUploadedIdsRef.current = new Set();
      onOpenChange(false);
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : 'Validate failed');
    } finally {
      setBusy(false);
    }
  };

  const cancelSessionDeletesAndClose = async () => {
    if (!config) {
      onOpenChange(false);
      return;
    }

    setBusy(true);
    try {
      const uploadsToDrop = [...sessionUploadedIdsRef.current];
      await Promise.all(
        uploadsToDrop.map(async (id) => {
          const fileStub =
            workingFiles.find((entry) => String(entry.id) === id)
            ?? { id, filename: id, uploadedAt: new Date().toISOString(), url: '' };

          await deleteDocumentFile(fileStub as UploadedFileMeta, config);
        })
      );
    } catch {
      // Best-effort cancel cleanup
    } finally {
      sessionUploadedIdsRef.current = new Set();
      setMetadataEdits({});
      setWorkingFiles([]);
      setBusy(false);
      onOpenChange(false);
    }
  };

  const handleCancel = async () => {
    await cancelSessionDeletesAndClose();
  };

  const title = field?.label ?? 'Documents';

  const validateDisabled =
    busy ||
    (open?.requireFileForValidate && workingFiles.length === 0);

  return (
    <Dialog open={!!open && !!slot && !!config} onOpenChange={(next) => {
      if (!next) {
        void cancelSessionDeletesAndClose();
      }
    }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            Upload documents — {title}
          </DialogTitle>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
          {workingFiles.map((fileRaw) => {
            const merged = mergeDisplayMeta(fileRaw);
            return (
              <div
                key={fileRaw.id}
                className="space-y-2 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {merged.frontOfficeName ?? merged.filename}
                  </span>
                  {merged.url ? (
                    <a
                      href={merged.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary underline"
                    >
                      Open ↗
                    </a>
                  ) : null}
                  {allowRemoveRows ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy || !allowUpload}
                      onClick={() => handleRemoveFileRow(fileRaw)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                {(showClientConfirmationToggle || showFrontOfficeInput) && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    {showClientConfirmationToggle && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={busy || !allowUpload}
                          checked={!!merged.clientConfirmationRequested}
                          onChange={(evt) =>
                            setMetadataEdits((prev) => ({
                              ...prev,
                              [fileRaw.id]: {
                                ...(prev[fileRaw.id] ?? {}),
                                clientConfirmationRequested: evt.currentTarget.checked,
                              },
                            }))}
                        />
                        Request client confirmation
                      </label>
                    )}
                    {showFrontOfficeInput && (
                      <div className="flex flex-1 flex-col gap-1 sm:max-w-[18rem]">
                        <Label className="text-xs text-muted-foreground">Front-office name</Label>
                        <Input
                          value={merged.frontOfficeName ?? ''}
                          disabled={busy || !allowUpload}
                          onChange={(evt) =>
                            setMetadataEdits((prev) => ({
                              ...prev,
                              [fileRaw.id]: {
                                ...(prev[fileRaw.id] ?? {}),
                                frontOfficeName: evt.currentTarget.value,
                              },
                            }))}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1">
          {allowUpload ? (
            <Input
              type="file"
              multiple={multi}
              accept={accept}
              disabled={busy}
              className={pickerError ? 'border-destructive' : ''}
              onChange={(evt) => {
                void handlePickFiles(evt.target.files);
                evt.target.value = '';
              }}
            />
          ) : null}
          {config?.file?.maxSizeBytes && (
            <p className="text-xs text-muted-foreground">
              {accept ? `${accept.replace(/,/g, ', ')} · ` : ''}
              max {Math.round(config.file.maxSizeBytes / 1_000_000)}
              MB
            </p>
          )}
          {pickerError ? (
            <p className="text-sm text-destructive" role="alert">{pickerError}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => handleCancel()}>
            Cancel
          </Button>
          <Button type="button" disabled={validateDisabled || busy || !open} onClick={() => handleValidate()}>
            Validate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Determines view-only/upload-disabled treatment inside the modal (beyond global `isDisabled`).
 * Extend here when descriptors gain explicit editable flags matching backend parity.
 */
function slotReadOnly(config: NonNullable<FieldDescriptor['document']>): boolean {
  if (config.category === 'prefilledOnly') return true;

  return false;
}
