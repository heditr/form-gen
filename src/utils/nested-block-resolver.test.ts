/**
 * Tests for nested block descriptor checks.
 *
 * A parent block may reference other blocks. Those references must name one
 * placement, one existing block, and must not cycle or collide on a popin row.
 */

import { describe, test, expect } from 'vitest';
import type {
  BlockDescriptor,
  FieldDescriptor,
  GlobalFormDescriptor,
  NestedBlockReference,
} from '@/types/form-descriptor';
import { assertNestedBlocks } from './nested-block-resolver';

type DescriptorError = Error & { cause?: { name?: string; code?: string } };

const textField = (
  id: string,
  overrides: Partial<FieldDescriptor> = {}
): FieldDescriptor => ({
  id,
  type: 'text',
  label: id,
  validation: [],
  ...overrides,
});

const block = ({
  id,
  title = id,
  fields = [textField('name')],
  ...rest
}: Partial<BlockDescriptor> & Pick<BlockDescriptor, 'id'>): BlockDescriptor => ({
  id,
  title,
  fields,
  ...rest,
});

const form = (blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
  blocks,
  submission: { url: '/api/submit', method: 'POST' },
});

const child = block({ id: 'child', title: 'Child', fields: [textField('note')] });

const expectDescriptorError = (descriptor: GlobalFormDescriptor, code: string) => {
  let error: DescriptorError | undefined;
  try {
    assertNestedBlocks(descriptor);
  } catch (caught) {
    error = caught as DescriptorError;
  }

  expect(error).toBeInstanceOf(Error);
  expect(error?.cause?.name).toBe('NestedBlockDescriptorError');
  expect(error?.cause?.code).toBe(code);
};

