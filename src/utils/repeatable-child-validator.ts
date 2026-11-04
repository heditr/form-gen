/**
 * Checks that repeatableChild configs are safe to render.
 *
 * Runs after sub-form and repeatable-block resolution, next to the nested block
 * check. Does not change the descriptor.
 */

import { createError } from 'error-causes';
import type {
  BlockDescriptor,
  FieldDescriptor,
  GlobalFormDescriptor,
} from '@/types/form-descriptor';

const allowedKeys = new Set([
  'property',
  'maxDepth',
  'title',
  'addLabel',
  'triggerField',
  'triggerValues',
  'minInstances',
  'maxInstances',
]);

const repeatableChildError = ({
  message,
  code,
  ...details
}: {
  message: string;
  code: string;
} & Record<string, unknown>) =>
  createError({
    name: 'RepeatableChildDescriptorError',
    message,
    code,
    ...details,
  });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const groupIds = (block: BlockDescriptor): string[] => [
  ...new Set(
    block.fields.flatMap((field) => (field.repeatableGroupId ? [field.repeatableGroupId] : []))
  ),
];

const baseFieldId = (field: FieldDescriptor): string =>
  field.repeatableGroupId && field.id.startsWith(`${field.repeatableGroupId}.`)
    ? field.id.slice(field.repeatableGroupId.length + 1)
    : field.id;

const assertParentKind = (block: BlockDescriptor) => {
  if (block.repeatable !== true || block.popin === true || block.repeatablePopin === true) {
    throw repeatableChildError({
      message: `Block "${block.id}" can set repeatableChild only when it is an inline repeatable block`,
      code: 'REPEATABLE_CHILD_PARENT_KIND',
      blockId: block.id,
    });
  }
};

const assertGroup = (block: BlockDescriptor) => {
  if (groupIds(block).length !== 1) {
    throw repeatableChildError({
      message: `Block "${block.id}" must declare exactly one repeatableGroupId to set repeatableChild`,
      code: 'REPEATABLE_CHILD_GROUP',
      blockId: block.id,
    });
  }
};

const assertGroupUnique = (block: BlockDescriptor, descriptor: GlobalFormDescriptor) => {
  const [groupId] = groupIds(block);
  const clash = descriptor.blocks.find(
    (other) => other.id !== block.id && groupIds(other).includes(groupId)
  );
  if (clash) {
    throw repeatableChildError({
      message: `Group "${groupId}" on block "${block.id}" is also used by block "${clash.id}"`,
      code: 'REPEATABLE_CHILD_GROUP_CLASH',
      blockId: block.id,
      groupId,
      otherBlockId: clash.id,
    });
  }
};

const assertNotNestedHost = (block: BlockDescriptor, descriptor: GlobalFormDescriptor) => {
  const parent = descriptor.blocks.find((other) =>
    (other.nestedBlocks ?? []).some((entry) => entry.blockId === block.id)
  );
  if (parent) {
    throw repeatableChildError({
      message: `Block "${block.id}" sets repeatableChild and cannot be nested in block "${parent.id}"`,
      code: 'REPEATABLE_CHILD_NESTED_HOST',
      blockId: block.id,
      parentId: parent.id,
    });
  }
};

const assertConfigShape = (block: BlockDescriptor) => {
  const config: unknown = block.repeatableChild;
  if (!isPlainObject(config)) {
    throw repeatableChildError({
      message: `Block "${block.id}" must set repeatableChild to an object`,
      code: 'REPEATABLE_CHILD_UNSUPPORTED',
      blockId: block.id,
    });
  }
  if (config.maxDepth !== 2) {
    throw repeatableChildError({
      message: `Block "${block.id}" must set repeatableChild.maxDepth to 2`,
      code: 'REPEATABLE_CHILD_DEPTH',
      blockId: block.id,
      maxDepth: config.maxDepth,
    });
  }
  const unknownKeys = Object.keys(config).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw repeatableChildError({
      message: `Block "${block.id}" sets unsupported repeatableChild keys: ${unknownKeys.join(', ')}`,
      code: 'REPEATABLE_CHILD_UNSUPPORTED',
      blockId: block.id,
      keys: unknownKeys,
    });
  }
};

