/**
 * Checks that repeatOnce fields are safe to store once at their own form key.
 *
 * Runs after the repeatable-child check. Does not change the descriptor.
 * Fields without the flag keep today's behavior.
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

const assertPlacement = (block: BlockDescriptor, field: FieldDescriptor) => {
  const groupedAt = block.fields.flatMap((candidate, index) => (candidate.repeatableGroupId ? [index] : []));
  const fieldIndex = block.fields.indexOf(field);
  const first = groupedAt[0] ?? -1;
  const last = groupedAt[groupedAt.length - 1] ?? -1;
  if (fieldIndex > first && fieldIndex < last) {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" sits between grouped fields`,
      code: 'REPEAT_ONCE_PLACEMENT',
      blockId: block.id,
      fieldId: field.id,
    });
  }
};

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
  if (field.type === 'button') {
    throw repeatOnceError({
      message: `Field "${field.id}" on block "${block.id}" cannot be a button when repeatOnce is set`,
      code: 'REPEAT_ONCE_TYPE',
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
 * Reject repeatOnce fields that cannot be stored once at `field.id`.
 * Returns the same descriptor when every flagged field is valid.
 */
export function assertRepeatOnce(descriptor: GlobalFormDescriptor): GlobalFormDescriptor {
  for (const block of descriptor.blocks) {
    const onceFields = onceFieldsOf(block);
    if (onceFields.length === 0) {
      continue;
    }

    assertParentKind(block);

    for (const field of onceFields) {
      assertGroup(block, field);
      const groupId = groupIds(block)[0];
      if (!groupId) {
        continue;
      }
      assertPlacement(block, field);
      assertId(block, field, groupId);
      assertProperty(block, field);
      assertIndex(block, field);
      assertType(block, field);
      assertUnique(descriptor, block, field);
    }
  }

  return descriptor;
}
