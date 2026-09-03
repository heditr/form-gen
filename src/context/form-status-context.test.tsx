/**
 * Tests for FormStatusProvider — status map with referential stability.
 */

import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { FormStatusProvider, useBlockStatus } from './form-status-context';

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
    const wrapper = ({ children }: { children: React.ReactNode }) => {
      const form = useForm({ defaultValues: { field1: 'a' } });
      return (
        <FormStatusProvider form={form} caseContext={{}} descriptor={descriptor}>
          {children}
        </FormStatusProvider>
      );
    };

    const { result, rerender } = renderHook(() => useBlockStatus('block1'), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
