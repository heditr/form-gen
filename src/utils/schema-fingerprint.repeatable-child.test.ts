/**
 * Tests for omitStatusHiddenFormValues with repeatable child rows.
 *
 * Submit-time stripping must reach one level into child rows and must drop
 * child lists that the row's trigger no longer opens.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import type { BlockDescriptor, FieldDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import { omitStatusHiddenFormValues } from './schema-fingerprint';

const sectorFields = (overrides: Record<string, Partial<FieldDescriptor>> = {}): FieldDescriptor[] => [
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
  fields = sectorFields(),
  overrides: Partial<BlockDescriptor> = {}
): BlockDescriptor => ({
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
  fields,
  ...overrides,
});

const descriptorOf = (block: BlockDescriptor): GlobalFormDescriptor => ({
  blocks: [block],
  submission: { url: '/api/submit', method: 'POST' },
});

describe('omitStatusHiddenFormValues with repeatableChild', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  test('given a child field hidden by its own row, should strip it from that child row only', () => {
    const descriptor = descriptorOf(
      sectorBlock(sectorFields({ percentage: { status: { hidden: '{{eq sector "retail"}}' } } }))
    );
    const values = {
      businessSectors: [
        {
          sector: 'holding',
          percentage: 60,
          subsectors: [
            { sector: 'retail', percentage: 10 },
            { sector: 'holding', percentage: 20 },
          ],
        },
      ],
    };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual({
      businessSectors: [
        {
          sector: 'holding',
          percentage: 60,
          subsectors: [{ sector: 'retail' }, { sector: 'holding', percentage: 20 }],
        },
      ],
    });
  });

  test('given a root row whose trigger no longer opens the child level, should strip its child list', () => {
    const values = {
      businessSectors: [
        { sector: 'retail', percentage: 30, subsectors: [{ sector: 'retail', percentage: 1 }] },
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
      ],
    };

    expect(omitStatusHiddenFormValues(descriptorOf(sectorBlock()), values)).toEqual({
      businessSectors: [
        { sector: 'retail', percentage: 30 },
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
      ],
    });
  });

  test('given a trigger field hidden for the row, should strip the child list', () => {
    const descriptor = descriptorOf(
      sectorBlock(sectorFields({ sector: { status: { hidden: '{{eq percentage 70}}' } } }))
    );
    const values = {
      businessSectors: [
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
      ],
    };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual({
      businessSectors: [{ percentage: 70 }],
    });
  });

  test('given a hidden block, should drop the group and its child lists', () => {
    const descriptor = descriptorOf(
      sectorBlock(sectorFields(), { status: { hidden: '{{eq mode "simple"}}' } })
    );
    const values = {
      mode: 'simple',
      businessSectors: [
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
      ],
    };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual({ mode: 'simple' });
  });

  test('given clean values with a child list, should return the same object', () => {
    const values = {
      businessSectors: [
        { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
      ],
    };

    expect(omitStatusHiddenFormValues(descriptorOf(sectorBlock()), values)).toBe(values);
  });

  test('given values, should not mutate the input', () => {
    const values = {
      businessSectors: [
        { sector: 'retail', percentage: 30, subsectors: [{ sector: 'retail', percentage: 1 }] },
      ],
    };
    const snapshot = JSON.parse(JSON.stringify(values));

    omitStatusHiddenFormValues(descriptorOf(sectorBlock()), values);

    expect(values).toEqual(snapshot);
  });

  const placedDescriptor = (
    sectorOverrides: Partial<BlockDescriptor> = {}
  ): GlobalFormDescriptor => ({
    blocks: [
      {
        id: 'contacts-block',
        title: 'Contacts',
        repeatable: true,
        repeatablePopin: true,
        fields: [
          {
            id: 'contactGroupId.name',
            type: 'text',
            label: 'Name',
            repeatableGroupId: 'contactGroupId',
            validation: [],
          },
        ],
        nestedBlocks: [{ blockId: 'business-sectors-block', position: 'bottom' }],
      },
      sectorBlock(sectorFields(), sectorOverrides),
    ],
    submission: { url: '/api/submit', method: 'POST' },
  });

  test('given a repeatable popin nests the child host, should strip a closed child list on the nested row', () => {
    const values = {
      contactGroupId: [
        {
          name: 'Ada',
          businessSectors: [
            { sector: 'retail', percentage: 30, subsectors: [{ sector: 'retail', percentage: 1 }] },
          ],
        },
        {
          name: 'Grace',
          businessSectors: [
            { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
          ],
        },
      ],
    };

    expect(omitStatusHiddenFormValues(placedDescriptor(), values)).toEqual({
      contactGroupId: [
        {
          name: 'Ada',
          businessSectors: [{ sector: 'retail', percentage: 30 }],
        },
        {
          name: 'Grace',
          businessSectors: [
            { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
          ],
        },
      ],
    });
  });

  test('given a hidden field on an open nested child row, should strip that field only', () => {
    const descriptor = placedDescriptor({
      fields: sectorFields({ percentage: { status: { hidden: '{{eq sector "retail"}}' } } }),
    });
    const values = {
      contactGroupId: [
        {
          name: 'Grace',
          businessSectors: [
            {
              sector: 'holding',
              percentage: 70,
              subsectors: [
                { sector: 'retail', percentage: 10 },
                { sector: 'holding', percentage: 20 },
              ],
            },
          ],
        },
      ],
    };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual({
      contactGroupId: [
        {
          name: 'Grace',
          businessSectors: [
            {
              sector: 'holding',
              percentage: 70,
              subsectors: [{ sector: 'retail' }, { sector: 'holding', percentage: 20 }],
            },
          ],
        },
      ],
    });
  });

  test('given a hidden nested child host, should keep the nested group on the parent row', () => {
    const descriptor = placedDescriptor({ status: { hidden: '{{eq mode "simple"}}' } });
    const values = {
      mode: 'simple',
      contactGroupId: [
        {
          name: 'Grace',
          businessSectors: [
            { sector: 'holding', percentage: 70, subsectors: [{ sector: 'retail', percentage: 2 }] },
          ],
        },
      ],
    };

    expect(omitStatusHiddenFormValues(descriptor, values)).toEqual({
      mode: 'simple',
      contactGroupId: [{ name: 'Grace' }],
    });
  });
});
