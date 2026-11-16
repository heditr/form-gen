/**
 * Checks that an inline repeatable block has at most one repeatOnce field,
 * and that field is a progress bar with a real sum.
 *
 * Runs after the repeatable-child check. Does not change the descriptor.
 */

import { createError } from 'error-causes';
import type { BlockDescriptor, FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';

const repeatOnceError = ({
  message,
  code,
  ...details
}: {
  message: string;
  code: string;
} & Record<string, unknown>) =>
  createError({
    name: 'RepeatOnceDescriptorError',
    message,
    code,
    ...details,
  });

const groupIds = (block: BlockDescriptor): string[] => [
  ...new Set(block.fields.flatMap((field) => (field.repeatableGroupId ? [field.repeatableGroupId] : []))),
];

const isInlineRepeatable = (block: BlockDescriptor): boolean =>
  block.repeatable === true && block.popin !== true && block.repeatablePopin !== true;

const onceFieldsOf = (block: BlockDescriptor): FieldDescriptor[] =>
  block.fields.filter((field) => field.repeatOnce === true);

const hasRowIndexToken = (value: string): boolean => value.includes('@index') || value.includes('@outerIndex');

const assertParentKind = (block: BlockDescriptor) => {
  if (!isInlineRepeatable(block)) {
    throw repeatOnceError({
      message: `Block "${block.id}" can set repeatOnce only when it is an inline repeatable block`,
      code: 'REPEAT_ONCE_PARENT_KIND',
      blockId: block.id,
    });
  }
};

const assertGroup = (block: BlockDescriptor, field: FieldDescriptor) => {
  if (field.repeatableGroupId || groupIds(block).length !== 1) {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" needs exactly one repeatable group and cannot also set repeatableGroupId`,
      code: 'REPEAT_ONCE_GROUP',
      blockId: block.id,
      fieldId: field.id,
    });
  }
};

const baseFieldId = (field: FieldDescriptor, groupId: string): string =>
  field.id.startsWith(`${groupId}.`) ? field.id.slice(groupId.length + 1) : field.id;

const assertId = (block: BlockDescriptor, field: FieldDescriptor, groupId: string) => {
  const firstSegment = field.id.split('.')[0] ?? '';
  if (field.id === '' || firstSegment === groupId) {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" collides with group "${groupId}"`,
      code: 'REPEAT_ONCE_ID',
      blockId: block.id,
      fieldId: field.id,
      groupId,
    });
  }
};

const assertProperty = (block: BlockDescriptor, field: FieldDescriptor) => {
  const property = block.repeatableChild?.property;
  if (property && field.id === property) {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" uses the repeatableChild property "${property}"`,
      code: 'REPEAT_ONCE_PROPERTY_CLASH',
      blockId: block.id,
      fieldId: field.id,
      property,
    });
  }
};

const assertIndex = (block: BlockDescriptor, field: FieldDescriptor) => {
  if (typeof field.defaultValue === 'string' && hasRowIndexToken(field.defaultValue)) {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" cannot use @index or @outerIndex in defaultValue`,
      code: 'REPEAT_ONCE_INDEX',
      blockId: block.id,
      fieldId: field.id,
    });
  }
};

const assertType = (block: BlockDescriptor, field: FieldDescriptor) => {
  if (field.type !== 'progress') {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" must be a progress field when repeatOnce is set`,
      code: 'REPEAT_ONCE_TYPE',
      blockId: block.id,
      fieldId: field.id,
    });
  }
};

const assertSum = (block: BlockDescriptor, field: FieldDescriptor, groupId: string) => {
  const sumField = field.progress?.sumField;
  const max = field.progress?.max;
  const matchesNumberField = block.fields.some(
    (candidate) =>
      candidate.repeatableGroupId === groupId &&
      candidate.type === 'number' &&
      baseFieldId(candidate, groupId) === sumField
  );
  if (!sumField || !matchesNumberField || typeof max !== 'number' || !Number.isFinite(max) || max <= 0) {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" must sum a grouped number field with a positive max`,
      code: 'REPEAT_ONCE_SUM',
      blockId: block.id,
      fieldId: field.id,
    });
  }
};

const assertUnique = (descriptor: GlobalFormDescriptor, block: BlockDescriptor, field: FieldDescriptor) => {
  const occurrences = descriptor.blocks.reduce(
    (count, candidate) => count + candidate.fields.filter((item) => item.id === field.id).length,
    0
  );
  if (occurrences > 1) {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" is declared more than once`,
      code: 'REPEAT_ONCE_DUPLICATE',
      blockId: block.id,
      fieldId: field.id,
    });
  }
};

/**
 * Reject a repeatOnce field that is not the one progress bar for an inline list.
 * Returns the same descriptor when every flagged field is valid.
 */
export function assertRepeatOnce(descriptor: GlobalFormDescriptor): GlobalFormDescriptor {
  for (const block of descriptor.blocks) {
    const onceFields = onceFieldsOf(block);
    if (onceFields.length === 0) {
      continue;
    }

    assertParentKind(block);
    if (onceFields.length > 1) {
      throw repeatOnceError({
        message: `Block "${block.id}" can have only one repeatOnce field`,
        code: 'REPEAT_ONCE_LIMIT',
        blockId: block.id,
      });
    }

    for (const field of onceFields) {
      assertGroup(block, field);
      const groupId = groupIds(block)[0];
      if (!groupId) {
        continue;
      }
      assertId(block, field, groupId);
      assertProperty(block, field);
      assertIndex(block, field);
      assertType(block, field);
      assertSum(block, field, groupId);
      assertUnique(descriptor, block, field);
    }
  }

  return descriptor;
}
