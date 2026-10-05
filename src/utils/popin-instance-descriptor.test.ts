/**
 * Tests for the repeatable popin instance descriptor.
 *
 * The open row is a shell. A nested block stays its own block.
 */

import { describe, test, expect } from 'vitest';
import type { BlockDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { buildRepeatablePopinInstanceDescriptor } from './popin-instance-descriptor';

const textField = (
  id: string,
  repeatableGroupId?: string
): BlockDescriptor['fields'][number] => ({
  id,
  type: 'text',
  label: id,
  validation: [],
  ...(repeatableGroupId ? { repeatableGroupId } : {}),
});

const descriptor = (blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
  version: '1.0.0',
  blocks,
  submission: { url: '/api/submit', method: 'POST' },
});

describe('buildRepeatablePopinInstanceDescriptor', () => {
  test('given a repeatable popin that nests a block, should keep that block intact and off the shell', () => {
    const emergency: BlockDescriptor = {
      id: 'emergency-contacts-block',
      title: 'Emergency contacts',
      repeatable: true,
      minInstances: 1,
      maxInstances: 3,
      layout: { mode: 'grid', columns: 2 },
      repeatableDefaultSource: 'caseContext.contactGroupId.@index.emergencyContacts',
      fields: [
        textField('emergency-contacts.emergencyName', 'emergency-contacts'),
        textField('emergency-contacts.emergencyPhone', 'emergency-contacts'),
      ],
    };
    const contacts: BlockDescriptor = {
      id: 'contacts-block',
      title: 'Contacts',
      description: 'People on the case',
      repeatable: true,
      repeatablePopin: true,
      minInstances: 0,
      maxInstances: 5,
      layout: { mode: 'default' },
      fields: [
        textField('contactGroupId.name', 'contactGroupId'),
        {
          id: 'contactGroupId.add',
          type: 'button',
          label: 'Add',
          validation: [],
          repeatableGroupId: 'contactGroupId',
        },
      ],
      nestedBlocks: [{ blockId: 'emergency-contacts-block', position: 'bottom' }],
    };

    const result = buildRepeatablePopinInstanceDescriptor({
      block: contacts,
      groupId: 'contactGroupId',
      descriptor: descriptor([contacts, emergency]),
    });

    const shell = result?.blocks[0];
    const nested = result?.blocks[1];

    expect(shell?.id).toBe('contacts-block-instance');
    expect(shell?.title).toBe('Contacts');
    expect(shell?.description).toBe('People on the case');
    expect(shell?.layout).toEqual({ mode: 'default' });
    expect(shell?.fields.map((field) => field.id)).toEqual(['name']);
    expect(shell?.fields[0]?.repeatableGroupId).toBeUndefined();
    expect(shell?.repeatable).toBeUndefined();
    expect(shell?.minInstances).toBeUndefined();
    expect(shell?.maxInstances).toBeUndefined();
    expect(shell?.nestedBlocks).toEqual([
      { blockId: 'emergency-contacts-block', position: 'bottom' },
    ]);
    expect(nested).toBe(emergency);
    expect(shell?.fields.some((field) => field.id.includes('emergency'))).toBe(false);
  });

  test('given a same-block group that is not nested, should keep those fields on the shell', () => {
    const phones = textField('phones.number', 'phones');
    const contacts: BlockDescriptor = {
      id: 'contacts-block',
      title: 'Contacts',
      repeatable: true,
      repeatablePopin: true,
      minInstances: 0,
      maxInstances: 5,
      fields: [textField('contactGroupId.name', 'contactGroupId'), phones],
    };

    const result = buildRepeatablePopinInstanceDescriptor({
      block: contacts,
      groupId: 'contactGroupId',
      descriptor: descriptor([contacts]),
    });

    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks[0]?.repeatable).toBe(true);
    expect(result?.blocks[0]?.fields.map((field) => field.id)).toEqual(['name', 'phones.number']);
    expect(result?.blocks[0]?.fields[1]).toBe(phones);
    expect(result?.blocks[0]?.minInstances).toBeUndefined();
    expect(result?.blocks[0]?.maxInstances).toBeUndefined();
  });

  test('given an opened group with no fields, should not build an instance descriptor', () => {
    const contacts: BlockDescriptor = {
      id: 'contacts-block',
      title: 'Contacts',
      repeatable: true,
      repeatablePopin: true,
      fields: [textField('phones.number', 'phones')],
    };

    expect(
      buildRepeatablePopinInstanceDescriptor({
        block: contacts,
        groupId: 'contactGroupId',
        descriptor: descriptor([contacts]),
      })
    ).toBeNull();
  });
});
