/**
 * Checks that nestedBlocks references are safe to render.
 *
 * Runs after sub-form and repeatable-block resolution. Does not copy fields
 * or remove the referenced block from the descriptor.
 */

import { createError } from 'error-causes';
import type {
  BlockDescriptor,
  FieldDescriptor,
  GlobalFormDescriptor,
  NestedBlockReference,
} from '@/types/form-descriptor';

interface NestedUse {
  parent: BlockDescriptor;
  entry: NestedBlockReference;
}

const nestedBlockError = ({
  message,
  code,
  ...details
}: {
  message: string;
  code: string;
} & Record<string, unknown>) =>
  createError({
    name: 'NestedBlockDescriptorError',
    message,
    code,
    ...details,
  });

const collectUses = (descriptor: GlobalFormDescriptor): NestedUse[] =>
  descriptor.blocks.flatMap((parent) =>
    (parent.nestedBlocks ?? []).map((entry) => ({ parent, entry }))
  );

const placementPairs = (
  entry: NestedBlockReference
): Array<['position' | 'insertBefore' | 'insertAfter', string]> =>
  (
    [
      ['position', entry.position],
      ['insertBefore', entry.insertBefore],
      ['insertAfter', entry.insertAfter],
    ] as const
  ).flatMap(([key, value]) =>
    typeof value === 'string' && value !== '' ? [[key, value] as const] : []
  );

const assertPlacements = (uses: NestedUse[]) => {
  uses.forEach(({ parent, entry }) => {
    const pairs = placementPairs(entry);
    if (pairs.length !== 1) {
      throw nestedBlockError({
        message: `Block "${parent.id}" must set exactly one placement for nested block "${entry.blockId}"`,
        code: 'NESTED_BLOCK_PLACEMENT',
        parentId: parent.id,
        blockId: entry.blockId,
      });
    }

    const [key, value] = pairs[0];
    if (key === 'position' && value !== 'top' && value !== 'bottom') {
      throw nestedBlockError({
        message: `Block "${parent.id}" must set position to "top" or "bottom" for nested block "${entry.blockId}"`,
        code: 'NESTED_BLOCK_PLACEMENT',
        parentId: parent.id,
        blockId: entry.blockId,
      });
    }
  });
};

const assertTargetsExist = (uses: NestedUse[], blocksById: Map<string, BlockDescriptor>) => {
  const missing = uses.find(({ entry }) => !blocksById.has(entry.blockId));
  if (!missing) {
    return;
  }

  throw nestedBlockError({
    message: `Nested block "${missing.entry.blockId}" was not found`,
    code: 'NESTED_BLOCK_NOT_FOUND',
    parentId: missing.parent.id,
    blockId: missing.entry.blockId,
  });
};

