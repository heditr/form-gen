/**
 * Tests for AutocompleteField Component
 * 
 * Following TDD: Tests verify the component renders autocomplete with search functionality.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AutocompleteField from './autocomplete-field';
import type { AutocompleteFieldProps } from './autocomplete-field';
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

describe('AutocompleteField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'autocomplete',
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

  const createProps = (overrides?: Partial<AutocompleteFieldProps>): AutocompleteFieldProps => {
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

    render(<AutocompleteField {...props} />);

    await waitFor(() => {
      expect(onLoadDataSource).toHaveBeenCalledWith(
        field.id,
        '/api/data',
        undefined
      );
    });
  });

  test('given user input, should filter options based on search term', async () => {
    const user = userEvent.setup();
    const items = [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
      { label: 'Cherry', value: 'cherry' },
    ];
    const field = createMockField({
      items,
    });
    const props = createProps({ field });

    render(<AutocompleteField {...props} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'app');

    // Should show filtered options
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument();
  });

  test('given react-hook-form integration, should use Controller for field registration', () => {
    const props = createProps();

    render(<AutocompleteField {...props} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('name', 'test-field');
    expect(input).toHaveAttribute('id', 'test-field');
  });

  test('given selection, should use react-hook-form onChange handler', async () => {
    const user = userEvent.setup();
    const items = [
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ];
    const field = createMockField({ items });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<AutocompleteField {...props} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'Option 1');
    
    // Click on the option
    const option = screen.getByText('Option 1');
    await user.click(option);

    expect(input.value).toBe('Option 1');
  });

  test('given loading state, should show loading indicator', async () => {
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

    render(<AutocompleteField {...props} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
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

    render(<AutocompleteField {...props} />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('This field is required')).toHaveAttribute('role', 'alert');
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error');
  });

  test('given dataSource with cached data, should render cached items', async () => {
    const user = userEvent.setup();
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

    render(<AutocompleteField {...props} />);

    // Focus the input to open the dropdown
    const input = screen.getByRole('textbox');
    await user.click(input);

    // Wait for items to appear
    await waitFor(() => {
      expect(screen.getByText('Cached Item 1')).toBeInTheDocument();
      expect(screen.getByText('Cached Item 2')).toBeInTheDocument();
    });
  });

  test('given field without description, should render without description', () => {
    const field = createMockField({ description: undefined });
    const props = createProps({ field });

    render(<AutocompleteField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  test('given disabled status, should disable field input', () => {
    const props = createProps({ isDisabled: true });

    render(<AutocompleteField {...props} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
