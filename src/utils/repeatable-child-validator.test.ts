/**
 * Tests for repeatable child descriptor checks.
 *
 * A block may carry one nested list of its own group (`repeatableChild`).
 * The config must be safe to render: inline repeatable parent, one group,
 * depth 2, a real trigger field, and sane limits.
 */

import { describe, test, expect } from 'vitest';
import type {
  BlockDescriptor,
  FieldDescriptor,
  GlobalFormDescriptor,
  RepeatableChildConfig,
} from '@/types/form-descriptor';
import { assertRepeatableChildren } from './repeatable-child-validator';
import { assertNestedBlocks } from './nested-block-resolver';

type DescriptorError = Error & { cause?: { name?: string; code?: string } };

const sectorFields = (groupId = 'businessSectors'): FieldDescriptor[] => [
  {
    id: `${groupId}.sector`,
    type: 'dropdown',
    label: 'Sector',
    repeatableGroupId: groupId,
    items: [
      { label: 'Holding', value: 'holding' },
      { label: 'Retail', value: 'retail' },
    ],
    validation: [],
  },
  {
    id: `${groupId}.percentage`,
    type: 'number',
    label: 'Percentage',
    repeatableGroupId: groupId,
    validation: [],
  },
];

const childConfig = (overrides: Record<string, unknown> = {}): RepeatableChildConfig =>
  ({
    property: 'subsectors',
    maxDepth: 2,
    title: 'Subsector',
    addLabel: 'Add subsector',
    triggerField: 'sector',
    triggerValues: ['holding'],
    minInstances: 0,
    maxInstances: 5,
    ...overrides,
  }) as RepeatableChildConfig;

const sectorBlock = (overrides: Partial<BlockDescriptor> = {}): BlockDescriptor => ({
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  minInstances: 0,
  maxInstances: 10,
  repeatableChild: childConfig(),
  fields: sectorFields(),
  ...overrides,
});

const form = (blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
  blocks,
  submission: { url: '/api/submit', method: 'POST' },
});

const captureError = (descriptor: GlobalFormDescriptor): DescriptorError | undefined => {
  try {
    assertRepeatableChildren(descriptor);
    return undefined;
  } catch (caught) {
    return caught as DescriptorError;
  }
};

const expectDescriptorError = (descriptor: GlobalFormDescriptor, code: string) => {
  const error = captureError(descriptor);
  expect(error).toBeInstanceOf(Error);
  expect(error?.cause?.name).toBe('RepeatableChildDescriptorError');
  expect(error?.cause?.code).toBe(code);
};

