/**
 * Pure helpers used by {@link DocumentCard} for UX rules and reconciliation when backend prospect
 * rows change (`perProspect` layout).
 */

import type { DocumentCardData, DocumentCardProspectConfig } from '@/types/form-descriptor';
import {
  emptyDocumentSlot,
  getSlotData,
  updateSlotData,
  type DocumentSlotDescriptor,
} from '@/utils/document-card-slots';

/** Predicate: lowering “requested” should only succeed when no files remain in that slot. */
export function canTurnOffRequestedForSlot(slotFilesLength: number): boolean {
  return slotFilesLength === 0;
}

/**
 * Rebuilds `prospects` map from descriptor order: retains existing rows where ids overlap and
 * seeds new ids with defaults. Drops ids no longer configured (caller should run when prospect list changes).
 *
 * Returns the original `value` reference when nothing structural changed (stable for comparison).
 */
export function reconcileDocumentProspectsForConfig(
  value: DocumentCardData,
  prospectConfigs: DocumentCardProspectConfig[]
): DocumentCardData {
  const prev = value.prospects ?? {};

  const nextProspects: NonNullable<DocumentCardData['prospects']> = {};

  for (const p of prospectConfigs) {
    nextProspects[p.id] =
      prev[p.id] ??
      emptyDocumentSlot({
        requestedDefault: p.requestedDefault,
        optionalDefault: p.optionalDefault,
        filesDefault: p.defaultFiles,
      });
  }

  const sameKeys =
    Object.keys(prev).length === prospectConfigs.length &&
    prospectConfigs.every((p) => p.id in prev);

  if (
    sameKeys &&
    prospectConfigs.every((p) => prev[p.id] === nextProspects[p.id])
  ) {
    return value;
  }

  return { ...value, prospects: nextProspects };
}

/**
 * Toggles `requested` for a slot. Returns `null` when clearing requested is blocked because the slot
 * still has files — keeps UX aligned with backend “cannot un-request while attachments exist”.
 */
export function applyRequestedToSlot(params: {
  data: DocumentCardData;
  slot: DocumentSlotDescriptor;
  requested: boolean;
}): DocumentCardData | null {
  const { data, slot, requested } = params;
  const slotData = getSlotData(data, slot);

  if (!requested && slotData.files.length > 0) {
    return null;
  }

  return updateSlotData(data, slot, { requested });
}
