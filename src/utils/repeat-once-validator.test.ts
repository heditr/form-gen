/**
 * Tests for repeat-once descriptor checks.
 *
 * An inline repeatable block has at most one repeatOnce field, and that field
 * is a progress bar that sums a grouped number field.
 */

import { describe, test, expect } from 'vitest';
import type {
  BlockDescriptor,
  FieldDescriptor,
  GlobalFormDescriptor,
  RepeatableChildConfig,
} from '@/types/form-descriptor';
import { assertRepeatOnce } from './repeat-once-validator';

type DescriptorError = Error & { cause?: { name?: string; code?: string } };

const grouped = (id: string, groupId = 'addresses'): FieldDescriptor => ({
  id: `${groupId}.${id}`,
  type: 'text',
  label: id,
  repeatableGroupId: groupId,
  validation: [],
});

const once = (overrides: Partial<FieldDescriptor> = {}): FieldDescriptor => ({
  id: 'sectorShare',
  type: 'progress',
  label: 'Total share',
  repeatOnce: true,
  progress: { sumField: 'percentage', max: 100 },
  validation: [],
  ...overrides,
});

const percentage = (groupId = 'addresses'): FieldDescriptor => ({
  id: `${groupId}.percentage`,
  type: 'number',
  label: 'Percentage',
  repeatableGroupId: groupId,
  validation: [],
});

const childConfig = (): RepeatableChildConfig => ({
  property: 'subsectors',
  maxDepth: 2,
  title: 'Subsector',
  addLabel: 'Add subsector',
  triggerField: 'sector',
  triggerValues: ['holding'],
});

const block = (overrides: Partial<BlockDescriptor> = {}): BlockDescriptor => ({
  id: 'addresses-block',
  title: 'Addresses',
  repeatable: true,
  fields: [once(), grouped('street'), percentage()],
  ...overrides,
});

const form = (blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
  blocks,
  submission: { url: '/api/submit', method: 'POST' },
});

const captureError = (descriptor: GlobalFormDescriptor): DescriptorError | undefined => {
  try {
    assertRepeatOnce(descriptor);
    return undefined;
  } catch (caught) {
    return caught as DescriptorError;
  }
};

const expectDescriptorError = (descriptor: GlobalFormDescriptor, code: string) => {
  const error = captureError(descriptor);
  expect(error).toBeInstanceOf(Error);
  expect(error?.cause?.name).toBe('RepeatOnceDescriptorError');
  expect(error?.cause?.code).toBe(code);
};

