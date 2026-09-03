/**
 * Tests for live Zod resolver membership (hide/show contract) and watch sync safety.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';
import {
  useLiveZodResolver,
  useFormMembershipSync,
} from './use-live-zod-resolver';

function createToggleDescriptor(): GlobalFormDescriptor {
  return {
    blocks: [
      {
        id: 'block1',
        title: 'Block 1',
        fields: [
          {
            id: 'showExtra',
            type: 'checkbox',
            label: 'Show extra',
            validation: [],
          },
          {
            id: 'extraField',
            type: 'text',
            label: 'Extra',
            validation: [{ type: 'required' }],
            status: {
              hidden: '{{#if showExtra}}false{{else}}true{{/if}}',
            },
          },
        ],
      },
    ],
    submission: { url: '/api/submit', method: 'POST' },
  };
}

function useSyncedForm(descriptor: GlobalFormDescriptor | null) {
  const { resolver, applyMembershipChanges, refreshSchemaFromDescriptor } =
    useLiveZodResolver({ descriptor });
  const form = useForm({
    resolver,
    defaultValues: { showExtra: false, extraField: 'stashed' },
    mode: 'onChange',
  });
  useFormMembershipSync(
    form,
    descriptor,
    applyMembershipChanges,
    refreshSchemaFromDescriptor
  );
  return form;
}

describe('useLiveZodResolver membership', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  test('given hidden required field, should omit from values and errors after membership apply', async () => {
    const descriptor = createToggleDescriptor();
    const { result } = renderHook(() => useLiveZodResolver({ descriptor }));
    const { result: formResult } = renderHook(() =>
      useForm({
        resolver: result.current.resolver,
        defaultValues: { showExtra: false, extraField: 'stashed' },
      })
    );

    await act(async () => {
      result.current.applyMembershipChanges(formResult.current, {
        showExtra: false,
        extraField: 'stashed',
      });
    });

    expect(formResult.current.getValues()).not.toHaveProperty('extraField');
    expect(formResult.current.formState.errors.extraField).toBeUndefined();
  });

  test('given mount with membership sync, should not show validation errors before user interaction', async () => {
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'email',
              type: 'text',
              label: 'Email',
              validation: [{ type: 'required' }],
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const { result } = renderHook(() => {
      const bundle = useLiveZodResolver({ descriptor });
      const form = useForm({
        resolver: bundle.resolver,
        defaultValues: { email: '' },
        mode: 'onChange',
      });
      useFormMembershipSync(
        form,
        descriptor,
        bundle.applyMembershipChanges,
        bundle.refreshSchemaFromDescriptor
      );
      return form;
    });

    await act(async () => {
      // Allow effects to flush
    });

    expect(result.current.formState.errors.email).toBeUndefined();
    expect(Object.keys(result.current.formState.errors)).toHaveLength(0);
  });

  test('given discriminant-style toggle via watch sync, should not stack-overflow and should restore value', async () => {
    const descriptor = createToggleDescriptor();
    const { result } = renderHook(() => useSyncedForm(descriptor));

    await waitFor(() => {
      expect(result.current.getValues()).not.toHaveProperty('extraField');
    });

    await act(async () => {
      result.current.setValue('showExtra', true, { shouldValidate: false });
    });

    await waitFor(() => {
      expect(result.current.getValues().extraField).toBe('stashed');
    });

    // Hide again — must complete without RangeError
    await act(async () => {
      result.current.setValue('showExtra', false, { shouldValidate: false });
    });

    await waitFor(() => {
      expect(result.current.getValues()).not.toHaveProperty('extraField');
    });
  });

  test('given field becomes visible after init, should restore stashed value without showing errors', async () => {
    const descriptor = createToggleDescriptor();
    const { result } = renderHook(() => useSyncedForm(descriptor));

    await waitFor(() => {
      expect(result.current.getValues()).not.toHaveProperty('extraField');
    });

    await act(async () => {
      result.current.setValue('showExtra', true, { shouldValidate: false });
    });

    await waitFor(() => {
      expect(result.current.getValues().extraField).toBe('stashed');
    });

    expect(result.current.formState.errors.extraField).toBeUndefined();

    await act(async () => {
      result.current.setValue('extraField', '', { shouldValidate: false });
      await result.current.trigger('extraField');
    });

    await waitFor(() => {
      expect(result.current.formState.errors.extraField).toBeDefined();
    });
  });

  test('given refreshSchemaFromDescriptor, should not trigger full-form validation', async () => {
    const descriptor: GlobalFormDescriptor = {
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'email',
              type: 'text',
              label: 'Email',
              validation: [{ type: 'required' }],
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };

    const { result } = renderHook(() => useLiveZodResolver({ descriptor }));
    const { result: formResult } = renderHook(() =>
      useForm({
        resolver: result.current.resolver,
        defaultValues: { email: '' },
        mode: 'onChange',
      })
    );

    await act(async () => {
      result.current.refreshSchemaFromDescriptor(formResult.current);
    });

    expect(formResult.current.formState.errors.email).toBeUndefined();
  });
});
