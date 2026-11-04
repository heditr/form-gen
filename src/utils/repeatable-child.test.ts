/**
 * Tests for repeatable child row helpers.
 *
 * A root row opens one child list when its trigger field holds a trigger value
 * and is visible. These pure functions decide that, remove stale child lists,
 * seed child rows from a source row, and build form paths.
 */

import { describe, test, expect } from 'vitest';
import type {
  BlockDescriptor,
  FieldDescriptor,
  GlobalFormDescriptor,
} from '@/types/form-descriptor';
import {
  buildNewRowValues,
  buildRowContext,
  childArrayPath,
  childRowPath,
  pruneInactiveChildLists,
  rowOpensChild,
  seedChildRows,
  withRepeatableMeta,
} from './repeatable-child';

const sectorFields = (triggerOverrides: Partial<FieldDescriptor> = {}): FieldDescriptor[] => [
  {
    id: 'businessSectors.sector',
    type: 'dropdown',
    label: 'Sector',
    repeatableGroupId: 'businessSectors',
    items: [
      { label: 'Holding', value: 'holding' },
      { label: 'Retail', value: 'retail' },
    ],
    validation: [],
    ...triggerOverrides,
  },
  {
    id: 'businessSectors.percentage',
    type: 'number',
    label: 'Percentage',
    repeatableGroupId: 'businessSectors',
    validation: [],
  },
];

const sectorBlock = (overrides: Partial<BlockDescriptor> = {}): BlockDescriptor => ({
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  repeatableChild: {
    property: 'subsectors',
    maxDepth: 2,
    title: 'Subsector',
    addLabel: 'Add subsector',
    triggerField: 'sector',
    triggerValues: ['holding'],
  },
  fields: sectorFields(),
  ...overrides,
});

const descriptorOf = (...blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
  blocks,
  submission: { url: '/api/submit', method: 'POST' },
});

describe('childArrayPath and childRowPath', () => {
  test('given a root row index, should build the dot-index path of its child array', () => {
    expect(childArrayPath({ groupId: 'businessSectors', rootIndex: 1, property: 'subsectors' })).toBe(
      'businessSectors.1.subsectors'
    );
  });

  test('given a root and a child index, should build the dot-index path of the child row', () => {
    expect(
      childRowPath({ groupId: 'businessSectors', rootIndex: 0, property: 'subsectors', childIndex: 2 })
    ).toBe('businessSectors.0.subsectors.2');
  });
});

describe('withRepeatableMeta', () => {
  test('given a template using @index, @first and @last, should rewrite them to context keys', () => {
    expect(withRepeatableMeta('{{#if @first}}{{@index}}{{@last}}{{/if}}')).toBe(
      '{{#if first}}{{index}}{{last}}{{/if}}'
    );
  });

  test('given no template, should return it unchanged', () => {
    expect(withRepeatableMeta(undefined)).toBeUndefined();
  });
});

describe('buildRowContext', () => {
  const rows = [{ sector: 'retail' }, { sector: 'holding' }];

  test('given a root row, should expose the group, the row values, and the repeatable meta', () => {
    expect(
      buildRowContext({ formContext: { country: 'US' }, groupId: 'businessSectors', rows, index: 1 })
    ).toEqual({
      country: 'US',
      businessSectors: rows,
      sector: 'holding',
      index: 1,
      first: false,
      last: true,
    });
  });

  test('given depth and parentIndex, should add them to the context', () => {
    expect(
      buildRowContext({
        formContext: {},
        groupId: 'businessSectors',
        rows,
        index: 0,
        depth: 2,
        parentIndex: 3,
      })
    ).toMatchObject({ index: 0, depth: 2, parentIndex: 3 });
  });

  test('given groupRows, should expose them under the group key instead of the row list', () => {
    const childRows = [{ sector: 'software' }];

    expect(
      buildRowContext({
        formContext: {},
        groupId: 'businessSectors',
        rows: childRows,
        groupRows: rows,
        index: 0,
      })
    ).toMatchObject({ businessSectors: rows, sector: 'software', index: 0, last: true });
  });

  test('given no depth, should not add depth or parentIndex keys', () => {
    const context = buildRowContext({ formContext: {}, groupId: 'businessSectors', rows, index: 0 });

    expect('depth' in context).toBe(false);
    expect('parentIndex' in context).toBe(false);
  });
});

