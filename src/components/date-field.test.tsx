/**
 * Tests for DateField Component
 * 
 * Following TDD: Tests verify the component renders date input with react-hook-form integration.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DateField from './date-field';
import type { DateFieldProps } from './date-field';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues, FormState } from 'react-hook-form';
import React from 'react';

// Mock react-hook-form Controller to actually render
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    Controller: ({ render, name, defaultValue }: { 
      render: (props: { field: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement> | string) => void; onBlur: () => void; name: string; ref: () => void } }) => React.ReactElement; 
      name: string; 
      defaultValue?: string 
    }) => {
      const [value, setValue] = React.useState(defaultValue || '');
      const mockField = {
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement> | string) => {
          setValue(typeof e === 'string' ? e : e.target.value);
        },
        onBlur: vi.fn(),
        name,
        ref: vi.fn(),
      };
      return render({ field: mockField });
    },
  };
});

describe('DateField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'date',
    label: 'Test Field',
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

  const createProps = (overrides?: Partial<DateFieldProps>): DateFieldProps => {
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

  test('given field descriptor, should render date input with label', () => {
    const props = createProps();
    render(<DateField {...props} />);

    const input = screen.getByLabelText('Test Field');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'date');
  });

  test('given react-hook-form integration, should use Controller for field registration', () => {
    const props = createProps();
    render(<DateField {...props} />);

    const input = screen.getByLabelText('Test Field');
    expect(input).toHaveAttribute('name', 'test-field');
    expect(input).toHaveAttribute('id', 'test-field');
    expect(input).toHaveAttribute('type', 'date');
  });

  test('given value change, should use react-hook-form onChange handler', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<DateField {...props} />);

    const input = screen.getByLabelText('Test Field') as HTMLInputElement;
    await user.type(input, '2024-01-15');

    expect(input.value).toBe('2024-01-15');
  });

  test('given validation error, should display error from formState.errors', () => {
    const field = createMockField();
    const defaultFormState: FormState<FieldValues> = {
      errors: { 'test-field': { message: 'Invalid date format', type: 'pattern' } },
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

    render(<DateField {...props} />);

    expect(screen.getByText('Invalid date format')).toBeInTheDocument();
    expect(screen.getByText('Invalid date format')).toHaveAttribute('role', 'alert');
    const input = screen.getByLabelText('Test Field');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error');
  });

  test('given disabled status, should disable date input', () => {
    const props = createProps({ isDisabled: true });
    render(<DateField {...props} />);

    const input = screen.getByLabelText('Test Field');
    expect(input).toBeDisabled();
  });

  test('given field without description, should render without description', () => {
    const field = createMockField({ description: undefined });
    const props = createProps({ field });
    render(<DateField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  test('given defaultValue, should set initial value', () => {
    const field = createMockField({ defaultValue: '2024-01-15' });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<DateField {...props} />);

    const input = screen.getByLabelText('Test Field') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  test('given date input, should have date type attribute', () => {
    const props = createProps();
    render(<DateField {...props} />);

    const input = screen.getByLabelText('Test Field');
    expect(input).toHaveAttribute('type', 'date');
  });
});
