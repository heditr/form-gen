/**
 * Tests for FormStatusProvider — status map with referential stability.
 */

import { describe, test, expect } from 'vitest';
import React, { useEffect } from 'react';
import { render, renderHook, act, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { FormStatusProvider, useBlockStatus, useFieldStatus } from './form-status-context';

const descriptor: GlobalFormDescriptor = {
  blocks: [
    {
      id: 'block1',
      title: 'Block 1',
      fields: [
        {
          id: 'field1',
          type: 'text',
          label: 'Field 1',
          validation: [],
          status: { hidden: 'false' },
        },
      ],
      status: { hidden: 'false' },
    },
  ],
  submission: { url: '/api/submit', method: 'POST' },
};

describe('FormStatusProvider', () => {
  test('given stable form values, should return stable block status reference', async () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      const form = useForm({ defaultValues: { field1: 'a' } });
      return (
        <FormStatusProvider form={form} caseContext={{}} descriptor={descriptor}>
          {children}
        </FormStatusProvider>
      );
    };

    const { result, rerender } = renderHook(() => useBlockStatus('block1'), { wrapper: Wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  test('given a field hidden template, should update that field when watched values change', async () => {
    const statusDescriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'city',
              type: 'text',
              label: 'City',
              validation: [],
              status: { hidden: '{{#if (eq toggle "hide")}}true{{else}}false{{/if}}' },
            },
            {
              id: 'notes',
              type: 'text',
              label: 'Notes',
              validation: [],
              status: { hidden: 'false' },
            },
          ],
          status: { hidden: 'false' },
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const seen: Array<{ cityHidden: boolean; notes: ReturnType<typeof useFieldStatus> }> = [];

    function StatusProbe() {
      const city = useFieldStatus('city');
      const notes = useFieldStatus('notes');
      useEffect(() => {
        seen.push({ cityHidden: city.hidden, notes });
      }, [city, notes]);
      return null;
    }

    function Harness() {
      const form = useForm({ defaultValues: { toggle: 'show', city: 'Paris', notes: 'n' } });
      return (
        <FormStatusProvider form={form} caseContext={{}} descriptor={statusDescriptor}>
          <StatusProbe />
          <button type="button" onClick={() => form.setValue('toggle', 'hide')}>
            Hide city
          </button>
        </FormStatusProvider>
      );
    }

    render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(seen.at(-1)?.cityHidden).toBe(false);
    const stableNotes = seen.at(-1)?.notes;

    await act(async () => {
      screen.getByRole('button', { name: 'Hide city' }).click();
      await Promise.resolve();
    });

    expect(seen.at(-1)?.cityHidden).toBe(true);
    expect(seen.at(-1)?.notes).toBe(stableNotes);
  });
});
