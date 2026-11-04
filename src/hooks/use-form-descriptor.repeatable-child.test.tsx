/**
 * Tests for useFormDescriptor with repeatable child rows.
 *
 * A saved draft may hold child lists under rows whose trigger no longer opens
 * them (for example after the descriptor changed its trigger values). They are
 * pruned when the saved values are merged into the initial form values.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import { useFormDescriptor } from './use-form-descriptor';

const descriptor: GlobalFormDescriptor = {
  blocks: [
    {
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
      fields: [
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
        },
      ],
    },
  ],
  submission: { url: '/api/submit', method: 'POST' },
};

describe('useFormDescriptor with repeatableChild', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  test('given a saved draft with a child list under a row that is not a trigger, should drop the list from the initial values', () => {
    const savedFormData = {
      businessSectors: [
        { sector: 'retail', subsectors: [{ sector: 'retail' }] },
        { sector: 'holding', subsectors: [{ sector: 'retail' }] },
      ],
    };

    const { result } = renderHook(() => useFormDescriptor(descriptor, { savedFormData }));

    expect(result.current.form.getValues()).toEqual({
      businessSectors: [
        { sector: 'retail' },
        { sector: 'holding', subsectors: [{ sector: 'retail' }] },
      ],
    });
  });
});
