/**
 * Tests for repeatOnce fields in schema building and default extraction.
 *
 * The field is a top-level key. Row objects and child rows do not carry it,
 * and a repeatable default source does not copy it out of a source row.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import type { BlockDescriptor, FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import { buildZodSchemaFromDescriptor, extractDefaultValues } from './form-descriptor-integration';

const onceField = (overrides: Partial<FieldDescriptor> = {}): FieldDescriptor => ({
  id: 'country',
  type: 'text',
  label: 'Country',
  repeatOnce: true,
  validation: [{ type: 'minLength', value: 2, message: 'Country is too short' }],
  ...overrides,
});

const addressBlock = (fields: FieldDescriptor[], overrides: Partial<BlockDescriptor> = {}): BlockDescriptor => ({
  id: 'addresses-block',
  title: 'Addresses',
  repeatable: true,
  minInstances: 0,
  fields,
  ...overrides,
});

const sectorBlock = (fields: FieldDescriptor[]): BlockDescriptor => ({
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  minInstances: 0,
  repeatableDefaultSource: 'businessSectors',
  repeatableChild: {
    property: 'subsectors',
    maxDepth: 2,
    title: 'Subsector',
    addLabel: 'Add subsector',
    triggerField: 'sector',
    triggerValues: ['holding'],
  },
  fields,
});

const grouped = (
  id: string,
  groupId: string,
  overrides: Partial<FieldDescriptor> = {}
): FieldDescriptor => ({
  id: `${groupId}.${id}`,
  type: 'text',
  label: id,
  repeatableGroupId: groupId,
  validation: [],
  ...overrides,
});

const descriptorOf = (...blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
  blocks,
  submission: { url: '/api/submit', method: 'POST' },
});

const addressFields = (extra: FieldDescriptor[] = [onceField()]): FieldDescriptor[] => [
  ...extra,
  grouped('street', 'addresses'),
  grouped('city', 'addresses'),
];

const sectorFields = (extra: FieldDescriptor[] = [onceField({ id: 'activityCountry', label: 'Country of activity', validation: [] })]): FieldDescriptor[] => [
  ...extra,
  grouped('sector', 'businessSectors', {
    type: 'dropdown',
    items: [
      { label: 'Holding', value: 'holding' },
      { label: 'Retail', value: 'retail' },
    ],
    validation: [{ type: 'required', message: 'Sector is required' }],
  }),
  grouped('percentage', 'businessSectors', { type: 'number' }),
];

describe('buildZodSchemaFromDescriptor with repeatOnce', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const parse = (values: unknown, descriptor: GlobalFormDescriptor, context: FormContext = {}) =>
    buildZodSchemaFromDescriptor(descriptor, context).safeParse(values);

  test('given an inline repeatable block with repeatOnce, should validate that field at its own key and keep it off the row', () => {
    const descriptor = descriptorOf(addressBlock(addressFields()));
    const invalid = parse({ country: 'F', addresses: [{ street: '1 main', city: 'Paris' }] }, descriptor);
    const valid = parse(
      {
        country: 'FR',
        addresses: [{ street: '1 main', city: 'Paris', country: 'DE' }],
      },
      descriptor
    );

    expect(!invalid.success && invalid.error.issues.map((issue) => issue.path.join('.'))).toEqual(['country']);
    expect(valid.success && valid.data).toEqual({
      country: 'FR',
      addresses: [{ street: '1 main', city: 'Paris' }],
    });
  });

  test('given repeatableChild, should keep the once-field out of the child schema', () => {
    const descriptor = descriptorOf(sectorBlock(sectorFields()));
    const result = parse(
      {
        activityCountry: 'FR',
        businessSectors: [
          {
            sector: 'holding',
            percentage: 60,
            activityCountry: 'DE',
            subsectors: [{ sector: 'retail', percentage: 10, activityCountry: 'US' }],
          },
        ],
      },
      descriptor
    );

    expect(result.success && result.data).toEqual({
      activityCountry: 'FR',
      businessSectors: [
        {
          sector: 'holding',
          percentage: 60,
          subsectors: [{ sector: 'retail', percentage: 10 }],
        },
      ],
    });
  });

  test('given a hidden once-field, should omit it from the schema', () => {
    const descriptor = descriptorOf(
      addressBlock(
        addressFields([
          onceField({ status: { hidden: '{{eq mode "simple"}}' } }),
        ])
      )
    );
    const result = parse(
      { country: 'FR', addresses: [{ street: '1 main', city: 'Paris' }] },
      descriptor,
      { mode: 'simple' }
    );

    expect(result.success && result.data).toEqual({
      addresses: [{ street: '1 main', city: 'Paris' }],
    });
  });

  test('given a progress once-field, should leave that id out of the parsed value', () => {
    const descriptor = descriptorOf(
      sectorBlock(
        sectorFields([
          {
            id: 'sectorShare',
            type: 'progress',
            label: 'Total share',
            repeatOnce: true,
            progress: { sumField: 'percentage', max: 100 },
            validation: [],
          },
        ])
      )
    );
    const result = parse(
      {
        sectorShare: 100,
        businessSectors: [
          {
            sector: 'holding',
            percentage: 70,
            sectorShare: 40,
            subsectors: [{ sector: 'retail', percentage: 40, sectorShare: 40 }],
          },
        ],
      },
      descriptor
    );

    expect(result.success && result.data).toEqual({
      businessSectors: [
        {
          sector: 'holding',
          percentage: 70,
          subsectors: [{ sector: 'retail', percentage: 40 }],
        },
      ],
    });
  });

  test('given a block with no repeatOnce fields, should keep the row schema unchanged', () => {
    const descriptor = descriptorOf(addressBlock(addressFields([])));
    const result = parse(
      { country: 'FR', addresses: [{ street: '1 main', city: 'Paris' }] },
      descriptor
    );

    expect(result.success && result.data).toEqual({
      addresses: [{ street: '1 main', city: 'Paris' }],
    });
  });
});

describe('extractDefaultValues with repeatOnce', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  test('given a once-field default, should write it at the field id and not on the row', () => {
    const descriptor = descriptorOf(
      addressBlock(
        addressFields([onceField({ defaultValue: '{{caseContext.country}}', validation: [] })]),
        { repeatableDefaultSource: 'addresses' }
      )
    );
    const defaults = extractDefaultValues(descriptor, {
      caseContext: {
        country: 'FR',
        addresses: [{ street: '1 main', city: 'Paris', country: 'DE' }],
      },
    }) as Record<string, unknown>;

    expect(defaults.country).toBe('FR');
    expect(defaults.addresses).toEqual([{ street: '1 main', city: 'Paris' }]);
  });

  test('given a source row that contains the once-field key, should not copy that key onto the row or out of the source', () => {
    const descriptor = descriptorOf(
      addressBlock(addressFields([onceField({ validation: [] })]), {
        repeatableDefaultSource: 'addresses',
      })
    );
    const defaults = extractDefaultValues(descriptor, {
      caseContext: {
        addresses: [{ street: '1 main', city: 'Paris', country: 'DE' }],
      },
    }) as Record<string, unknown>;

    expect(defaults.country).toBe('');
    expect(defaults.addresses).toEqual([{ street: '1 main', city: 'Paris' }]);
  });

  test('given repeatableChild, should leave the once-field out of child prefill', () => {
    const descriptor = descriptorOf(sectorBlock(sectorFields([onceField({ id: 'activityCountry', validation: [], defaultValue: '{{caseContext.activityCountry}}' })])));
    const defaults = extractDefaultValues(descriptor, {
      caseContext: {
        activityCountry: 'FR',
        businessSectors: [
          {
            sector: 'holding',
            percentage: 60,
            activityCountry: 'DE',
            subsectors: [{ sector: 'retail', percentage: 10, activityCountry: 'US' }],
          },
        ],
      },
    }) as Record<string, unknown>;

    expect(defaults.activityCountry).toBe('FR');
    expect(defaults.businessSectors).toEqual([
      {
        sector: 'holding',
        percentage: 60,
        subsectors: [{ sector: 'retail', percentage: 10 }],
      },
    ]);
  });

  test('given a hidden block, should not contribute the once-field', () => {
    const descriptor = descriptorOf(
      addressBlock(addressFields([onceField({ defaultValue: 'FR', validation: [] })]), {
        status: { hidden: 'true' },
      })
    );

    expect(extractDefaultValues(descriptor, {})).toEqual({});
  });

  test('given a progress once-field, should not write it into the defaults', () => {
    const descriptor = descriptorOf(
      sectorBlock(
        sectorFields([
          {
            id: 'sectorShare',
            type: 'progress',
            label: 'Total share',
            repeatOnce: true,
            progress: { sumField: 'percentage', max: 100 },
            validation: [],
          },
        ])
      )
    );
    const defaults = extractDefaultValues(descriptor, {
      caseContext: {
        businessSectors: [
          {
            sector: 'holding',
            percentage: 70,
            subsectors: [{ sector: 'retail', percentage: 40 }],
          },
        ],
      },
    }) as Record<string, unknown>;

    expect(defaults.sectorShare).toBeUndefined();
    expect(defaults.businessSectors).toEqual([
      {
        sector: 'holding',
        percentage: 70,
        subsectors: [{ sector: 'retail', percentage: 40 }],
      },
    ]);
  });

  test('given a block with no repeatOnce fields, should keep today\'s row defaults', () => {
    const descriptor = descriptorOf(
      addressBlock(addressFields([]), { repeatableDefaultSource: 'addresses' })
    );
    const defaults = extractDefaultValues(descriptor, {
      caseContext: { addresses: [{ street: '1 main', city: 'Paris' }] },
    });

    expect(defaults).toEqual({ addresses: [{ street: '1 main', city: 'Paris' }] });
  });
});