const assertProperty = (block: BlockDescriptor, descriptor: GlobalFormDescriptor) => {
  const { property } = block.repeatableChild as { property?: unknown };
  if (typeof property !== 'string' || property === '' || property.includes('.')) {
    throw repeatableChildError({
      message: `Block "${block.id}" must set repeatableChild.property to a non-empty key without dots`,
      code: 'REPEATABLE_CHILD_PROPERTY',
      blockId: block.id,
    });
  }

  const fieldKeys = block.fields.map((field) => baseFieldId(field).split('.')[0]);
  const allGroupIds = descriptor.blocks.flatMap(groupIds);
  if (fieldKeys.includes(property) || allGroupIds.includes(property)) {
    throw repeatableChildError({
      message: `Block "${block.id}" uses repeatableChild.property "${property}", which clashes with a field or group`,
      code: 'REPEATABLE_CHILD_PROPERTY_CLASH',
      blockId: block.id,
      property,
    });
  }
};

const findTriggerField = (block: BlockDescriptor): FieldDescriptor | undefined => {
  const { triggerField } = block.repeatableChild as { triggerField?: unknown };
  return typeof triggerField === 'string'
    ? block.fields.find(
        (field) =>
          field.repeatableGroupId !== undefined &&
          baseFieldId(field) === triggerField &&
          !triggerField.includes('.')
      )
    : undefined;
};

const assertTriggerField = (block: BlockDescriptor): FieldDescriptor => {
  const field = findTriggerField(block);
  if (!field || (field.type !== 'dropdown' && field.type !== 'radio')) {
    throw repeatableChildError({
      message: `Block "${block.id}" must set repeatableChild.triggerField to a top-level dropdown or radio field of its group`,
      code: 'REPEATABLE_CHILD_TRIGGER_FIELD',
      blockId: block.id,
      triggerField: block.repeatableChild?.triggerField,
    });
  }
  return field;
};

const assertTriggerValues = (block: BlockDescriptor, triggerField: FieldDescriptor) => {
  const { triggerValues } = block.repeatableChild as { triggerValues?: unknown };
  const fail = (message: string) =>
    repeatableChildError({
      message: `Block "${block.id}" ${message}`,
      code: 'REPEATABLE_CHILD_TRIGGER_VALUES',
      blockId: block.id,
    });

  if (!Array.isArray(triggerValues) || triggerValues.length === 0) {
    throw fail('must set repeatableChild.triggerValues to a non-empty array');
  }
  if (!triggerValues.every((value) => typeof value === 'string')) {
    throw fail('must set repeatableChild.triggerValues to strings only');
  }
  if (new Set(triggerValues).size !== triggerValues.length) {
    throw fail('must not repeat a value in repeatableChild.triggerValues');
  }
  if (Array.isArray(triggerField.items)) {
    const itemValues = new Set(triggerField.items.map((item) => String(item.value)));
    const unknown = triggerValues.find((value) => !itemValues.has(value));
    if (unknown !== undefined) {
      throw fail(`lists trigger value "${unknown}" that is not an item of "${triggerField.id}"`);
    }
  }
};

const isValidLimit = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0);

const assertLimits = (block: BlockDescriptor) => {
  const { minInstances, maxInstances } = block.repeatableChild as {
    minInstances?: unknown;
    maxInstances?: unknown;
  };
  const isRangeInverted =
    typeof minInstances === 'number' && typeof maxInstances === 'number' && minInstances > maxInstances;

  if (!isValidLimit(minInstances) || !isValidLimit(maxInstances) || isRangeInverted) {
    throw repeatableChildError({
      message: `Block "${block.id}" must set repeatableChild limits to non-negative integers with min not above max`,
      code: 'REPEATABLE_CHILD_LIMITS',
      blockId: block.id,
    });
  }
};

/**
 * Reject a descriptor whose repeatableChild configs are incomplete or unsafe.
 * A valid descriptor is returned unchanged.
 */
export function assertRepeatableChildren(descriptor: GlobalFormDescriptor): GlobalFormDescriptor {
  descriptor.blocks
    .filter((block) => block.repeatableChild !== undefined)
    .forEach((block) => {
      assertParentKind(block);
      assertGroup(block);
      assertGroupUnique(block, descriptor);
      assertNotNestedHost(block, descriptor);
      assertConfigShape(block);
      assertProperty(block, descriptor);
      assertTriggerValues(block, assertTriggerField(block));
      assertLimits(block);
    });
  return descriptor;
}
