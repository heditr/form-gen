/**
 * Orders a plain block's fields and the blocks it nests.
 * Nested blocks stay outside the parent field grid.
 */

import type { BlockDescriptor, FieldDescriptor, NestedBlockReference } from '@/types/form-descriptor';

export type NestedPlacement =
  | { kind: 'nested'; block: BlockDescriptor }
  | { kind: 'fields'; fields: FieldDescriptor[] };

type PlacementNode =
  | { kind: 'nested'; block: BlockDescriptor }
  | { kind: 'field'; field: FieldDescriptor };

const resolveNested = (
  entry: NestedBlockReference,
  block: BlockDescriptor,
  blocksById: ReadonlyMap<string, BlockDescriptor>,
  ancestorIds: ReadonlySet<string>
): BlockDescriptor | undefined => {
  const nested = blocksById.get(entry.blockId);
  if (!nested || nested.id === block.id || ancestorIds.has(nested.id)) {
    return undefined;
  }
  return nested;
};

/**
 * Walk parent fields in order, inserting each nested block at its one placement.
 * Entries that share a slot keep `nestedBlocks` array order.
 */
export function buildPlainNestedPlacement({
  block,
  fields,
  blocksById,
  ancestorIds,
}: {
  block: BlockDescriptor;
  fields: FieldDescriptor[];
  blocksById: ReadonlyMap<string, BlockDescriptor>;
  ancestorIds: ReadonlySet<string>;
}): NestedPlacement[] {
  const entries = block.nestedBlocks ?? [];
  const pushEntries = (nodes: PlacementNode[], selected: NestedBlockReference[]) =>
    selected.reduce((next, entry) => {
      const nested = resolveNested(entry, block, blocksById, ancestorIds);
      return nested ? [...next, { kind: 'nested' as const, block: nested }] : next;
    }, nodes);

  const nodes = fields.reduce((next, field) => {
    const withBefore = pushEntries(
      next,
      entries.filter((entry) => entry.insertBefore === field.id)
    );
    const withField: PlacementNode[] = [...withBefore, { kind: 'field', field }];
    return pushEntries(
      withField,
      entries.filter((entry) => entry.insertAfter === field.id)
    );
  }, pushEntries([], entries.filter((entry) => entry.position === 'top')));

  const ordered = pushEntries(
    nodes,
    entries.filter((entry) => entry.position === 'bottom')
  );

  return ordered.reduce<NestedPlacement[]>((segments, node) => {
    if (node.kind === 'nested') {
      return [...segments, node];
    }
    const previous = segments[segments.length - 1];
    if (previous?.kind === 'fields') {
      return [
        ...segments.slice(0, -1),
        { kind: 'fields', fields: [...previous.fields, node.field] },
      ];
    }
    return [...segments, { kind: 'fields', fields: [node.field] }];
  }, []);
}
