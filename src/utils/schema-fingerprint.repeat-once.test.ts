/**
 * Tests for repeatOnce fields in submit stripping and validation fingerprints.
 *
 * A once-field is a top-level path. Hiding it removes that key and leaves
 * the repeatable rows as they were.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import type { BlockDescriptor, FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import {
  collectStatusHiddenFieldIds,
  collectValidationTargets,
  omitStatusHiddenFormValues,
} from './schema-fingerprint';

const grouped = (id: string): FieldDescriptor => ({
  id: `addresses.${id}`,
  type: 'text',
  label: id,
  repeatableGroupId: 'addresses',
  validation: [],
});

const once = (overrides: Partial<FieldDescriptor> = {}): FieldDescriptor => ({
  id: 'country',
  type: 'text',
  label: 'Country',
  repeatOnce: true,
  validation: [{ type: 'required', message: 'Country is required' }],
  ...overrides,
});

const block = (fields: FieldDescriptor[], overrides: Partial<BlockDescriptor> = {}): BlockDescriptor => ({
  id: 'addresses-block',
  title: 'Addresses',
  repeatable: true,
  fields,
  ...overrides,
});

const descriptorOf = (fields: FieldDescriptor[], overrides: Partial<BlockDescriptor> = {}): GlobalFormDescriptor => ({
  blocks: [block(fields, overrides)],
  submission: { url: '/api/submit', method: 'POST' },
});

const rows = [{ street: '1 main', city: 'Paris' }];

describe('omitStatusHiddenFormValues with repeatOnce', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  test('given a hidden once-field, should omit it and leave row values unchanged', () => {
    const descriptor = descriptorOf([
      once({ status: { hidden: 'true' } }),
      grouped('street'),
      grouped('city'),
    ]);
    const values = { country: 'FR', addresses: rows };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual({ addresses: rows });
  });

  test('given a visible once-field, should keep it and the row values', () => {
    const descriptor = descriptorOf([once(), grouped('street'), grouped('city')]);
    const values = { country: 'FR', addresses: rows };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual(values);
  });

  test('given a hidden block, should omit the once-field with the group', () => {
    const descriptor = descriptorOf([once(), grouped('street')], { status: { hidden: 'true' } });
    const values = { country: 'FR', addresses: rows };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual({});
  });

  test('given a hidden once-field, should list it as hidden and keep a visible once-field in validation targets', () => {
    const descriptor = descriptorOf([
      once({ id: 'country', status: { hidden: '{{eq mode "simple"}}' } }),
      once({ id: 'notes', label: 'Notes', validation: [] }),
      grouped('street'),
      grouped('city'),
    ]);

    expect(collectStatusHiddenFieldIds(descriptor, { mode: 'simple' })).toContain('country');
    expect(collectStatusHiddenFieldIds(descriptor, { mode: 'simple' })).not.toContain('notes');
    expect(collectValidationTargets(descriptor, { mode: 'simple' }).map((target) => target.id)).toEqual([
      'addresses',
      'notes',
    ]);
  });

  test('given a progress once-field, should leave it out of hidden ids and validation targets', () => {
    const descriptor = descriptorOf([
      {
        id: 'sectorShare',
        type: 'progress',
        label: 'Total share',
        repeatOnce: true,
        progress: { sumField: 'percentage', max: 100 },
        validation: [],
      },
      {
        id: 'addresses.percentage',
        type: 'number',
        label: 'Percentage',
        repeatableGroupId: 'addresses',
        validation: [],
      },
    ]);
    const values = { sectorShare: 100, addresses: [{ percentage: 100 }] };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual(values);
    expect(collectStatusHiddenFieldIds(descriptor, {})).not.toContain('sectorShare');
    expect(collectValidationTargets(descriptor, {}).map((target) => target.id)).toEqual(['addresses']);
  });
});
