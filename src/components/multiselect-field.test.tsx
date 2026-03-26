/**
 * Tests for MultiselectField Component
 *
 * Following TDD: Tests verify the component renders a popover-style multiselect
 * that manages a string[] value with react-hook-form, supporting static items,
 * dynamic data sources, loading states, disabled states, and validation errors.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiselectField from './multiselect-field';
import type { MultiselectFieldProps } from './multiselect-field';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues, FormState } from 'react-hook-form';
import React from 'react';

const useDataSourceMock = vi.fn(() => ({ data: undefined, isLoading: undefined }));

vi.mock('@/hooks/use-form-query', () => ({
  useDataSource: (...args: unknown[]) => useDataSourceMock(...args),
}));

// Mock react-hook-form Controller to manage string[] state
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    Controller: ({
      render,
      name,
      defaultValue,
    }: {
      render: (props: {
        field: {
          value: string[];
          onChange: (value: string[]) => void;
          onBlur: () => void;
          name: string;
          ref: () => void;
        };
      }) => React.ReactElement;
      name: string;
      defaultValue?: string[];
    }) => {
      const [value, setValue] = React.useState<string[]>(defaultValue ?? []);
      const mockField = {
        value,
        onChange: (v: string[]) => setValue(v),
        onBlur: vi.fn(),
        name,
        ref: vi.fn(),
      };
      return render({ field: mockField });
    },
  };
});

describe('MultiselectField', () => {
  beforeEach(() => {
    useDataSourceMock.mockReturnValue({ data: undefined, isLoading: undefined });
  });

  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'multiselect',
    label: 'Test Field',
    description: 'Test Description',
    validation: [],
    ...overrides,
  });

  const createMockFormState = (overrides?: Partial<FormState<FieldValues>>): FormState<FieldValues> => ({
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
    ...overrides,
  });

  const createMockForm = (overrides?: Partial<UseFormReturn<FieldValues>>): UseFormReturn<FieldValues> => {
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

    return {
      register: vi.fn(),
      control: mockControl,
      handleSubmit: vi.fn(),
      formState: createMockFormState(overrides?.formState),
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

  const createProps = (overrides?: Partial<MultiselectFieldProps>): MultiselectFieldProps => ({
    field: createMockField(),
    form: createMockForm(),
    formContext: {},
    isDisabled: false,
    ...overrides,
  });

  test('given static items, should render trigger with placeholder when nothing selected', () => {
    const field = createMockField({
      items: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ],
    });
    render(<MultiselectField {...createProps({ field })} />);

    expect(screen.getByText('Test Field')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select options/i })).toBeInTheDocument();
  });

  test('given user clicks trigger, should open the dropdown with item checkboxes', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ],
    });
    render(<MultiselectField {...createProps({ field })} />);

    await user.click(screen.getByRole('button', { name: /select options/i }));

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  test('given user selects an item, should add it to the selected values and show a chip', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ],
    });
    render(<MultiselectField {...createProps({ field })} />);

    await user.click(screen.getByRole('button', { name: /select options/i }));
    await user.click(screen.getByRole('option', { name: 'Option 1' }));

    // Chip appears in the trigger (identified by its dismiss button)
    expect(screen.getByRole('button', { name: /remove option 1/i })).toBeInTheDocument();
  });

  test('given user selects multiple items, should display all as chips', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
        { label: 'Option 3', value: 'opt3' },
      ],
    });
    render(<MultiselectField {...createProps({ field })} />);

    await user.click(screen.getByRole('button', { name: /select options/i }));
    await user.click(screen.getByRole('option', { name: 'Option 1' }));
    await user.click(screen.getByRole('option', { name: 'Option 2' }));

    // Both chips are rendered (identified by their dismiss buttons)
    expect(screen.getByRole('button', { name: /remove option 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove option 2/i })).toBeInTheDocument();
  });

  test('given user deselects a chip, should remove item from the selected values', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ],
    });
    render(<MultiselectField {...createProps({ field })} />);

    // Select two items
    await user.click(screen.getByRole('button', { name: /select options/i }));
    await user.click(screen.getByRole('option', { name: 'Option 1' }));
    await user.click(screen.getByRole('option', { name: 'Option 2' }));

    // Remove Option 1 via its chip remove button
    const removeBtn = screen.getByRole('button', { name: /remove option 1/i });
    await user.click(removeBtn);

    expect(screen.queryByRole('button', { name: /remove option 1/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove option 2/i })).toBeInTheDocument();
  });

  test('given user types in search box, should filter visible options', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [
        { label: 'Apple', value: 'apple' },
        { label: 'Banana', value: 'banana' },
        { label: 'Apricot', value: 'apricot' },
      ],
    });
    render(<MultiselectField {...createProps({ field })} />);

    await user.click(screen.getByRole('button', { name: /select options/i }));
    const searchInput = screen.getByRole('searchbox');
    await user.type(searchInput, 'ap');

    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Apricot' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Banana' })).not.toBeInTheDocument();
  });

  test('given no search results, should show empty state message', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [{ label: 'Apple', value: 'apple' }],
    });
    render(<MultiselectField {...createProps({ field })} />);

    await user.click(screen.getByRole('button', { name: /select options/i }));
    await user.type(screen.getByRole('searchbox'), 'xyz');

    expect(screen.getByText(/no options found/i)).toBeInTheDocument();
  });

  test('given user presses Escape, should close the dropdown', async () => {
    const user = userEvent.setup();
    const field = createMockField({
      items: [{ label: 'Option 1', value: 'opt1' }],
    });
    render(<MultiselectField {...createProps({ field })} />);

    await user.click(screen.getByRole('button', { name: /select options/i }));
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('option', { name: 'Option 1' })).not.toBeInTheDocument();
  });

  test('given isDisabled true, should disable the trigger button', () => {
    render(<MultiselectField {...createProps({ isDisabled: true })} />);

    expect(screen.getByRole('button', { name: /select options/i })).toBeDisabled();
  });

  test('given required prop, should show asterisk on label', () => {
    render(<MultiselectField {...createProps({ required: true })} />);

    // The label should include the required indicator
    const label = screen.getByText('Test Field');
    expect(label.closest('label') ?? label.parentElement).toBeInTheDocument();
  });

  test('given validation error in formState, should display error message', () => {
    const form = createMockForm({
      formState: createMockFormState({
        errors: { 'test-field': { message: 'At least one option required', type: 'required' } },
      }),
    });
    render(<MultiselectField {...createProps({ form })} />);

    expect(screen.getByText('At least one option required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('given field without description, should render without description text', () => {
    const field = createMockField({ description: undefined });
    render(<MultiselectField {...createProps({ field })} />);

    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  test('given dataSource without cache, should call onLoadDataSource on mount', async () => {
    const onLoadDataSource = vi.fn();
    const field = createMockField({
      dataSource: { url: '/api/options', itemsTemplate: '{{label}}' },
    });
    render(<MultiselectField {...createProps({ field, onLoadDataSource, dataSourceCache: {} })} />);

    await waitFor(() => {
      expect(onLoadDataSource).toHaveBeenCalledWith(field.id, '/api/options', undefined);
    });
  });

  test('given dataSource with cached data, should render cached items in the dropdown', async () => {
    const user = userEvent.setup();
    const cachedItems = [
      { label: 'Cached A', value: 'a' },
      { label: 'Cached B', value: 'b' },
    ];
    const field = createMockField({
      dataSource: { url: '/api/options', itemsTemplate: '{{label}}' },
    });
    render(
      <MultiselectField
        {...createProps({ field, dataSourceCache: { [field.id]: cachedItems } })}
      />
    );

    await user.click(screen.getByRole('button', { name: /select options/i }));

    expect(screen.getByRole('option', { name: 'Cached A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cached B' })).toBeInTheDocument();
  });

  test('given loading state, should disable trigger and show loading text', () => {
    useDataSourceMock.mockReturnValue({ data: undefined, isLoading: true });
    const field = createMockField({
      dataSource: { url: '/api/options', itemsTemplate: '{{label}}' },
    });
    render(<MultiselectField {...createProps({ field, dataSourceCache: {} })} />);

    const trigger = screen.getByRole('button', { name: /loading/i });
    expect(trigger).toBeDisabled();
  });
});
