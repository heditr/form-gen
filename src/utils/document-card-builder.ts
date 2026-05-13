/**
 * Build `FieldDescriptor` entries of type `document` from a case documents API payload.
 * Pure transform for bootstrap and documents-rehydration pipelines.
 */

import type {
  DocumentCardConfig,
  DocumentCardData,
  DocumentCardLayout,
  DocumentCardProspectConfig,
  DocumentCardSlotData,
  DocumentCategory,
  FieldDescriptor,
  FileFieldConfig,
  UploadedFileMeta,
  ValidationRule,
} from '@/types/form-descriptor';

/** One slot row returned for a document card (aligned with GET /cases/:id/documents). */
export interface CaseDocumentsSlotPayload {
  label?: string;
  requested?: boolean;
  optional?: boolean;
  files?: UploadedFileMeta[];
}

/** One document card entry from the documents list endpoint. */
export interface CaseDocumentsEntry {
  documentType: string;
  /** Host block id for surgical placement when merging into the descriptor (fallback `documents`). */
  targetBlockId?: string;
  label?: string;
  description?: string;
  category: DocumentCategory;
  subcategory?: string;
  layout?: DocumentCardLayout;
  requiredByAgent?: boolean;
  requestedDefault?: boolean;
  requestedDisabled?: boolean;
  optionalDefault?: boolean;
  allowOptional?: boolean;
  allowComment?: boolean;
  allowClientConfirmation?: boolean;
  allowFrontOfficeName?: boolean;
  file?: FileFieldConfig;
  /** When set, prospect rows are resolved from case context at runtime (see DocumentCardConfig). */
  prospectSource?: string;
  /** Static prospect definitions; takes precedence over deriving from `slots` when non-empty. */
  prospects?: DocumentCardProspectConfig[];
  slots: Record<string, CaseDocumentsSlotPayload>;
  validation?: ValidationRule[] | string;
}

/** Options for {@link buildDocumentCardFields}. */
export interface BuildDocumentCardFieldsOptions {
  /** Shallow field patches keyed by `documentType` (matches `FieldDescriptor.id`). */
  fieldOverrides?: Partial<Record<string, Partial<FieldDescriptor>>>;
}

const singleSlotKeys = ['main', 'document'] as const;

/**
 * Chooses `single` vs `perProspect` from explicit layout, prospect source, or slot count.
 */
function resolveLayout(entry: CaseDocumentsEntry): DocumentCardLayout {
  if (entry.layout) {
    return entry.layout;
  }
  if (entry.prospectSource) {
    return 'perProspect';
  }
  if (entry.prospects && entry.prospects.length > 0) {
    return 'perProspect';
  }
  const keys = Object.keys(entry.slots);
  if (keys.length > 1) {
    return 'perProspect';
  }
  return 'single';
}

/**
 * Builds static prospect config from API slot keys (id, label, defaults, seeded files).
 */
function prospectsFromSlots(
  slots: Record<string, CaseDocumentsSlotPayload>
): DocumentCardProspectConfig[] {
  return Object.entries(slots).map(([id, slot]) => ({
    id,
    name: slot.label ?? id,
    requestedDefault: slot.requested,
    optionalDefault: slot.optional,
    defaultFiles: slot.files,
  }));
}

/**
 * Resolves the primary slot for `single` layout: `main`, then `document`, else first slot.
 */
function pickMainSlot(
  slots: Record<string, CaseDocumentsSlotPayload>
): CaseDocumentsSlotPayload | undefined {
  for (const key of singleSlotKeys) {
    if (slots[key] !== undefined) {
      return slots[key];
    }
  }
  const values = Object.values(slots);
  return values[0];
}

/**
 * Assembles {@link DocumentCardConfig} from one API entry; omits `prospectSource` when not per-prospect.
 */
function buildDocumentConfig(
  entry: CaseDocumentsEntry,
  layout: DocumentCardLayout
): DocumentCardConfig {
  const prospects: DocumentCardProspectConfig[] | undefined =
    layout === 'single'
      ? undefined
      : entry.prospects && entry.prospects.length > 0
        ? entry.prospects
        : entry.prospectSource
          ? undefined
          : prospectsFromSlots(entry.slots);

  return {
    docType: entry.documentType,
    category: entry.category,
    subcategory: entry.subcategory,
    layout,
    requiredByAgent: entry.requiredByAgent,
    requestedDefault: entry.requestedDefault,
    requestedDisabled: entry.requestedDisabled,
    optionalDefault: entry.optionalDefault,
    allowOptional: entry.allowOptional ?? true,
    allowComment: entry.allowComment,
    allowClientConfirmation: entry.allowClientConfirmation,
    allowFrontOfficeName: entry.allowFrontOfficeName,
    file: entry.file,
    prospects,
    prospectSource: layout === 'perProspect' ? entry.prospectSource : undefined,
  };
}

/**
 * Seeds RHF `defaultValue` / saved slice: one root slot for `single`, or `prospects` map + empty root files.
 */
function buildDocumentDefaultValue(
  entry: CaseDocumentsEntry,
  layout: DocumentCardLayout
): DocumentCardData {
  if (layout === 'single') {
    const main = pickMainSlot(entry.slots);
    const slotOptional = main?.optional;
    const optionalResolved =
      slotOptional !== undefined ? slotOptional : entry.optionalDefault;

    return {
      requested: main?.requested ?? entry.requestedDefault ?? false,
      ...(optionalResolved !== undefined ? { optional: optionalResolved } : {}),
      files: main?.files ?? [],
    };
  }

  const prospects: Record<string, DocumentCardSlotData> = Object.fromEntries(
    Object.entries(entry.slots).map(([id, slot]) => {
      const opt = slot.optional;
      return [
        id,
        {
          requested: slot.requested ?? false,
          ...(opt !== undefined ? { optional: opt } : {}),
          files: slot.files ?? [],
        },
      ];
    })
  );

  const rootOptional = entry.optionalDefault;

  return {
    requested: entry.requestedDefault ?? false,
    ...(rootOptional !== undefined ? { optional: rootOptional } : {}),
    files: [],
    prospects,
  };
}

/**
 * Turns a documents list response into `document` fields with config and seeded form defaults.
 *
 * @param documents - Entries from e.g. `GET /api/cases/:caseId/documents`
 * @param options - Optional shallow overrides per `documentType`
 * @returns Field descriptors ready to merge into a block’s `fields`
 */
export function buildDocumentCardFields(
  documents: CaseDocumentsEntry[],
  options: BuildDocumentCardFieldsOptions = {}
): FieldDescriptor[] {
  return documents.map((entry) => {
    const layout = resolveLayout(entry);
    const base: FieldDescriptor = {
      id: entry.documentType,
      type: 'document',
      label: entry.label ?? entry.documentType,
      description: entry.description,
      validation: entry.validation ?? [],
      document: buildDocumentConfig(entry, layout),
      defaultValue: buildDocumentDefaultValue(entry, layout),
    };
    const overrides = options.fieldOverrides?.[entry.documentType];
    return overrides ? { ...base, ...overrides } : base;
  });
}