describe('rowOpensChild', () => {
  test('given a root row whose trigger value is configured, should open the child level', () => {
    expect(rowOpensChild({ sector: 'holding' }, sectorBlock())).toBe(true);
  });

  test('given a root row whose trigger value is not configured, should not open the child level', () => {
    expect(rowOpensChild({ sector: 'retail' }, sectorBlock())).toBe(false);
  });

  test('given a root row with no trigger value, should not open the child level', () => {
    expect(rowOpensChild({ percentage: 10 }, sectorBlock())).toBe(false);
  });

  test('given a block without repeatableChild, should not open a child level', () => {
    expect(rowOpensChild({ sector: 'holding' }, sectorBlock({ repeatableChild: undefined }))).toBe(false);
  });

  test('given a trigger field hidden by a row template, should not open the child level', () => {
    const block = sectorBlock({
      fields: sectorFields({ status: { hidden: '{{eq country "US"}}' } }),
    });

    expect(rowOpensChild({ sector: 'holding' }, block, { country: 'US' })).toBe(false);
    expect(rowOpensChild({ sector: 'holding' }, block, { country: 'FR' })).toBe(true);
  });

  test('given a hidden template that reads the row, should evaluate it against the row values', () => {
    const block = sectorBlock({
      fields: sectorFields({ status: { hidden: '{{eq percentage 0}}' } }),
    });

    expect(rowOpensChild({ sector: 'holding', percentage: 0 }, block)).toBe(false);
    expect(rowOpensChild({ sector: 'holding', percentage: 5 }, block)).toBe(true);
  });
});

describe('pruneInactiveChildLists', () => {
  const descriptor = descriptorOf(sectorBlock());

  const values = () => ({
    businessSectors: [
      { sector: 'retail', percentage: 30, subsectors: [{ sector: 'retail', percentage: 10 }] },
      { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 20 }] },
    ],
  });

  test('given a row whose trigger no longer matches, should remove only that row\'s child list', () => {
    expect(pruneInactiveChildLists(values(), descriptor)).toEqual({
      businessSectors: [
        { sector: 'retail', percentage: 30 },
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 20 }] },
      ],
    });
  });

  test('given values that need no pruning, should return the same object', () => {
    const clean = {
      businessSectors: [
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 20 }] },
        { sector: 'retail', percentage: 30 },
      ],
    };

    expect(pruneInactiveChildLists(clean, descriptor)).toBe(clean);
  });

  test('given values, should not mutate the input', () => {
    const input = values();
    const snapshot = JSON.parse(JSON.stringify(input));

    pruneInactiveChildLists(input, descriptor);

    expect(input).toEqual(snapshot);
  });

  test('given a block without repeatableChild, should leave its rows untouched', () => {
    const plain = descriptorOf(sectorBlock({ repeatableChild: undefined }));
    const input = values();

    expect(pruneInactiveChildLists(input, plain)).toBe(input);
  });

  test('given a row whose trigger field is hidden by a row template, should remove its child list', () => {
    const hiddenTrigger = descriptorOf(
      sectorBlock({ fields: sectorFields({ status: { hidden: '{{eq percentage 70}}' } }) })
    );

    expect(pruneInactiveChildLists(values(), hiddenTrigger).businessSectors).toEqual([
      { sector: 'retail', percentage: 30 },
      { sector: 'holding', percentage: 70 },
    ]);
  });

  test('given a hidden block, should keep the values so unhiding restores them', () => {
    const hiddenBlock = descriptorOf(sectorBlock({ status: { hidden: '{{eq country "US"}}' } }));
    const input = values();

    expect(pruneInactiveChildLists(input, hiddenBlock, { country: 'US' })).toBe(input);
  });

  test('given no group array in the values, should return the same object', () => {
    const input = { other: 1 };

    expect(pruneInactiveChildLists(input, descriptor)).toBe(input);
  });

  test('given no descriptor, should return the same object', () => {
    const input = values();

    expect(pruneInactiveChildLists(input, null)).toBe(input);
  });
});

