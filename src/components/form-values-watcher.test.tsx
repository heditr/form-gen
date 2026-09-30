/**
 * Tests for FormValuesWatcher component
 *
 * Verifies onDiscriminantChange using previous vs next form values.
 * Value changes do not schedule draft saves; those run on main-form blur.
 */

import { StrictMode } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import type { FieldDescriptor, FormData } from '@/types/form-descriptor';
import FormValuesWatcher from './form-values-watcher';

const discriminantFields: FieldDescriptor[] = [
  { id: 'jurisdiction', type: 'dropdown', label: 'Jurisdiction', validation: [], isDiscriminant: true },
];

function Wrapper({
  onDiscriminantChange,
  fields = discriminantFields,
}: {
  onDiscriminantChange?: (d: Partial<FormData>) => void;
  fields?: FieldDescriptor[];
}) {
  const form = useForm({
    defaultValues: { jurisdiction: 'US', email: 'a@example.com' },
  });

  return (
    <FormProvider {...form}>
      <FormValuesWatcher
        form={form}
        discriminantFields={fields}
        onDiscriminantChange={onDiscriminantChange}
      />
      <button
        type="button"
        data-testid="set-email"
        onClick={() => form.setValue('email', 'b@example.com', { shouldDirty: true, shouldTouch: true })}
      >
        Set email
      </button>
      <button
        type="button"
        data-testid="set-jurisdiction"
        onClick={() => form.setValue('jurisdiction', 'CA', { shouldDirty: true, shouldTouch: true })}
      >
        Set jurisdiction
      </button>
    </FormProvider>
  );
}

async function flushDeferredWatch() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('FormValuesWatcher', () => {
  test('given no onDiscriminantChange callback, should not throw', async () => {
    expect(() => {
      render(<Wrapper />);
    }).not.toThrow();
    await flushDeferredWatch();
  });

  test('given initial mount, should not invoke onDiscriminantChange', async () => {
    const onDiscriminantChange = vi.fn();

    render(<Wrapper onDiscriminantChange={onDiscriminantChange} />);
    await flushDeferredWatch();

    expect(onDiscriminantChange).not.toHaveBeenCalled();
  });

  test('given only non-discriminant field changes, should not invoke onDiscriminantChange', async () => {
    const onDiscriminantChange = vi.fn();

    const { getByTestId } = render(
      <Wrapper onDiscriminantChange={onDiscriminantChange} />,
    );
    await flushDeferredWatch();

    await act(async () => {
      getByTestId('set-email').click();
    });
    await flushDeferredWatch();

    expect(onDiscriminantChange).not.toHaveBeenCalled();
  });

  test('given discriminant field changes, should invoke onDiscriminantChange', async () => {
    const onDiscriminantChange = vi.fn();

    const { getByTestId } = render(
      <Wrapper onDiscriminantChange={onDiscriminantChange} />,
    );
    await flushDeferredWatch();
    onDiscriminantChange.mockClear();

    await act(async () => {
      getByTestId('set-jurisdiction').click();
    });
    await flushDeferredWatch();

    expect(onDiscriminantChange).toHaveBeenCalledWith(
      expect.objectContaining({ jurisdiction: 'CA' }),
    );
  });

  test('given StrictMode remount, should still invoke onDiscriminantChange', async () => {
    const onDiscriminantChange = vi.fn();

    const { getByTestId } = render(
      <StrictMode>
        <Wrapper onDiscriminantChange={onDiscriminantChange} />
      </StrictMode>,
    );
    await flushDeferredWatch();

    await act(async () => {
      getByTestId('set-jurisdiction').click();
    });
    await flushDeferredWatch();

    expect(onDiscriminantChange).toHaveBeenCalledWith(
      expect.objectContaining({ jurisdiction: 'CA' }),
    );
  });

  test('given callback identity changes after value change, should still invoke onDiscriminantChange', async () => {
    const first = vi.fn();
    const second = vi.fn();

    const { getByTestId, rerender } = render(
      <Wrapper onDiscriminantChange={first} />,
    );
    await flushDeferredWatch();

    await act(async () => {
      getByTestId('set-jurisdiction').click();
    });

    // Simulate parent re-render with a new callback before the deferred notify runs
    rerender(<Wrapper onDiscriminantChange={second} />);
    await flushDeferredWatch();

    expect(first.mock.calls.length + second.mock.calls.length).toBeGreaterThan(0);
  });
});
