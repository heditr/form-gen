/**
 * Finds the first descriptor field matching `fieldId` by scanning blocks in declaration order.
 * Used by the upload popin to resolve `{ fieldId, slotId }` opened from the runtime form alone.
 */

import type { FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';

/**
 * @returns Matching field if present anywhere in {@link GlobalFormDescriptor.blocks}, else `null`.
 */
export function resolveFieldByIdFromDescriptor(
  descriptor: GlobalFormDescriptor | null | undefined,
  fieldId: string
): FieldDescriptor | null {
  if (!descriptor) {
    return null;
  }

  for (const block of descriptor.blocks) {
    const match = block.fields.find((field) => field.id === fieldId);
    if (match) {
      return match;
    }
  }

  return null;
}
