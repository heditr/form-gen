/**
 * Tests for RadioField Component
 * 
 * Following TDD: Tests verify the component renders radio buttons with react-hook-form integration.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RadioField from './radio-field';
import type { RadioFieldProps } from './radio-field';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues, FormState } from 'react-hook-form';
import React from 'react';

// Mock react-hook-form Controller to actually render
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    Controller: ({ render, name, defaultValue }: { 
      render: (props: { field: { value: string | number; onChange: (value: string | number) => void; onBlur: () => void; name: string; ref: () => void } }) => React.ReactElement; 
      name: string; 
      defaultValue?: string | number 
    }) => {
      const [value, setValue] = React.useState(defaultValue || '');
      const mockField = {
        value,
        onChange: (newValue: string | number) => {
          setValue(newValue);
        },
        onBlur: vi.fn(),
        name,
        ref: vi.fn(),
      };
      return render({ field: mockField });
    },
  };
});

describe('RadioField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'radio',
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

  const createProps = (overrides?: Partial<RadioFieldProps>): RadioFieldProps => {
    const field = createMockField();
    const form = createMockForm();
    return {
      field,
      form,
      isDisabled: false,
      onLoadDataSource: vi.fn(),
      dataSourceCache: {},
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('given static items, should render radio buttons for each option', () => {
    const items = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];
    const field = createMockField({ items });
    const props = createProps({ field });

    render(<RadioField {...props} />);

    expect(screen.getByText('Test Field')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  test('given dataSource, should call onLoadDataSource when component mounts', async () => {
    const onLoadDataSource = vi.fn();
    const field = createMockField({
      dataSource: {
        url: '/api/data',
        itemsTemplate: '{{label}}',
      },
    });
    const props = createProps({
      field,
      onLoadDataSource,
      dataSourceCache: {},
    });

    render(<RadioField {...props} />);

    await waitFor(() => {
      expect(onLoadDataSource).toHaveBeenCalledWith(
        field.id,
        '/api/data',
        undefined
      );
    });
  });

  test('given dataSource with cached data, should render cached options', () => {
    const cachedItems = [
      { label: 'Cached Option 1', value: 'c1' },
      { label: 'Cached Option 2', value: 'c2' },
    ];
    const field = createMockField({
      dataSource: {
        url: '/api/data',
        itemsTemplate: '{{label}}',
      },
    });
    const props = createProps({
      field,
      dataSourceCache: { [field.id]: cachedItems },
    });

    render(<RadioField {...props} />);

    expect(screen.getByLabelText('Cached Option 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Cached Option 2')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  test('given react-hook-form integration, should use Controller for field registration', () => {
    const items = [
      { label: 'Option 1', value: 'opt1' },
    ];
    const field = createMockField({ items });
    const props = createProps({ field });

    render(<RadioField {...props} />);

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('name', 'test-field');
  });

  test('given value change, should use react-hook-form onChange handler', async () => {
    const user = userEvent.setup();
    const items = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];
    const field = createMockField({ items });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<RadioField {...props} />);

    const option2 = screen.getByLabelText('Option 2');
    await user.click(option2);

    expect(option2).toBeChecked();
  });

  test('given discriminant flag, should handle change event', async () => {
    const user = userEvent.setup();
    const items = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];
    const field = createMockField({ items, isDiscriminant: true });
    const props = createProps({ field });

    render(<RadioField {...props} />);

    const option1 = screen.getByLabelText('Option 1');
    await user.click(option1);

    expect(option1).toBeChecked();
  });

  test('given validation error, should display error from formState.errors', () => {
    const items = [
      { label: 'Option 1', value: 'opt1' },
    ];
    const field = createMockField({ items });
    const defaultFormState: FormState<FieldValues> = {
      errors: { 'test-field': { message: 'This field is required', type: 'required' } },
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

    render(<RadioField {...props} />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('This field is required')).toHaveAttribute('role', 'alert');
  });

  test('given disabled status, should disable all radio buttons', () => {
    const items = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];
    const field = createMockField({ items });
    const props = createProps({ field, isDisabled: true });

    render(<RadioField {...props} />);

    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect(radio).toBeDisabled();
    });
  });

  test('given field without description, should render without description', () => {
    const items = [
      { label: 'Option 1', value: 'opt1' },
    ];
    const field = createMockField({ items, description: undefined });
    const props = createProps({ field });

    render(<RadioField {...props} />);

    expect(screen.getByText('Test Field')).toBeInTheDocument();
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  test('given defaultValue, should set initial selected value', () => {
    const items = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];
    const field = createMockField({ items, defaultValue: 'opt2' });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<RadioField {...props} />);

    const option2 = screen.getByLabelText('Option 2');
    expect(option2).toBeChecked();
  });
});