describe('seedChildRows', () => {
  const block = sectorBlock();
  const fields = block.fields;

  test('given a source row with children, should build child rows by base field id', () => {
    const sourceRow = {
      sector: 'holding',
      subsectors: [
        { sector: 'retail', percentage: 40, ignored: true },
        { sector: 'holding', percentage: 20 },
      ],
    };

    expect(
      seedChildRows({ sourceRow, fields, groupId: 'businessSectors', property: 'subsectors', formContext: {} })
    ).toEqual([
      { sector: 'retail', percentage: 40 },
      { sector: 'holding', percentage: 20 },
    ]);
  });

  test('given a child missing a field, should fill it with an empty string', () => {
    expect(
      seedChildRows({
        sourceRow: { subsectors: [{ sector: 'retail' }] },
        fields,
        groupId: 'businessSectors',
        property: 'subsectors',
        formContext: {},
      })
    ).toEqual([{ sector: 'retail', percentage: '' }]);
  });

  test.each([
    ['no children key', {}],
    ['an empty child list', { subsectors: [] }],
    ['a child value that is not a list', { subsectors: 'x' }],
  ])('given a source row with %s, should seed no children', (_label, sourceRow) => {
    expect(
      seedChildRows({ sourceRow, fields, groupId: 'businessSectors', property: 'subsectors', formContext: {} })
    ).toBeUndefined();
  });

  test('given a defaultValue using @index, should copy the source value instead of evaluating it', () => {
    const indexed = fields.map((field) =>
      field.id === 'businessSectors.percentage'
        ? { ...field, defaultValue: '{{caseContext.rows.@index.pct}}' }
        : field
    );

    expect(
      seedChildRows({
        sourceRow: { subsectors: [{ sector: 'retail', percentage: 12 }] },
        fields: indexed,
        groupId: 'businessSectors',
        property: 'subsectors',
        formContext: { caseContext: { rows: [{ pct: 99 }] } },
      })
    ).toEqual([{ sector: 'retail', percentage: 12 }]);
  });

  test('given a field hidden on the child row with no default, should omit it', () => {
    const hiddenPercentage = fields.map((field) =>
      field.id === 'businessSectors.percentage'
        ? { ...field, status: { hidden: '{{eq sector "retail"}}' } }
        : field
    );

    expect(
      seedChildRows({
        sourceRow: { subsectors: [{ sector: 'retail', percentage: 12 }] },
        fields: hiddenPercentage,
        groupId: 'businessSectors',
        property: 'subsectors',
        formContext: {},
      })
    ).toEqual([{ sector: 'retail' }]);
  });

  test('given button fields, should skip them', () => {
    const withButton: FieldDescriptor[] = [
      ...fields,
      { id: 'businessSectors.help', type: 'button', label: 'Help', repeatableGroupId: 'businessSectors' } as FieldDescriptor,
    ];

    expect(
      seedChildRows({
        sourceRow: { subsectors: [{ sector: 'retail', percentage: 1 }] },
        fields: withButton,
        groupId: 'businessSectors',
        property: 'subsectors',
        formContext: {},
      })
    ).toEqual([{ sector: 'retail', percentage: 1 }]);
  });
});

describe('buildNewRowValues', () => {
  const field = (id: string, type: FieldDescriptor['type'], extra: Partial<FieldDescriptor> = {}): FieldDescriptor =>
    ({ id: `g.${id}`, type, label: id, repeatableGroupId: 'g', validation: [], ...extra }) as FieldDescriptor;

  test('given fields without defaults, should use the empty value of each type keyed by base field id', () => {
    expect(
      buildNewRowValues({
        fields: [
          field('name', 'text'),
          field('amount', 'number'),
          field('agreed', 'checkbox'),
          field('kind', 'radio'),
          field('born', 'date'),
          field('scan', 'file'),
          field('card', 'document'),
        ],
        groupId: 'g',
        formContext: {},
      })
    ).toEqual({
      name: '',
      amount: 0,
      agreed: false,
      kind: '',
      born: '',
      scan: null,
      card: { requested: false, files: [] },
    });
  });

  test('given a defaultValue template, should evaluate it with the form context', () => {
    expect(
      buildNewRowValues({
        fields: [field('country', 'text', { defaultValue: '{{caseContext.country}}' })],
        groupId: 'g',
        formContext: { caseContext: { country: 'FR' } },
      })
    ).toEqual({ country: 'FR' });
  });

  test('given a button field, should skip it', () => {
    expect(
      buildNewRowValues({ fields: [field('help', 'button'), field('name', 'text')], groupId: 'g', formContext: {} })
    ).toEqual({ name: '' });
  });
});
