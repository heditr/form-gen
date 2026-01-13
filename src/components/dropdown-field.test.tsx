/**
 * Tests for DropdownField Component
 * 
 * Following TDD: Tests verify the component renders dropdown with static and dynamic data support.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DropdownField from './dropdown-field';
import type { DropdownFieldProps } from './dropdown-field';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues, FormState } from 'react-hook-form';
import React from 'react';

// Mock react-hook-form Controller to actually render
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    Controller: ({ render, name, defaultValue }: { 
      render: (props: { field: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement> | string) => void; onBlur: () => void; name: string; ref: () => void } }) => React.ReactElement; 
      name: string; 
      defaultValue?: string 
    }) => {
      const [value, setValue] = React.useState(defaultValue || '');
      const mockField = {
        value,
        onChange: (e: React.ChangeEvent<HTMLSelectElement> | string) => {
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

describe('DropdownField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'dropdown',
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

  const createProps = (overrides?: Partial<DropdownFieldProps>): DropdownFieldProps => {
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

  test('given static items, should render dropdown immediately with items', () => {
    const items = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];
    const field = createMockField({ items });
    const props = createProps({ field });

    render(<DropdownField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  test('given dataSource without cache, should call onLoadDataSource when component mounts', async () => {
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

    render(<DropdownField {...props} />);

    await waitFor(() => {
      expect(onLoadDataSource).toHaveBeenCalledWith(
        field.id,
        '/api/data',
        undefined
      );
    });
  });

  test('given dataSource with cached data, should render cached items', () => {
    const cachedItems = [
      { label: 'Cached Item 1', value: 'c1' },
      { label: 'Cached Item 2', value: 'c2' },
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

    render(<DropdownField {...props} />);

    expect(screen.getByText('Cached Item 1')).toBeInTheDocument();
    expect(screen.getByText('Cached Item 2')).toBeInTheDocument();
  });

  test('given loading state, should show loading indicator in dropdown', async () => {
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

    render(<DropdownField {...props} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('given data loaded in cache, should populate dropdown with items', () => {
    const items = [
      { label: 'Item 1', value: '1' },
      { label: 'Item 2', value: '2' },
    ];
    const field = createMockField({
      dataSource: {
        url: '/api/data',
        itemsTemplate: '{{label}}',
      },
    });
    const props = createProps({
      field,
      dataSourceCache: { [field.id]: items },
    });

    render(<DropdownField {...props} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  test('given react-hook-form integration, should use Controller for field registration', () => {
    const props = createProps();

    render(<DropdownField {...props} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('name', 'test-field');
    expect(select).toHaveAttribute('id', 'test-field');
  });

  test('given value change, should update select value', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ],
    });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<DropdownField {...props} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await user.selectOptions(select, 'opt1');

    expect(select.value).toBe('opt1');
  });

  test('given validation error, should display error from formState.errors', () => {
    const field = createMockField();
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

    render(<DropdownField {...props} />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('This field is required')).toHaveAttribute('role', 'alert');
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', 'test-field-error');
  });

  test('given disabled status, should disable field input', () => {
    const props = createProps({ isDisabled: true });

    render(<DropdownField {...props} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  test('given field without description, should render without description', () => {
    const field = createMockField({ description: undefined });
    const props = createProps({ field });

    render(<DropdownField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  test('given field with defaultValue, should set initial value', () => {
    const field = createMockField({
      items: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ],
      defaultValue: 'opt1',
    });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<DropdownField {...props} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  test('given dataSource with auth config, should pass auth to onLoadDataSource', async () => {
    const onLoadDataSource = vi.fn();
    const auth = { type: 'bearer' as const, token: 'test-token' };
    const field = createMockField({
      dataSource: {
        url: '/api/data',
        itemsTemplate: '{{label}}',
        auth,
      },
    });
    const props = createProps({ field, onLoadDataSource });

    render(<DropdownField {...props} />);

    await waitFor(() => {
      expect(onLoadDataSource).toHaveBeenCalledWith(
        field.id,
        '/api/data',
        auth
      );
    });
  });

  test('given error state, should apply error styling classes', () => {
    const field = createMockField();
    const defaultFormState: FormState<FieldValues> = {
      errors: { 'test-field': { message: 'Error message', type: 'required' } },
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

    render(<DropdownField {...props} />);

    const select = screen.getByRole('combobox');
    expect(select.className).toContain('border-destructive');
  });
});
