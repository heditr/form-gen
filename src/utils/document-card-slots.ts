/**
 * Shared slot model for document fields: converts {@link DocumentCardConfig} into
 * one or more logical rows (`root` for `single`, or one per prospect). Used by both
 * `DocumentCard` and `DocumentCardUploadPopin` so slot identity and patching stay aligned.
 */

import type {
  DocumentCardConfig,
  DocumentCardData,
  DocumentCardProspectConfig,
  DocumentCardSlotData,
  UploadedFileMeta,
} from '@/types/form-descriptor';
import {
  buildAcceptAttributeFromFormats,
  fileMatchesAcceptedFormats,
} from '@/utils/accepted-file-formats';

/** Discriminates root card value (`DocumentCardData`) from per-prospect map keys. */
export type DocumentSlotKind = 'root' | 'prospects';

/** One upload row shown in the UI; `id` is `'document'` for single layout else a prospect id. */
export interface DocumentSlotDescriptor {
  id: string;
  label: string;
  kind: DocumentSlotKind;
  requestedDefault?: boolean;
  optionalDefault?: boolean;
  filesDefault?: UploadedFileMeta[];
}

/** Stable React key fragment for debugging and test hooks. */
export const getSlotKey = (slot: DocumentSlotDescriptor): string => `${slot.kind}:${slot.id}`;

/** Default {@link DocumentCardSlotData} for a slot descriptor (no stored value yet). */
export const emptyDocumentSlot = ({
  requestedDefault = false,
  optionalDefault = false,
  filesDefault = [],
}: Pick<DocumentSlotDescriptor, 'requestedDefault' | 'optionalDefault' | 'filesDefault'>): DocumentCardSlotData => ({
  requested: requestedDefault,
  optional: optionalDefault,
  files: filesDefault,
});

/** Lists slots from layout: one root slot (`id: 'document'`) or one row per configured prospect. */
export const getSlotDescriptors = (config: DocumentCardConfig): DocumentSlotDescriptor[] => {
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

/**
 * Fills missing root/prospect defaults from the descriptor so consumers always see a complete
 * {@link DocumentCardData} shape (needed before reading or patching a slot).
 */
export const normalizeDocumentCardData = (
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
        value?.prospects?.[slot.id] ?? emptyDocumentSlot(slot),
      ])
  ),
});

/** Returns the persisted slot slice (root rows use top-level {@link DocumentCardData} fields). */
export const getSlotData = (data: DocumentCardData, slot: DocumentSlotDescriptor): DocumentCardSlotData => {
  if (slot.kind === 'prospects') {
    return data.prospects?.[slot.id] ?? emptyDocumentSlot(slot);
  }
  return data;
};

/** Immutable merge of partial slot fields into {@link DocumentCardData} at the correct path. */
export const updateSlotData = (
  data: DocumentCardData,
  slot: DocumentSlotDescriptor,
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

/** Whether the backend category allows prospect uploads (`prefilledOnly` / `agnostic` do not). */
export const documentCategoryAllowsUpload = (config: DocumentCardConfig): boolean =>
  config.category === 'nominativeUploadableByProspect' ||
  config.category === 'uploadableByProspect';

const formatCategory = (config: DocumentCardConfig): string =>
  [config.category, config.subcategory].filter(Boolean).join(' / ');

/** Compact subtitle line combining `docType` and optional category/subcategory labels. */
export function formatSlotCategorySubtitle(config: DocumentCardConfig): string {
  const category = formatCategory(config);
  return category ? `${config.docType} - ${category}` : config.docType;
}

/**
 * Joins prospect ids into a delimiter-safe string so `useEffect`/memo deps fire only when
 * the backend person list identity changes (avoids churn on unrelated object references).
 */
export function prospectConfigIdsKey(prospects: DocumentCardProspectConfig[] | undefined): string {
  return (prospects ?? []).map((p) => p.id).join('\u0001');
}

/** Value for `<input accept="…">` (MIME types and/or `.{ext}`) or `undefined` if unrestricted. */
export const getAcceptAttribute = (config: DocumentCardConfig): string | undefined =>
  buildAcceptAttributeFromFormats(config.file?.acceptedFormats ?? []);

/** Client-side guard before POST; returns first violation message or `null` when all files pass. */
export const validateSelectedFiles = (files: File[], config: DocumentCardConfig): string | null => {
  const maxSizeBytes = config.file?.maxSizeBytes;
  const acceptedFormats = config.file?.acceptedFormats ?? [];

  return files
    .map((file) => {
      if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
        return `File exceeds the maximum size of ${maxSizeBytes} bytes`;
      }
      if (acceptedFormats.length > 0 && !fileMatchesAcceptedFormats(file, acceptedFormats)) {
        return `File format must be one of: ${acceptedFormats.join(', ')}`;
      }
      return null;
    })
    .find((message): message is string => message !== null) ?? null;
};
