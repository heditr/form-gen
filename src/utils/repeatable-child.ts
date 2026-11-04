/**
 * Repeatable child rows: pure helpers.
 *
 * A root row of an inline repeatable block may hold one child list of the same
 * group (see RepeatableChildConfig). A row opens that list when its trigger field
 * holds a trigger value and is visible. Nothing here touches form state.
 */

import type {
  BlockDescriptor,
  FieldDescriptor,
  FormData,
  GlobalFormDescriptor,
} from '@/types/form-descriptor';
import { evaluateDefaultValue } from './default-value-evaluator';
import { evaluateHiddenStatus } from './template-evaluator';
import type { FormContext } from './template-evaluator';
import {
  defaultStatusContext,
  getNestedValue,
  setNestedValue,
  shouldSkipHiddenDefault,
} from './row-values';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (target: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

/** Form path of the child array held by a root row, for example `businessSectors.0.subsectors`. */
export const childArrayPath = ({
  groupId,
  rootIndex,
  property,
}: {
  groupId: string;
  rootIndex: number;
  property: string;
}): string => `${groupId}.${rootIndex}.${property}`;

/** Form path of one child row, for example `businessSectors.0.subsectors.1`. */
export const childRowPath = ({
  groupId,
  rootIndex,
  property,
  childIndex,
}: {
  groupId: string;
  rootIndex: number;
  property: string;
  childIndex: number;
}): string => `${childArrayPath({ groupId, rootIndex, property })}.${childIndex}`;

/**
 * Rewrite Handlebars data variables (`@index`, `@first`, `@last`) to plain context keys.
 * Row templates read them as `index`, `first` and `last` because data variables are not
 * available in a flat context.
 */
export const withRepeatableMeta = (template: string | undefined): string | undefined =>
  template
    ? template.replaceAll('@index', 'index').replaceAll('@first', 'first').replaceAll('@last', 'last')
    : template;

/**
 * Template context of one row: the group, the row values, and the repeatable meta.
 * `depth` and `parentIndex` are added only when given, so groups without a child level
 * keep their existing context.
 */
export const buildRowContext = ({
  formContext,
  groupId,
  rows,
  groupRows = rows,
  index,
  depth,
  parentIndex,
}: {
  formContext: FormContext;
  groupId: string;
  rows: unknown[] | undefined;
  /** Rows exposed under the group key. Child rows pass the root rows here. */
  groupRows?: unknown[] | undefined;
  index: number;
  depth?: number;
  parentIndex?: number;
}): FormContext =>
  ({
    ...formContext,
    [groupId]: groupRows,
    ...(isRow(rows?.[index]) ? (rows?.[index] as Row) : {}),
    index,
    first: index === 0,
    last: index === (rows?.length ?? 0) - 1,
    ...(depth !== undefined ? { depth } : {}),
    ...(parentIndex !== undefined ? { parentIndex } : {}),
  }) as FormContext;

const baseFieldIdOf = (field: FieldDescriptor, groupId: string): string =>
  field.id.startsWith(`${groupId}.`) ? field.id.slice(groupId.length + 1) : field.id;

const groupIdOf = (block: BlockDescriptor): string | undefined =>
  block.fields.find((field) => field.repeatableGroupId)?.repeatableGroupId;

/**
 * Does this root row open the child level?
 * True when the trigger field holds a trigger value and is not hidden for the row.
 * `rowContext` is the row's template context (see buildRowContext).
 */
export function rowOpensChild(row: Row, block: BlockDescriptor, rowContext: FormContext = {}): boolean {
  const config = block.repeatableChild;
  const groupId = groupIdOf(block);
  if (!config || !groupId) {
    return false;
  }

  const value = row[config.triggerField];
  if (typeof value !== 'string' || !config.triggerValues.includes(value)) {
    return false;
  }

  const triggerField = block.fields.find(
    (field) => baseFieldIdOf(field, groupId) === config.triggerField
  );
  if (!triggerField?.status?.hidden) {
    return true;
  }

  const hiddenTemplate = withRepeatableMeta(triggerField.status.hidden);
  return !evaluateHiddenStatus(
    { ...triggerField, status: { ...triggerField.status, hidden: hiddenTemplate } },
    { ...rowContext, ...row } as FormContext
  );
}

const pruneRows = (
  rows: unknown[],
  block: BlockDescriptor,
  groupId: string,
  formContext: FormContext
): unknown[] => {
  const property = block.repeatableChild?.property ?? '';
  const pruned = rows.map((row, index) => {
    if (!isRow(row) || !hasOwn(row, property)) {
      return row;
    }
    const rowContext = buildRowContext({ formContext, groupId, rows, index });
    if (rowOpensChild(row, block, rowContext)) {
      return row;
    }
    return Object.fromEntries(Object.entries(row).filter(([key]) => key !== property));
  });
  return pruned.every((row, index) => row === rows[index]) ? rows : pruned;
};

/**
 * Remove child lists from root rows that do not open the child level.
 * Returns the input object when nothing needs removing. Hidden blocks are left
 * alone so unhiding restores their values.
 */
export function pruneInactiveChildLists<T extends Partial<FormData>>(
  values: T,
  descriptor: GlobalFormDescriptor | null,
  formContext: FormContext = {}
): T {
  if (!descriptor) {
    return values;
  }
  const source = values as Record<string, unknown>;

  const next = descriptor.blocks
    .filter((block) => block.repeatableChild && !evaluateHiddenStatus(block, formContext))
    .reduce<Record<string, unknown>>((acc, block) => {
      const groupId = groupIdOf(block);
      const rows = groupId ? acc[groupId] : undefined;
      if (!groupId || !Array.isArray(rows)) {
        return acc;
      }
      const prunedRows = pruneRows(rows, block, groupId, formContext);
      return prunedRows === rows ? acc : { ...acc, [groupId]: prunedRows };
    }, source);

  return next === source ? values : (next as T);
}

/**
 * Build child rows from the child list of a source row, copying by base field id.
 * Field defaults that use `@index` are not evaluated: they are bound to the root list
 * and would read the wrong rows. Returns undefined when the source row has no child rows.
 */
export function seedChildRows({
  sourceRow,
  fields,
  groupId,
  property,
  formContext,
}: {
  sourceRow: Row;
  fields: FieldDescriptor[];
  groupId: string;
  property: string;
  formContext: FormContext;
}): Row[] | undefined {
  const children = sourceRow[property];
  if (!Array.isArray(children) || children.length === 0) {
    return undefined;
  }

  return children.filter(isRow).map((child) =>
    fields
      .filter((field) => field.type !== 'button')
      .reduce<Row>((built, field) => {
        if (shouldSkipHiddenDefault(field, defaultStatusContext(formContext, child, built))) {
          return built;
        }
        const baseId = baseFieldIdOf(field, groupId);
        const raw = getNestedValue(child, baseId);
        setNestedValue(built, baseId, raw !== undefined ? raw : '');
        return built;
      }, {})
  );
}

const emptyValueOf = (field: FieldDescriptor): unknown => {
  switch (field.type) {
    case 'checkbox':
      return false;
    case 'number':
      return 0;
    case 'file':
      return null;
    case 'document':
      return { requested: false, files: [] };
    default:
      return '';
  }
};

/**
 * Values of a row added by the user, keyed by base field id.
 * A field default is evaluated with the form context; `@index` stays unbound.
 */
export function buildNewRowValues({
  fields,
  groupId,
  formContext,
}: {
  fields: FieldDescriptor[];
  groupId: string;
  formContext: FormContext;
}): Row {
  return Object.fromEntries(
    fields
      .filter((field) => field.type !== 'button')
      .map((field) => [
        baseFieldIdOf(field, groupId),
        field.defaultValue !== undefined
          ? evaluateDefaultValue(field.defaultValue, field.type, formContext)
          : emptyValueOf(field),
      ])
  );
}
