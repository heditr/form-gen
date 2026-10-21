/**
 * Holds selection autoFill values for fields that are hidden when the option is chosen.
 * Flat fields stay out of form values until shown. Repeatable rows keep a source value
 * so a cleared selector can remove values the user never edited.
 */

export interface HiddenAutoFillHold {
  sourceFieldId: string;
  sourceValue: unknown;
  value: unknown;
}

export interface RepeatableAutoFillHold {
  sourceValue: unknown;
  values: Record<string, unknown>;
}

const flatHolds = new WeakMap<object, Map<string, HiddenAutoFillHold>>();
const rowHolds = new WeakMap<object, Map<string, RepeatableAutoFillHold>>();

function mapFor<T>(store: WeakMap<object, Map<string, T>>, form: object): Map<string, T> {
  const existing = store.get(form);
  if (existing) {
    return existing;
  }
  const created = new Map<string, T>();
  store.set(form, created);
  return created;
}

export function setHiddenAutoFillHold(
  form: object,
  fieldId: string,
  hold: HiddenAutoFillHold
): void {
  mapFor(flatHolds, form).set(fieldId, hold);
}

export function getHiddenAutoFillHold(
  form: object,
  fieldId: string
): HiddenAutoFillHold | undefined {
  return flatHolds.get(form)?.get(fieldId);
}

export function clearHiddenAutoFillHold(form: object, fieldId: string): void {
  flatHolds.get(form)?.delete(fieldId);
}

export function clearHiddenAutoFillHoldsForSource(form: object, sourceFieldId: string): void {
  const holds = flatHolds.get(form);
  if (!holds) {
    return;
  }
  for (const [fieldId, hold] of holds) {
    if (hold.sourceFieldId === sourceFieldId) {
      holds.delete(fieldId);
    }
  }
}

export function setRepeatableAutoFillHold(
  form: object,
  sourceFieldId: string,
  hold: RepeatableAutoFillHold
): void {
  mapFor(rowHolds, form).set(sourceFieldId, hold);
}

export function getRepeatableAutoFillHold(
  form: object,
  sourceFieldId: string
): RepeatableAutoFillHold | undefined {
  return rowHolds.get(form)?.get(sourceFieldId);
}

export function clearRepeatableAutoFillHold(form: object, sourceFieldId: string): void {
  rowHolds.get(form)?.delete(sourceFieldId);
}