describe('assertRepeatOnce', () => {
  describe('valid descriptors', () => {
    test('given an inline repeatable block with one progress field, should return the descriptor unchanged', () => {
      const descriptor = form([block()]);

      expect(assertRepeatOnce(descriptor)).toBe(descriptor);
    });

    test('given a progress field between grouped fields, should return the descriptor unchanged', () => {
      const descriptor = form([
        block({
          fields: [grouped('street'), once(), percentage()],
        }),
      ]);

      expect(assertRepeatOnce(descriptor)).toBe(descriptor);
    });

    test('given an inline repeatable block with repeatableChild, should accept a progress field that is not the child property', () => {
      const descriptor = form([
        block({
          id: 'business-sectors-block',
          repeatableChild: childConfig(),
          fields: [
            once(),
            grouped('sector', 'businessSectors'),
            percentage('businessSectors'),
          ],
        }),
      ]);

      expect(assertRepeatOnce(descriptor)).toBe(descriptor);
    });

    test('given no repeatOnce fields, should return the descriptor unchanged', () => {
      const descriptor = form([
        block({
          popin: true,
          repeatablePopin: true,
          fields: [grouped('street'), { id: 'note', type: 'text', label: 'Note', validation: [] }],
        }),
      ]);

      expect(assertRepeatOnce(descriptor)).toBe(descriptor);
    });
  });

  describe('descriptor errors', () => {
    test('given a once-field on a block that is not inline repeatable, should reject it with REPEAT_ONCE_PARENT_KIND', () => {
      expectDescriptorError(form([block({ repeatable: false })]), 'REPEAT_ONCE_PARENT_KIND');
      expectDescriptorError(form([block({ popin: true })]), 'REPEAT_ONCE_PARENT_KIND');
      expectDescriptorError(form([block({ repeatablePopin: true })]), 'REPEAT_ONCE_PARENT_KIND');
    });

    test('given a once-field that also has a group id, should reject it with REPEAT_ONCE_GROUP', () => {
      expectDescriptorError(
        form([block({ fields: [once({ repeatableGroupId: 'addresses' }), grouped('street')] })]),
        'REPEAT_ONCE_GROUP'
      );
    });

    test('given a once-field on a block that does not have exactly one group id, should reject it with REPEAT_ONCE_GROUP', () => {
      expectDescriptorError(
        form([block({ fields: [once(), grouped('street'), grouped('name', 'contacts')] })]),
        'REPEAT_ONCE_GROUP'
      );
      expectDescriptorError(
        form([block({ fields: [once()] })]),
        'REPEAT_ONCE_GROUP'
      );
    });

    test('given more than one repeatOnce field, should reject it with REPEAT_ONCE_LIMIT', () => {
      expectDescriptorError(
        form([
          block({
            fields: [once(), once({ id: 'otherShare', label: 'Other' }), grouped('street'), percentage()],
          }),
        ]),
        'REPEAT_ONCE_LIMIT'
      );
    });

    test('given a progress field that does not sum a grouped number field, should reject it with REPEAT_ONCE_SUM', () => {
      expectDescriptorError(
        form([block({ fields: [once({ progress: { sumField: 'missing', max: 100 } }), grouped('street'), percentage()] })]),
        'REPEAT_ONCE_SUM'
      );
      expectDescriptorError(
        form([block({ fields: [once({ progress: { sumField: 'percentage', max: 0 } }), grouped('street'), percentage()] })]),
        'REPEAT_ONCE_SUM'
      );
      expectDescriptorError(
        form([block({ fields: [once({ progress: undefined }), grouped('street'), percentage()] })]),
        'REPEAT_ONCE_SUM'
      );
    });

    test('given a once-field id that collides with the group id, should reject it with REPEAT_ONCE_ID', () => {
      expectDescriptorError(
        form([block({ fields: [once({ id: '' }), grouped('street')] })]),
        'REPEAT_ONCE_ID'
      );
      expectDescriptorError(
        form([block({ fields: [once({ id: 'addresses' }), grouped('street')] })]),
        'REPEAT_ONCE_ID'
      );
      expectDescriptorError(
        form([block({ fields: [once({ id: 'addresses.country' }), grouped('street')] })]),
        'REPEAT_ONCE_ID'
      );
    });

    test('given a once-field id equal to the child property, should reject it with REPEAT_ONCE_PROPERTY_CLASH', () => {
      expectDescriptorError(
        form([
          block({
            repeatableChild: childConfig(),
            fields: [once({ id: 'subsectors' }), grouped('sector', 'addresses'), grouped('city')],
          }),
        ]),
        'REPEAT_ONCE_PROPERTY_CLASH'
      );
    });

    test('given a string default that contains a row index token, should reject it with REPEAT_ONCE_INDEX', () => {
      expectDescriptorError(
        form([block({ fields: [once({ defaultValue: '{{caseContext.addresses.@index.country}}' }), grouped('street')] })]),
        'REPEAT_ONCE_INDEX'
      );
      expectDescriptorError(
        form([
          block({
            fields: [once({ defaultValue: '{{caseContext.rows.@outerIndex.country}}' }), grouped('street')],
          }),
        ]),
        'REPEAT_ONCE_INDEX'
      );
    });

    test('given a once-field that is not a progress field, should reject it with REPEAT_ONCE_TYPE', () => {
      expectDescriptorError(
        form([block({ fields: [once({ id: 'help', type: 'button', label: 'Help' }), grouped('street'), percentage()] })]),
        'REPEAT_ONCE_TYPE'
      );
      expectDescriptorError(
        form([block({ fields: [once({ type: 'text', label: 'Country' }), grouped('street'), percentage()] })]),
        'REPEAT_ONCE_TYPE'
      );
    });

    test('given the same progress field id on two blocks, should reject it with REPEAT_ONCE_DUPLICATE', () => {
      expectDescriptorError(
        form([
          block(),
          block({
            id: 'other-addresses-block',
            fields: [once(), grouped('street', 'other'), percentage('other')],
          }),
        ]),
        'REPEAT_ONCE_DUPLICATE'
      );
    });
  });
});