describe('assertRepeatableChildren', () => {
  describe('valid descriptors', () => {
    test('given a valid inline repeatable block with a child config, should return the descriptor unchanged', () => {
      const descriptor = form([sectorBlock()]);

      expect(assertRepeatableChildren(descriptor)).toBe(descriptor);
    });

    test('given no block with repeatableChild, should return the descriptor unchanged', () => {
      const descriptor = form([
        { id: 'plain', title: 'Plain', fields: [{ id: 'name', type: 'text', label: 'Name', validation: [] }] },
      ]);

      expect(assertRepeatableChildren(descriptor)).toBe(descriptor);
    });

    test('given a radio trigger field, should accept it', () => {
      const fields = sectorFields().map((field) =>
        field.id === 'businessSectors.sector' ? { ...field, type: 'radio' as const } : field
      );

      expect(captureError(form([sectorBlock({ fields })]))).toBeUndefined();
    });

    test('given a trigger field with dynamic items, should skip the item membership check', () => {
      const fields = sectorFields().map((field) =>
        field.id === 'businessSectors.sector' ? { ...field, items: '{{json sectors}}' } : field
      );

      expect(captureError(form([sectorBlock({ fields })]))).toBeUndefined();
    });

    test('given child limits omitted, should accept the config', () => {
      const config = childConfig({ minInstances: undefined, maxInstances: undefined });

      expect(captureError(form([sectorBlock({ repeatableChild: config })]))).toBeUndefined();
    });
  });

  describe('REPEATABLE_CHILD_PARENT_KIND', () => {
    test('given a block that is not repeatable, should throw', () => {
      expectDescriptorError(form([sectorBlock({ repeatable: false })]), 'REPEATABLE_CHILD_PARENT_KIND');
    });

    test('given a repeatable popin block, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatablePopin: true })]),
        'REPEATABLE_CHILD_PARENT_KIND'
      );
    });

    test('given a popin block, should throw', () => {
      expectDescriptorError(form([sectorBlock({ popin: true })]), 'REPEATABLE_CHILD_PARENT_KIND');
    });
  });

  describe('REPEATABLE_CHILD_GROUP', () => {
    test('given a block with two repeatable groups, should throw', () => {
      const fields = [...sectorFields(), ...sectorFields('other')];

      expectDescriptorError(form([sectorBlock({ fields })]), 'REPEATABLE_CHILD_GROUP');
    });

    test('given a block with no repeatable group, should throw', () => {
      const fields = [{ id: 'sector', type: 'dropdown' as const, label: 'Sector', validation: [] }];

      expectDescriptorError(form([sectorBlock({ fields })]), 'REPEATABLE_CHILD_GROUP');
    });
  });

  describe('REPEATABLE_CHILD_GROUP_CLASH', () => {
    test('given the same group id on another block, should throw', () => {
      const other: BlockDescriptor = {
        id: 'other-block',
        title: 'Other',
        repeatable: true,
        fields: sectorFields(),
      };

      expectDescriptorError(form([sectorBlock(), other]), 'REPEATABLE_CHILD_GROUP_CLASH');
    });
  });

  describe('REPEATABLE_CHILD_NESTED_HOST', () => {
    test('given a block that another block nests, should throw', () => {
      const parent: BlockDescriptor = {
        id: 'parent',
        title: 'Parent',
        fields: [{ id: 'note', type: 'text', label: 'Note', validation: [] }],
        nestedBlocks: [{ blockId: 'business-sectors-block', position: 'bottom' }],
      };

      expectDescriptorError(form([parent, sectorBlock()]), 'REPEATABLE_CHILD_NESTED_HOST');
    });
  });

  describe('REPEATABLE_CHILD_DEPTH', () => {
    test('given maxDepth 3, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ maxDepth: 3 }) })]),
        'REPEATABLE_CHILD_DEPTH'
      );
    });

    test('given maxDepth omitted, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ maxDepth: undefined }) })]),
        'REPEATABLE_CHILD_DEPTH'
      );
    });

    test('given maxDepth 1, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ maxDepth: 1 }) })]),
        'REPEATABLE_CHILD_DEPTH'
      );
    });
  });

  describe('REPEATABLE_CHILD_UNSUPPORTED', () => {
    test('given a nested repeatableChild key in the config, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ repeatableChild: childConfig() }) })]),
        'REPEATABLE_CHILD_UNSUPPORTED'
      );
    });

    test('given a fields key in the config, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ fields: [] }) })]),
        'REPEATABLE_CHILD_UNSUPPORTED'
      );
    });

    test('given any unknown key in the config, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ extra: true }) })]),
        'REPEATABLE_CHILD_UNSUPPORTED'
      );
    });

    test('given a config that is not an object, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: 'subsectors' as unknown as RepeatableChildConfig })]),
        'REPEATABLE_CHILD_UNSUPPORTED'
      );
    });
  });

  describe('REPEATABLE_CHILD_PROPERTY', () => {
    test.each([
      ['missing', undefined],
      ['empty', ''],
      ['dotted', 'sub.sectors'],
      ['not a string', 7],
    ])('given a %s property, should throw', (_label, property) => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ property }) })]),
        'REPEATABLE_CHILD_PROPERTY'
      );
    });
  });

  describe('REPEATABLE_CHILD_PROPERTY_CLASH', () => {
    test('given a property equal to a base field id in the group, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ property: 'percentage' }) })]),
        'REPEATABLE_CHILD_PROPERTY_CLASH'
      );
    });

    test('given a property equal to the first segment of a dotted base field id, should throw', () => {
      const fields = [
        ...sectorFields(),
        {
          id: 'businessSectors.location.city',
          type: 'text' as const,
          label: 'City',
          repeatableGroupId: 'businessSectors',
          validation: [],
        },
      ];

      expectDescriptorError(
        form([sectorBlock({ fields, repeatableChild: childConfig({ property: 'location' }) })]),
        'REPEATABLE_CHILD_PROPERTY_CLASH'
      );
    });

    test('given a property equal to a group id elsewhere in the descriptor, should throw', () => {
      const other: BlockDescriptor = {
        id: 'other-block',
        title: 'Other',
        repeatable: true,
        fields: sectorFields('subsectors'),
      };

      expectDescriptorError(form([sectorBlock(), other]), 'REPEATABLE_CHILD_PROPERTY_CLASH');
    });
  });

  describe('REPEATABLE_CHILD_TRIGGER_FIELD', () => {
    test('given a trigger field that is not in the group, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ triggerField: 'missing' }) })]),
        'REPEATABLE_CHILD_TRIGGER_FIELD'
      );
    });

    test('given a trigger field with a group prefix, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ triggerField: 'businessSectors.sector' }) })]),
        'REPEATABLE_CHILD_TRIGGER_FIELD'
      );
    });

    test('given a trigger field that is not a dropdown or radio, should throw', () => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ triggerField: 'percentage' }) })]),
        'REPEATABLE_CHILD_TRIGGER_FIELD'
      );
    });

    test('given a dotted trigger field, should throw', () => {
      const fields = [
        ...sectorFields(),
        {
          id: 'businessSectors.location.kind',
          type: 'dropdown' as const,
          label: 'Kind',
          repeatableGroupId: 'businessSectors',
          validation: [],
        },
      ];

      expectDescriptorError(
        form([sectorBlock({ fields, repeatableChild: childConfig({ triggerField: 'location.kind' }) })]),
        'REPEATABLE_CHILD_TRIGGER_FIELD'
      );
    });
  });

  describe('REPEATABLE_CHILD_TRIGGER_VALUES', () => {
    test.each([
      ['empty', []],
      ['not an array', 'holding'],
      ['containing non-strings', ['holding', 3]],
      ['containing duplicates', ['holding', 'holding']],
      ['outside the static items', ['holding', 'unknown']],
    ])('given trigger values %s, should throw', (_label, triggerValues) => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig({ triggerValues }) })]),
        'REPEATABLE_CHILD_TRIGGER_VALUES'
      );
    });
  });

  describe('REPEATABLE_CHILD_LIMITS', () => {
    test.each([
      ['negative min', { minInstances: -1 }],
      ['fractional max', { maxInstances: 2.5 }],
      ['non-number min', { minInstances: '1' }],
      ['min above max', { minInstances: 4, maxInstances: 2 }],
    ])('given %s, should throw', (_label, limits) => {
      expectDescriptorError(
        form([sectorBlock({ repeatableChild: childConfig(limits) })]),
        'REPEATABLE_CHILD_LIMITS'
      );
    });
  });

  describe('integration with nested block checks', () => {
    test('given a valid descriptor, should leave assertNestedBlocks behaviour unchanged', () => {
      const descriptor = form([sectorBlock()]);

      expect(assertNestedBlocks(assertRepeatableChildren(descriptor))).toBe(descriptor);
    });

    test('given an invalid nested block reference, should still throw NestedBlockDescriptorError', () => {
      const parent: BlockDescriptor = {
        id: 'parent',
        title: 'Parent',
        fields: [{ id: 'note', type: 'text', label: 'Note', validation: [] }],
        nestedBlocks: [{ blockId: 'ghost', position: 'bottom' }],
      };
      const descriptor = assertRepeatableChildren(form([parent, sectorBlock()]));

      expect(() => assertNestedBlocks(descriptor)).toThrow();
    });
  });
});