describe('assertNestedBlocks', () => {
  test('given one placement, should keep the descriptor and the referenced block', () => {
    const descriptor = form([
      block({
        id: 'parent',
        fields: [textField('city'), textField('name')],
        nestedBlocks: [{ blockId: 'child', position: 'top' }],
      }),
      child,
    ]);

    expect(assertNestedBlocks(descriptor)).toBe(descriptor);
    expect(descriptor.blocks.map((item) => item.id)).toEqual(['parent', 'child']);
  });

  test('given position bottom, insertBefore, or insertAfter alone, should accept the descriptor', () => {
    const parentFields = [textField('city'), textField('name')];
    const placements: NestedBlockReference[] = [
      { blockId: 'child', position: 'bottom' },
      { blockId: 'child', insertBefore: 'city' },
      { blockId: 'child', insertAfter: 'name' },
    ];

    placements.forEach((placement) => {
      const descriptor = form([
        block({ id: 'parent', fields: parentFields, nestedBlocks: [placement] }),
        child,
      ]);

      expect(assertNestedBlocks(descriptor)).toBe(descriptor);
    });
  });

  test('given two nested entries on the same slot, should accept them in array order', () => {
    const descriptor = form([
      block({
        id: 'parent',
        nestedBlocks: [
          { blockId: 'first', position: 'bottom' },
          { blockId: 'second', position: 'bottom' },
        ],
      }),
      block({ id: 'first' }),
      block({ id: 'second' }),
    ]);

    const result = assertNestedBlocks(descriptor);

    expect(result.blocks[0].nestedBlocks?.map((entry) => entry.blockId)).toEqual([
      'first',
      'second',
    ]);
  });

  test('given a repeatable popin nesting an inline repeatable block, should accept distinct limits and group', () => {
    const descriptor = form([
      block({
        id: 'contacts-block',
        repeatable: true,
        repeatablePopin: true,
        minInstances: 0,
        maxInstances: 5,
        fields: [
          textField('contactGroupId.name', { repeatableGroupId: 'contactGroupId' }),
        ],
        nestedBlocks: [{ blockId: 'emergency-contacts-block', position: 'bottom' }],
      }),
      block({
        id: 'emergency-contacts-block',
        title: 'Emergency contacts',
        repeatable: true,
        minInstances: 1,
        maxInstances: 3,
        repeatableDefaultSource: 'caseContext.contactGroupId.@index.emergencyContacts',
        fields: [
          textField('emergency-contacts.emergencyName', {
            repeatableGroupId: 'emergency-contacts',
          }),
          textField('emergency-contacts.emergencyPhone', {
            repeatableGroupId: 'emergency-contacts',
          }),
        ],
      }),
    ]);

    expect(assertNestedBlocks(descriptor)).toBe(descriptor);
  });

  test('given a plain block nested inside another plain block, should accept the chain', () => {
    const descriptor = form([
      block({
        id: 'outer',
        nestedBlocks: [{ blockId: 'middle', position: 'top' }],
      }),
      block({
        id: 'middle',
        nestedBlocks: [{ blockId: 'inner', position: 'bottom' }],
      }),
      block({ id: 'inner' }),
    ]);

    expect(assertNestedBlocks(descriptor)).toBe(descriptor);
  });

  test('given no nested block entries, should accept the descriptor', () => {
    const descriptor = form([block({ id: 'parent', nestedBlocks: [] }), block({ id: 'other' })]);

    expect(assertNestedBlocks(descriptor)).toBe(descriptor);
    expect(assertNestedBlocks(form([block({ id: 'plain' })]))).toBeDefined();
  });

  test('given an entry with no placement, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({ id: 'parent', nestedBlocks: [{ blockId: 'child' }] }),
        child,
      ]),
      'NESTED_BLOCK_PLACEMENT'
    );
  });

  test('given an entry with two placement options, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'child', position: 'top', insertBefore: 'name' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_PLACEMENT'
    );
  });

  test('given a placement value other than top or bottom, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'child', position: 'middle' as 'top' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_PLACEMENT'
    );
  });

  test('given a nested block id that is not in the descriptor, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'missing', position: 'top' }],
        }),
      ]),
      'NESTED_BLOCK_NOT_FOUND'
    );
  });

  test('given the same block nested by more than one entry, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'first-parent',
          nestedBlocks: [{ blockId: 'child', position: 'top' }],
        }),
        block({
          id: 'second-parent',
          nestedBlocks: [{ blockId: 'child', position: 'bottom' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_DUPLICATE_USE'
    );
  });

  test('given a block that nests itself, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'parent', position: 'top' }],
        }),
      ]),
      'NESTED_BLOCK_CYCLE'
    );
  });

  test('given nested blocks that form a cycle, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'a',
          nestedBlocks: [{ blockId: 'b', position: 'top' }],
        }),
        block({
          id: 'b',
          nestedBlocks: [{ blockId: 'a', position: 'bottom' }],
        }),
      ]),
      'NESTED_BLOCK_CYCLE'
    );
  });

  test('given insertBefore or insertAfter whose field is missing, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'child', insertBefore: 'missing-field' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_ANCHOR'
    );
  });

  test('given an anchor field id that appears more than once, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          fields: [textField('city'), textField('city')],
          nestedBlocks: [{ blockId: 'child', insertAfter: 'city' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_ANCHOR'
    );
  });

  test('given an anchor field that belongs to a repeatable group, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          fields: [
            textField('contactGroupId.name', { repeatableGroupId: 'contactGroupId' }),
          ],
          nestedBlocks: [{ blockId: 'child', insertBefore: 'contactGroupId.name' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_ANCHOR'
    );
  });

  test('given a repeatable parent that is not a popin, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          repeatable: true,
          nestedBlocks: [{ blockId: 'child', position: 'bottom' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_PARENT_KIND'
    );
  });

  test('given a standalone popin parent, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          popin: true,
          nestedBlocks: [{ blockId: 'child', position: 'top' }],
        }),
        child,
      ]),
      'NESTED_BLOCK_PARENT_KIND'
    );
  });

  test('given a nested block that is a popin or a repeatable popin, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'popin-child', position: 'top' }],
        }),
        block({ id: 'popin-child', popin: true }),
      ]),
      'NESTED_BLOCK_NESTED_KIND'
    );

    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'popin-child', position: 'top' }],
        }),
        block({ id: 'popin-child', repeatable: true, repeatablePopin: true }),
      ]),
      'NESTED_BLOCK_NESTED_KIND'
    );
  });

  test('given a nested repeatable block without exactly one group, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'child', position: 'bottom' }],
        }),
        block({ id: 'child', repeatable: true, fields: [textField('note')] }),
      ]),
      'NESTED_BLOCK_GROUP'
    );

    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'child', position: 'bottom' }],
        }),
        block({
          id: 'child',
          repeatable: true,
          fields: [
            textField('phones.number', { repeatableGroupId: 'phones' }),
            textField('emails.address', { repeatableGroupId: 'emails' }),
          ],
        }),
      ]),
      'NESTED_BLOCK_GROUP'
    );
  });

  test('given a nested block that still has a repeatable block reference, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'parent',
          nestedBlocks: [{ blockId: 'child', position: 'top' }],
        }),
        block({
          id: 'child',
          repeatable: true,
          repeatableBlockRef: 'template',
          fields: [textField('template.name', { repeatableGroupId: 'template' })],
        }),
        block({ id: 'template' }),
      ]),
      'NESTED_BLOCK_REF_HOST'
    );
  });

  test('given a nested field id that matches a popin shell field, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'contacts-block',
          repeatable: true,
          repeatablePopin: true,
          fields: [
            textField('contactGroupId.name', { repeatableGroupId: 'contactGroupId' }),
          ],
          nestedBlocks: [{ blockId: 'notes-block', position: 'bottom' }],
        }),
        block({ id: 'notes-block', fields: [textField('name')] }),
      ]),
      'NESTED_BLOCK_FIELD_CLASH'
    );
  });

  test('given a nested group id equal to the parent group id, should reject the descriptor', () => {
    expectDescriptorError(
      form([
        block({
          id: 'contacts-block',
          repeatable: true,
          repeatablePopin: true,
          fields: [
            textField('contactGroupId.name', { repeatableGroupId: 'contactGroupId' }),
          ],
          nestedBlocks: [{ blockId: 'again', position: 'bottom' }],
        }),
        block({
          id: 'again',
          repeatable: true,
          fields: [
            textField('contactGroupId.extra', { repeatableGroupId: 'contactGroupId' }),
          ],
        }),
      ]),
      'NESTED_BLOCK_GROUP_CLASH'
    );
  });
});
