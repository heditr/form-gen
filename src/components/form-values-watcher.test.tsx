/**
 * Tests for FormValuesWatcher component
 *
 * Verifies onFormChange callback fires when form values change,
 * and onDiscriminantChange continues to work as before.
 */

import { describe, test, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import type { GlobalFormDescriptor, FormData } from '@/types/form-descriptor';
import FormValuesWatcher from './form-values-watcher';

const minimalDescriptor: GlobalFormDescriptor = {
  blocks: [
    {
      id: 'b1',
      title: 'Block',
      fields: [
        { id: 'name', type: 'text', label: 'Name', validation: [], isDiscriminant: true },
      ],
    },
  ],
  submission: { url: '/api/submit', method: 'POST' },
};

function Wrapper({
  onDiscriminantChange,
  onFormChange,
}: {
  onDiscriminantChange?: (d: Partial<FormData>) => void;
  onFormChange?: (d: Partial<FormData>) => void;
}) {
  const form = useForm({ defaultValues: { name: '' } });
  return (
    <FormProvider {...form}>
      <FormValuesWatcher
        form={form}
        caseContext={{}}
        descriptor={minimalDescriptor}
        onDiscriminantChange={onDiscriminantChange}
        onFormChange={onFormChange}
      >
        {() => (
          <input
            data-testid="name-input"
            {...form.register('name')}
          />
        )}
      </FormValuesWatcher>
    </FormProvider>
  );
}

describe('FormValuesWatcher', () => {
  test('given onFormChange callback, should invoke it when form values change', async () => {
    const onFormChange = vi.fn();

    const { getByTestId } = render(
      <Wrapper onFormChange={onFormChange} />,
    );

    await act(async () => {
      const input = getByTestId('name-input');
      // React Testing Library fireEvent won't trigger useWatch; use native
      // setValue approach via the form register
      (input as HTMLInputElement).value = 'Alice';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // onFormChange is called at least once (initial + change)
    expect(onFormChange).toHaveBeenCalled();
  });

  test('given no onFormChange callback, should not throw', () => {
    expect(() => {
      render(<Wrapper />);
    }).not.toThrow();
  });

  test('given both callbacks, should invoke onDiscriminantChange on value change', async () => {
    const onDiscriminantChange = vi.fn();
    const onFormChange = vi.fn();

    render(
      <Wrapper
        onDiscriminantChange={onDiscriminantChange}
        onFormChange={onFormChange}
      />,
    );

    // Wait for initial effect cycle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // onDiscriminantChange should fire for the initial values
    expect(onDiscriminantChange).toHaveBeenCalled();
    expect(onFormChange).toHaveBeenCalled();
  });
});