const assertSingleUse = (uses: NestedUse[]) => {
  const counts = uses.reduce((map, { entry }) => {
    map.set(entry.blockId, (map.get(entry.blockId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const duplicated = [...counts.entries()].find(([, count]) => count > 1);
  if (!duplicated) {
    return;
  }

  const [blockId] = duplicated;
  throw nestedBlockError({
    message: `Block "${blockId}" is nested more than once`,
    code: 'NESTED_BLOCK_DUPLICATE_USE',
    blockId,
  });
};

const assertNoCycle = (uses: NestedUse[]) => {
  const edges = uses.reduce((map, { parent, entry }) => {
    const next = map.get(parent.id) ?? [];
    return map.set(parent.id, [...next, entry.blockId]);
  }, new Map<string, string[]>());

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string, path: string[]) => {
    if (visiting.has(id)) {
      const cycle = [...path.slice(path.indexOf(id)), id];
      throw nestedBlockError({
        message: `Nested blocks form a cycle: ${cycle.join(' -> ')}`,
        code: 'NESTED_BLOCK_CYCLE',
        cycle,
      });
    }
    if (visited.has(id)) {
      return;
    }

    visiting.add(id);
    (edges.get(id) ?? []).forEach((next) => visit(next, [...path, id]));
    visiting.delete(id);
    visited.add(id);
  };

  [...edges.keys()].forEach((id) => visit(id, []));
};

const isPlainParent = (block: BlockDescriptor) =>
  block.repeatable !== true && block.popin !== true && block.repeatablePopin !== true;

const isRepeatablePopinParent = (block: BlockDescriptor) =>
  block.repeatable === true && block.repeatablePopin === true && block.popin !== true;

const assertParentKinds = (uses: NestedUse[]) => {
  const parents = [...new Map(uses.map(({ parent }) => [parent.id, parent])).values()];
  const invalid = parents.find(
    (parent) => !isPlainParent(parent) && !isRepeatablePopinParent(parent)
  );
  if (!invalid) {
    return;
  }

  throw nestedBlockError({
    message: `Block "${invalid.id}" can nest blocks only when it is a plain block or a repeatable popin`,
    code: 'NESTED_BLOCK_PARENT_KIND',
    parentId: invalid.id,
  });
};

const groupIds = (block: BlockDescriptor): string[] => [
  ...new Set(
    block.fields.flatMap((field) => (field.repeatableGroupId ? [field.repeatableGroupId] : []))
  ),
];

const assertNestedTargets = (uses: NestedUse[], blocksById: Map<string, BlockDescriptor>) => {
  uses.forEach(({ entry }) => {
    const nested = blocksById.get(entry.blockId);
    if (!nested) {
      return;
    }
    if (nested.repeatableBlockRef) {
      throw nestedBlockError({
        message: `Block "${nested.id}" still has repeatableBlockRef and cannot be nested`,
        code: 'NESTED_BLOCK_REF_HOST',
        blockId: nested.id,
      });
    }
    if (nested.popin === true || nested.repeatablePopin === true) {
      throw nestedBlockError({
        message: `Block "${nested.id}" cannot be nested when it is a popin`,
        code: 'NESTED_BLOCK_NESTED_KIND',
        blockId: nested.id,
      });
    }
    if (nested.repeatable === true && groupIds(nested).length !== 1) {
      throw nestedBlockError({
        message: `Repeatable block "${nested.id}" must declare exactly one repeatableGroupId to be nested`,
        code: 'NESTED_BLOCK_GROUP',
        blockId: nested.id,
      });
    }
  });
};

const assertAnchors = (uses: NestedUse[]) => {
  uses.forEach(({ parent, entry }) => {
    const fieldId = [entry.insertBefore, entry.insertAfter].find(
      (value): value is string => typeof value === 'string' && value !== ''
    );
    if (!fieldId) {
      return;
    }

    const matches = parent.fields.filter((field) => field.id === fieldId);
    if (matches.length !== 1) {
      throw nestedBlockError({
        message: `Block "${parent.id}" must contain exactly one field "${fieldId}" to place a nested block`,
        code: 'NESTED_BLOCK_ANCHOR',
        parentId: parent.id,
        fieldId,
      });
    }
    if (matches[0].repeatableGroupId) {
      throw nestedBlockError({
        message: `Block "${parent.id}" cannot place a nested block on repeatable field "${fieldId}"`,
        code: 'NESTED_BLOCK_ANCHOR',
        parentId: parent.id,
        fieldId,
      });
    }
  });
};

const baseFieldId = (field: FieldDescriptor): string =>
  field.repeatableGroupId && field.id.startsWith(`${field.repeatableGroupId}.`)
    ? field.id.slice(field.repeatableGroupId.length + 1)
    : field.id;

const rowKeys = (nested: BlockDescriptor): string[] =>
  nested.repeatable === true ? groupIds(nested) : nested.fields.map(baseFieldId);

const assertPopinRows = (uses: NestedUse[], blocksById: Map<string, BlockDescriptor>) => {
  const parents = [...new Map(uses.map(({ parent }) => [parent.id, parent])).values()].filter(
    isRepeatablePopinParent
  );

  parents.forEach((parent) => {
    const shellKeys = new Set(parent.fields.map(baseFieldId));
    const parentGroupIds = new Set(groupIds(parent));
    const seen = new Set<string>();

    (parent.nestedBlocks ?? []).forEach((entry) => {
      const nested = blocksById.get(entry.blockId);
      if (!nested) {
        return;
      }

      rowKeys(nested).forEach((key) => {
        if (parentGroupIds.has(key)) {
          throw nestedBlockError({
            message: `Nested block "${nested.id}" uses group "${key}", which is already a group on "${parent.id}"`,
            code: 'NESTED_BLOCK_GROUP_CLASH',
            parentId: parent.id,
            blockId: nested.id,
            groupId: key,
          });
        }
        if (shellKeys.has(key) || seen.has(key)) {
          throw nestedBlockError({
            message: `Nested block "${nested.id}" writes "${key}" onto a popin row that already has that field`,
            code: 'NESTED_BLOCK_FIELD_CLASH',
            parentId: parent.id,
            blockId: nested.id,
            fieldId: key,
          });
        }
        seen.add(key);
      });
    });
  });
};

/**
 * Reject a descriptor whose nestedBlocks references are incomplete or unsafe.
 * A valid descriptor is returned unchanged.
 */
export function assertNestedBlocks(descriptor: GlobalFormDescriptor): GlobalFormDescriptor {
  const uses = collectUses(descriptor);
  if (uses.length === 0) {
    return descriptor;
  }

  const blocksById = new Map(descriptor.blocks.map((item) => [item.id, item]));
  assertPlacements(uses);
  assertTargetsExist(uses, blocksById);
  assertSingleUse(uses);
  assertNoCycle(uses);
  assertParentKinds(uses);
  assertNestedTargets(uses, blocksById);
  assertAnchors(uses);
  assertPopinRows(uses, blocksById);
  return descriptor;
}
