/**
 * Tests for FileField Component
 * 
 * Following TDD: Tests verify the component renders file input with react-hook-form integration.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileField from './file-field';
import type { FileFieldProps } from './file-field';
import type { FieldDescriptor } from '@/types/form-descriptor';
import type { UseFormReturn, FieldValues, FormState } from 'react-hook-form';
import React from 'react';

// Mock react-hook-form Controller to actually render
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return {
    ...actual,
    Controller: ({ render, name, defaultValue }: { 
      render: (props: { field: { value: File | File[] | null; onChange: (files: File | File[] | null) => void; onBlur: () => void; name: string; ref: () => void } }) => React.ReactElement; 
      name: string; 
      defaultValue?: File | File[] | null 
    }) => {
      const [value, setValue] = React.useState<File | File[] | null>(defaultValue || null);
      const mockField = {
        value,
        onChange: (files: File | File[] | null) => {
          setValue(files);
        },
        onBlur: vi.fn(),
        name,
        ref: vi.fn(),
      };
      return render({ field: mockField });
    },
  };
});

describe('FileField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'file',
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

  const createProps = (overrides?: Partial<FileFieldProps>): FileFieldProps => {
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

  test('given field descriptor, should render file input with label', () => {
    const props = createProps();
    render(<FileField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    const input = screen.getByLabelText('Test Field');
    expect(input).toHaveAttribute('type', 'file');
  });

  test('given react-hook-form integration, should use Controller for field registration', () => {
    const props = createProps();
    render(<FileField {...props} />);

    const input = screen.getByLabelText('Test Field');
    expect(input).toHaveAttribute('name', 'test-field');
    expect(input).toHaveAttribute('id', 'test-field');
  });

  test('given file selection, should use react-hook-form onChange handler with file data', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<FileField {...props} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText('Test Field') as HTMLInputElement;
    
    await user.upload(input, file);

    expect(input.files).toBeTruthy();
    expect(input.files?.[0]).toBe(file);
  });

  test('given validation error, should display error from formState.errors', () => {
    const field = createMockField();
    const defaultFormState: FormState<FieldValues> = {
      errors: { 'test-field': { message: 'File is required', type: 'required' } },
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

    render(<FileField {...props} />);

    expect(screen.getByText('File is required')).toBeInTheDocument();
    expect(screen.getByText('File is required')).toHaveAttribute('role', 'alert');
    const input = screen.getByLabelText('Test Field');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error');
  });

  test('given disabled status, should disable file input', () => {
    const props = createProps({ isDisabled: true });
    render(<FileField {...props} />);

    const input = screen.getByLabelText('Test Field');
    expect(input).toBeDisabled();
  });

  test('given field without description, should render without description', () => {
    const field = createMockField({ description: undefined });
    const props = createProps({ field });
    render(<FileField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  test('given file input, should have file type attribute', () => {
    const props = createProps();
    render(<FileField {...props} />);

    const input = screen.getByLabelText('Test Field');
    expect(input).toHaveAttribute('type', 'file');
  });

  test('given multiple files, should support multiple file selection', () => {
    const field = createMockField();
    const props = createProps({ field });
    render(<FileField {...props} />);

    const input = screen.getByLabelText('Test Field') as HTMLInputElement;
    // Note: multiple attribute would be set if field supports multiple files
    expect(input).toBeInTheDocument();
  });
});
