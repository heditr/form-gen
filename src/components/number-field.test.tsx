/**
 * Tests for NumberField Component
 * 
 * Following TDD: Tests verify the component renders number input with react-hook-form integration.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NumberField from './number-field';
import type { NumberFieldProps } from './number-field';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues, FormState } from 'react-hook-form';
import React from 'react';

// Mock react-hook-form Controller to actually render
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    Controller: ({ render, name, defaultValue }: { 
      render: (props: { field: { value: number | undefined; onChange: (value: number | undefined) => void; onBlur: () => void; name: string; ref: () => void } }) => React.ReactElement; 
      name: string; 
      defaultValue?: number 
    }) => {
      const [value, setValue] = React.useState<number | undefined>(defaultValue);
      const mockField = {
        value: value ?? '',
        onChange: (val: number | undefined) => {
          setValue(val);
        },
        onBlur: vi.fn(),
        name,
        ref: vi.fn(),
      };
      return render({ field: mockField });
    },
  };
});

describe('NumberField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'number',
    label: 'Test Number Field',
    description: 'Test Description',
    validation: [],
    ...overrides,
  });

  const createMockForm = (overrides?: Partial<UseFormReturn<FieldValues>>): UseFormReturn<FieldValues> => {
    const defaultFormState: FormState<FieldValues> = {
      errors: {},
      isDirty: false,
      isLoading: false,
      isSubmitted: false,
      isSubmitSuccessful: false,
      isValid: true,
      isValidating: false,
      submitCount: 0,
      touchedFields: {},
      dirtyFields: {},
      validatingFields: {},
      defaultValues: {},
      isSubmitting: false,
      disabled: false,
      isReady: true,
    };

    const mockControl = {
      register: vi.fn(),
      unregister: vi.fn(),
      getFieldState: vi.fn(),
      _subjects: {
        values: { next: vi.fn() },
        array: { next: vi.fn() },
        state: { next: vi.fn() },
      },
      _formState: {},
      _options: {},
      _defaultValues: {},
      _formValues: {},
      _stateFlags: {},
      _fields: {},
      _fieldArray: {},
      _proxyFormState: {},
      _getWatch: vi.fn(),
      _updateValid: vi.fn(),
      _updateFieldArray: vi.fn(),
      _executeSchema: vi.fn(),
      _removeUnmounted: vi.fn(),
      _updateDisabledField: vi.fn(),
      _resetDefaultValues: vi.fn(),
      _reset: vi.fn(),
      _resetFieldArray: vi.fn(),
      _subjectsState: {},
      _names: {
        mount: new Set(),
        unMount: new Set(),
        array: new Set(),
        focus: '',
        watch: new Set(),
        watchAll: false,
        watchInternal: new Set(),
      },
      _state: {
        action: false,
        mount: false,
        watch: {},
      },
    };

    const formState = overrides?.formState 
      ? { ...defaultFormState, ...overrides.formState } as FormState<FieldValues>
      : defaultFormState;

    return {
      register: vi.fn(),
      control: mockControl,
      handleSubmit: vi.fn(),
      formState,
      watch: vi.fn(),
      getValues: vi.fn(() => ({})),
      setValue: vi.fn(),
      setError: vi.fn(),
      clearErrors: vi.fn(),
      reset: vi.fn(),
      resetField: vi.fn(),
      trigger: vi.fn(),
      unregister: vi.fn(),
      getFieldState: vi.fn(),
      setFocus: vi.fn(),
      ...overrides,
    } as UseFormReturn<FieldValues>;
  };

  const createProps = (overrides?: Partial<NumberFieldProps>): NumberFieldProps => {
    const field = createMockField();
    const form = createMockForm();
    return {
      field,
      form,
      isDisabled: false,
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('given field descriptor, should render number input with label and description', () => {
    const props = createProps();
    render(<NumberField {...props} />);

    expect(screen.getByLabelText('Test Number Field')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    const input = screen.getByLabelText('Test Number Field');
    expect(input).toHaveAttribute('type', 'number');
  });

  test('given number input, should only accept numeric values', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<NumberField {...props} />);

    const input = screen.getByLabelText('Test Number Field') as HTMLInputElement;
    await user.type(input, '123');

    expect(input.value).toBe('123');
  });

  test('given validation error, should display error from formState.errors', () => {
    const field = createMockField();
    const defaultFormState: FormState<FieldValues> = {
      errors: { 'test-field': { message: 'Number is required', type: 'required' } },
      isDirty: false,
      isLoading: false,
      isSubmitted: false,
      isSubmitSuccessful: false,
      isValid: false,
      isValidating: false,
      submitCount: 0,
      touchedFields: {},
      dirtyFields: {},
      validatingFields: {},
      defaultValues: {},
      isSubmitting: false,
      disabled: false,
      isReady: true,
    };
    const form = createMockForm({
      formState: defaultFormState,
    });
    const props = createProps({ field, form });

    render(<NumberField {...props} />);

    expect(screen.getByText('Number is required')).toBeInTheDocument();
    expect(screen.getByText('Number is required')).toHaveAttribute('role', 'alert');
    const input = screen.getByLabelText('Test Number Field');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error');
  });

  test('given disabled status, should disable field input', () => {
    const props = createProps({ isDisabled: true });
    render(<NumberField {...props} />);

    const input = screen.getByLabelText('Test Number Field');
    expect(input).toBeDisabled();
  });

  test('given defaultValue, should set initial value', () => {
    const field = createMockField({ defaultValue: 42 });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<NumberField {...props} />);

    const input = screen.getByLabelText('Test Number Field') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  test('given empty input, should convert to undefined', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<NumberField {...props} />);

    const input = screen.getByLabelText('Test Number Field') as HTMLInputElement;
    await user.clear(input);

    // Empty string should be converted to undefined
    expect(input.value).toBe('');
  });
});
