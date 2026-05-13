/**
 * Surgical merge of case documents into a descriptor + matching formData slices.
 * Used by documents-rehydration (discriminant-driven) so dynamic document cards
 * survive the next rules merge (rules merge uses globalDescriptor as base).
 */

import type { BlockDescriptor, FieldDescriptor, FormData, GlobalFormDescriptor } from '@/types/form-descriptor';
import {
  buildDocumentCardFields,
  type BuildDocumentCardFieldsOptions,
  type CaseDocumentsEntry,
} from '@/utils/document-card-builder';

export const defaultDocumentsBlockId = 'documents';

export function collectDocumentFieldIds(descriptor: GlobalFormDescriptor): Set<string> {
  const ids = new Set<string>();
  for (const block of descriptor.blocks) {
    for (const field of block.fields ?? []) {
      if (field.type === 'document') {
        ids.add(field.id);
      }
    }
  }
  return ids;
}

export interface ApplyDocumentsToDescriptorOptions {
  fallbackDocumentsBlockId?: string;
  buildOptions?: BuildDocumentCardFieldsOptions;
}

function stripDocumentFields(blocks: BlockDescriptor[]): BlockDescriptor[] {
  return blocks.map((block) => ({
    ...block,
    fields: (block.fields ?? []).filter((f) => f.type !== 'document'),
  }));
}

function groupBuiltFieldsByTargetBlock(
  documents: CaseDocumentsEntry[],
  builtFields: FieldDescriptor[],
  fallbackBlockId: string
): Map<string, FieldDescriptor[]> {
  const map = new Map<string, FieldDescriptor[]>();
  for (let i = 0; i < builtFields.length; i++) {
    const field = builtFields[i];
    const entry = documents[i];
    const blockId = entry?.targetBlockId ?? fallbackBlockId;
    const list = map.get(blockId) ?? [];
    list.push(field);
    map.set(blockId, list);
  }
  return map;
}

/**
 * Replaces every `document` field in the descriptor with the built fields from `documents`,
 * routing each card to `targetBlockId` or `fallbackDocumentsBlockId`.
 * Creates a `fallbackDocumentsBlockId` block when docs target a missing block and no fallback exists.
 */
export function mergeDocumentsIntoDescriptor(
  descriptor: GlobalFormDescriptor,
  documents: CaseDocumentsEntry[],
  options: ApplyDocumentsToDescriptorOptions = {}
): GlobalFormDescriptor {
  const fallback = options.fallbackDocumentsBlockId ?? defaultDocumentsBlockId;
  const builtFields = buildDocumentCardFields(documents, options.buildOptions);
  const byBlock = groupBuiltFieldsByTargetBlock(documents, builtFields, fallback);

  const stripped = stripDocumentFields(descriptor.blocks);

  for (const [blockId, docFields] of byBlock) {
    let idx = stripped.findIndex((b) => b.id === blockId);
    if (idx < 0) {
      idx = stripped.findIndex((b) => b.id === fallback);
    }
    if (idx < 0) {
      stripped.push({
        id: fallback,
        title: 'Documents',
        fields: [...docFields],
      });
      continue;
    }
    const block = stripped[idx];
    stripped[idx] = {
      ...block,
      fields: [...(block.fields ?? []), ...docFields],
    };
  }

  return {
    ...descriptor,
    blocks: stripped,
  };
}

/**
 * Drops removed document slices and seeds values for the current documents list (backend authority).
 */
export function mergeDocumentsIntoFormData(
  formData: Partial<FormData>,
  previousDocumentIds: Set<string>,
  builtFields: FieldDescriptor[]
): Partial<FormData> {
  const next = { ...formData };
  const nextIds = new Set(builtFields.map((f) => f.id));

  for (const id of previousDocumentIds) {
    if (!nextIds.has(id)) {
      delete next[id];
    }
  }

  for (const field of builtFields) {
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      next[field.id] = field.defaultValue as FormData[keyof FormData];
    }
  }

  return next;
}

export function applyDocumentsRehydrationMerge({
  descriptor,
  formData,
  documents,
  options,
}: {
  descriptor: GlobalFormDescriptor;
  formData: Partial<FormData>;
  documents: CaseDocumentsEntry[];
  options?: ApplyDocumentsToDescriptorOptions;
}): { descriptor: GlobalFormDescriptor; formData: Partial<FormData>; builtFields: FieldDescriptor[] } {
  const builtFields = buildDocumentCardFields(documents, options?.buildOptions);
  const previousDocIds = collectDocumentFieldIds(descriptor);
  const nextDescriptor = mergeDocumentsIntoDescriptor(descriptor, documents, options);
  const nextFormData = mergeDocumentsIntoFormData(formData, previousDocIds, builtFields);

  return {
    descriptor: nextDescriptor,
    formData: nextFormData,
    builtFields,
  };
}
