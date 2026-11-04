/**
 * Tests for repeatable child rows in the descriptor integration utilities.
 *
 * A root row of an inline repeatable block may hold one child list of the same
 * group. The schema must declare it, defaults must seed and prune it, and blocks
 * without `repeatableChild` must behave as before.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import type { BlockDescriptor, FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import { buildZodSchemaFromDescriptor, extractDefaultValues } from './form-descriptor-integration';

const sectorFields = (overrides: Record<string, Partial<FieldDescriptor>> = {}): FieldDescriptor[] => [
  {
    id: 'businessSectors.sector',
    type: 'dropdown',
    label: 'Sector',
    repeatableGroupId: 'businessSectors',
    items: [
      { label: 'Holding', value: 'holding' },
      { label: 'Software', value: 'software' },
      { label: 'Retail', value: 'retail' },
    ],
    validation: [{ type: 'required', message: 'Sector is required' }],
    ...overrides.sector,
  },
  {
    id: 'businessSectors.percentage',
    type: 'number',
    label: 'Percentage',
    repeatableGroupId: 'businessSectors',
    validation: [],
    ...overrides.percentage,
  },
];

const sectorBlock = (
  overrides: Partial<BlockDescriptor> = {},
  childOverrides: Record<string, unknown> = {}
): BlockDescriptor => ({
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  minInstances: 0,
  maxInstances: 10,
  repeatableDefaultSource: 'businessSectors',
  repeatableChild: {
    property: 'subsectors',
    maxDepth: 2,
    title: 'Subsector',
    addLabel: 'Add subsector',
    triggerField: 'sector',
    triggerValues: ['holding'],
    minInstances: 0,
    maxInstances: 2,
    ...childOverrides,
  },
  fields: sectorFields(),
  ...overrides,
});

const descriptorOf = (...blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
  blocks,
  submission: { url: '/api/submit', method: 'POST' },
});

const sub = (sector: string, percentage = 10) => ({ sector, percentage });

describe('buildZodSchemaFromDescriptor with repeatableChild', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const parse = (values: unknown, descriptor = descriptorOf(sectorBlock()), context: FormContext = {}) =>
    buildZodSchemaFromDescriptor(descriptor, context).safeParse(values);

  const holding = (subsectors?: unknown) => ({
    businessSectors: [{ sector: 'holding', percentage: 60, ...(subsectors ? { subsectors } : {}) }],
  });

  test('given a root row with no child list, should be valid', () => {
    expect(parse(holding()).success).toBe(true);
  });

  test('given an empty child list and child min 0, should be valid', () => {
    expect(parse(holding([])).success).toBe(true);
  });

  test('given an empty child list and child min 1, should fail with the min message at the child array path', () => {
    const result = parse(holding([]), descriptorOf(sectorBlock({}, { minInstances: 1 })));

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]).toMatchObject({
      path: ['businessSectors', 0, 'subsectors'],
      message: 'At least 1 instance(s) required',
    });
  });

  test('given child min 1 and root min 0, should accept an empty root list', () => {
    const descriptor = descriptorOf(sectorBlock({ minInstances: 0 }, { minInstances: 1 }));

    expect(parse({ businessSectors: [] }, descriptor).success).toBe(true);
  });

  test('given a child list with a valid row, should keep the child rows in the parsed output', () => {
    const result = parse(holding([sub('software', 40)]));

    expect(result.success && result.data).toEqual(holding([sub('software', 40)]));
  });

  test('given more child rows than the child max, should fail with the max message', () => {
    const result = parse(holding([sub('retail'), sub('retail'), sub('retail')]));

    expect(!result.success && result.error.issues[0]).toMatchObject({
      path: ['businessSectors', 0, 'subsectors'],
      message: 'At most 2 instance(s) allowed',
    });
  });

  test('given an invalid child row field, should fail at the dot-index path of that field only', () => {
    const result = parse({
      businessSectors: [
        { sector: 'retail', percentage: 30 },
        { sector: 'holding', percentage: 70, subsectors: [sub('software'), { sector: '', percentage: 5 }] },
      ],
    });

    expect(!result.success && result.error.issues.map((issue) => issue.path.join('.'))).toEqual([
      'businessSectors.1.subsectors.1.sector',
    ]);
  });

  test('given a child row that holds its own child list, should fail at that row\'s child property', () => {
    const result = parse(holding([{ ...sub('holding'), subsectors: [sub('retail')] }]));

    expect(!result.success && result.error.issues.map((issue) => issue.path.join('.'))).toEqual([
      'businessSectors.0.subsectors.0.subsectors',
    ]);
  });

  test('given a child row, should apply the same field rules and status-hidden filter as a root row', () => {
    const descriptor = descriptorOf(
      sectorBlock({
        fields: sectorFields({
          sector: { status: { hidden: '{{eq mode "simple"}}' } },
        }),
      })
    );

    expect(
      parse({ businessSectors: [{ percentage: 1, subsectors: [{ percentage: 2 }] }] }, descriptor, {
        mode: 'simple',
      }).success
    ).toBe(true);
  });

  test('given a hidden block, should exclude the group from the schema so its values are dropped', () => {
    const descriptor = descriptorOf(sectorBlock({ status: { hidden: '{{eq mode "simple"}}' } }));
    const result = parse(holding([sub('retail')]), descriptor, { mode: 'simple' });

    expect(result.success && result.data).toEqual({});
  });

  test('given a block without repeatableChild, should strip an unknown child key as before', () => {
    const descriptor = descriptorOf(sectorBlock({ repeatableChild: undefined }));
    const result = parse(holding([sub('retail')]), descriptor);

    expect(result.success && result.data).toEqual({
      businessSectors: [{ sector: 'holding', percentage: 60 }],
    });
  });
});

describe('extractDefaultValues with repeatableChild', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const context = (rows: unknown): FormContext =>
    ({ caseContext: { businessSectors: rows } }) as unknown as FormContext;

  const defaults = (rows: unknown, descriptor = descriptorOf(sectorBlock()), extra: FormContext = {}) =>
    extractDefaultValues(descriptor, { ...context(rows), ...extra }) as Record<string, unknown>;

  test('given source rows with subsectors under a trigger row, should seed root and child rows by base field id', () => {
    expect(
      defaults([
        { sector: 'retail', percentage: 30 },
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'software', percentage: 40, extra: 1 }] },
      ])
    ).toEqual({
      businessSectors: [
        { sector: 'retail', percentage: 30 },
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'software', percentage: 40 }] },
      ],
    });
  });

  test('given a source row with children whose sector is not a trigger value, should seed no children', () => {
    expect(
      defaults([{ sector: 'retail', percentage: 30, subsectors: [{ sector: 'software', percentage: 5 }] }])
    ).toEqual({ businessSectors: [{ sector: 'retail', percentage: 30 }] });
  });

  test('given a holding source row without children, should omit the child key', () => {
    expect(defaults([{ sector: 'holding', percentage: 10 }])).toEqual({
      businessSectors: [{ sector: 'holding', percentage: 10 }],
    });
  });

  test('given a field defaultValue using @index, should bind @index to the root row and copy child rows by base id', () => {
    const descriptor = descriptorOf(
      sectorBlock({
        fields: sectorFields({
          percentage: { defaultValue: '{{caseContext.businessSectors.@index.percentage}}' },
        }),
      })
    );

    expect(
      defaults(
        [
          { sector: 'retail', percentage: 11 },
          { sector: 'holding', percentage: 22, subsectors: [{ sector: 'retail', percentage: 99 }] },
        ],
        descriptor
      )
    ).toEqual({
      businessSectors: [
        { sector: 'retail', percentage: 11 },
        { sector: 'holding', percentage: 22, subsectors: [{ sector: 'retail', percentage: 99 }] },
      ],
    });
  });

  test('given a child field hidden by a row template with no default, should omit it from the child row', () => {
    const descriptor = descriptorOf(
      sectorBlock({
        fields: sectorFields({ percentage: { status: { hidden: '{{eq sector "software"}}' } } }),
      })
    );

    expect(
      defaults(
        [{ sector: 'holding', percentage: 1, subsectors: [{ sector: 'software', percentage: 5 }] }],
        descriptor
      )
    ).toEqual({
      businessSectors: [{ sector: 'holding', percentage: 1, subsectors: [{ sector: 'software' }] }],
    });
  });

  test('given no source rows, should keep the existing empty default', () => {
    expect(extractDefaultValues(descriptorOf(sectorBlock()), {})).toEqual({ businessSectors: [] });
  });
});
