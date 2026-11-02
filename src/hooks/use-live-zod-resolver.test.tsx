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
import { setHiddenAutoFillHold } from '@/utils/auto-fill-hidden-hold';

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

  test('given reset restoring hidden keys without a target change, should omit them again', async () => {
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

    await act(async () => {
      formResult.current.reset({ showExtra: false, extraField: 'restored' });
      result.current.applyMembershipChanges(formResult.current, {
        showExtra: false,
        extraField: 'restored',
      });
    });

    expect(formResult.current.getValues()).not.toHaveProperty('extraField');
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

  function createHeldCompanyDescriptor(): GlobalFormDescriptor {
    return {
      blocks: [
        {
          id: 'company-block',
          title: 'Company',
          fields: [
            {
              id: 'companySelector',
              type: 'autocomplete',
              label: 'Company',
              validation: [],
            },
            {
              id: 'showDetails',
              type: 'checkbox',
              label: 'Show details',
              validation: [],
            },
            {
              id: 'companyName',
              type: 'text',
              label: 'Company name',
              validation: [],
              status: {
                hidden: '{{#if showDetails}}false{{else}}true{{/if}}',
              },
            },
          ],
        },
      ],
      submission: { url: '/api/submit', method: 'POST' },
    };
  }

  test('given a field hidden at selection, should apply the held value when it is shown', async () => {
    const descriptor = createHeldCompanyDescriptor();
    const { result } = renderHook(() => useLiveZodResolver({ descriptor }));
    const { result: formResult } = renderHook(() =>
      useForm({
        resolver: result.current.resolver,
        defaultValues: { companySelector: 'acme', showDetails: false, companyName: '' },
      })
    );

    await act(async () => {
      result.current.applyMembershipChanges(formResult.current, {
        companySelector: 'acme',
        showDetails: false,
        companyName: '',
      });
    });

    setHiddenAutoFillHold(formResult.current, 'companyName', {
      sourceFieldId: 'companySelector',
      sourceValue: 'acme',
      value: 'Acme Corp',
    });

    await act(async () => {
      formResult.current.setValue('showDetails', true);
      result.current.applyMembershipChanges(formResult.current, {
        companySelector: 'acme',
        showDetails: true,
      });
    });

    expect(formResult.current.getValues('companyName')).toBe('Acme Corp');
  });

  test('given the selector was cleared, should not apply the held autoFill value', async () => {
    const descriptor = createHeldCompanyDescriptor();
    const { result } = renderHook(() => useLiveZodResolver({ descriptor }));
    const { result: formResult } = renderHook(() =>
      useForm({
        resolver: result.current.resolver,
        defaultValues: { companySelector: '', showDetails: false, companyName: '' },
      })
    );

    await act(async () => {
      result.current.applyMembershipChanges(formResult.current, {
        companySelector: '',
        showDetails: false,
        companyName: '',
      });
    });

    setHiddenAutoFillHold(formResult.current, 'companyName', {
      sourceFieldId: 'companySelector',
      sourceValue: 'acme',
      value: 'Acme Corp',
    });

    await act(async () => {
      formResult.current.setValue('showDetails', true);
      result.current.applyMembershipChanges(formResult.current, {
        companySelector: '',
        showDetails: true,
      });
    });

    expect(formResult.current.getValues('companyName')).not.toBe('Acme Corp');
  });

  test('given the user cleared a shown target, should not refill it from the hold', async () => {
    const descriptor = createHeldCompanyDescriptor();
    const { result } = renderHook(() => useLiveZodResolver({ descriptor }));
    const { result: formResult } = renderHook(() =>
      useForm({
        resolver: result.current.resolver,
        defaultValues: { companySelector: 'acme', showDetails: true, companyName: 'Acme Corp' },
      })
    );

    await act(async () => {
      result.current.applyMembershipChanges(formResult.current, {
        companySelector: 'acme',
        showDetails: true,
        companyName: 'Acme Corp',
      });
    });

    await act(async () => {
      formResult.current.setValue('companyName', '');
      formResult.current.setValue('showDetails', false);
      result.current.applyMembershipChanges(formResult.current, {
        companySelector: 'acme',
        showDetails: false,
        companyName: '',
      });
    });

    setHiddenAutoFillHold(formResult.current, 'companyName', {
      sourceFieldId: 'companySelector',
      sourceValue: 'acme',
      value: 'Acme Corp',
    });

    await act(async () => {
      formResult.current.setValue('showDetails', true);
      result.current.applyMembershipChanges(formResult.current, {
        companySelector: 'acme',
        showDetails: true,
      });
    });

    expect(formResult.current.getValues('companyName')).toBe('');
  });
});
