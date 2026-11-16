/**
 * Sum a named field across one repeatable list.
 *
 * Missing and non-numeric values count as zero. An empty list sums to zero.
 * The root list and a child list are summed separately by the caller.
 */

import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';

const numericValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/** The single progress field on a block, when the descriptor has one. */
export function progressFieldOf(block: BlockDescriptor): FieldDescriptor | undefined {
  return block.fields.find((field) => field.repeatOnce === true && field.type === 'progress');
}

/** Sum `fieldId` on each row. Nested child arrays on those rows are ignored. */
export function sumRowField(rows: unknown[] | undefined, fieldId: string): number {
  if (!fieldId || !Array.isArray(rows)) {
    return 0;
  }
  return rows.reduce<number>((total, row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return total;
    }
    return total + numericValue((row as Record<string, unknown>)[fieldId]);
  }, 0);
}

/** Bar width as a percent of `max`, clamped to 0–100. The raw sum is shown separately. */
export function progressFillPercent(sum: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(sum)) {
    return 0;
  }
  return Math.min(100, Math.max(0, (sum / max) * 100));
}
