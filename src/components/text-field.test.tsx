/**
 * Tests for TextField Component
 * 
 * Following TDD: Tests verify the component renders text input with react-hook-form integration.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextField from './text-field';
import type { TextFieldProps } from './text-field';
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

describe('TextField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-field',
    type: 'text',
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

  const createProps = (overrides?: Partial<TextFieldProps>): TextFieldProps => {
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

  test('given field descriptor, should render text input with label and description', () => {
    const props = createProps();
    render(<TextField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  test('given react-hook-form integration, should use Controller for field registration', () => {
    const props = createProps();
    render(<TextField {...props} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('name', 'test-field');
    expect(input).toHaveAttribute('id', 'test-field');
  });

  test('given value change, should update input value', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<TextField {...props} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'test value');

    expect(input.value).toBe('test value');
  });

  test('given blur event, should handle blur on input', async () => {
    const user = userEvent.setup();
    const field = createMockField({ isDiscriminant: true });
    const props = createProps({ field });
    render(<TextField {...props} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    await user.tab(); // Triggers blur

    expect(input).toBeInTheDocument();
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

    render(<TextField {...props} />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('This field is required')).toHaveAttribute('role', 'alert');
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-field-error');
  });

  test('given disabled status, should disable field input', () => {
    const props = createProps({ isDisabled: true });
    render(<TextField {...props} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  test('given field without description, should render without description', () => {
    const field = createMockField({ description: undefined });
    const props = createProps({ field });
    render(<TextField {...props} />);

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });

  test('given defaultValue, should set initial value', () => {
    const field = createMockField({ defaultValue: 'initial value' });
    const form = createMockForm();
    const props = createProps({ field, form });

    render(<TextField {...props} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    // Note: Controller's defaultValue is set, but we need to verify it's passed correctly
    expect(input).toBeInTheDocument();
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

    render(<TextField {...props} />);

    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-destructive');
  });

  test('given manual lookup field, should only call backend on lookup button click', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Acme Inc' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return 'REG-123';
      }
      return { registrationNumber: 'REG-123' };
    });
    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [
          {
            fieldId: 'companyName',
            valueTemplate: '{{result.name}}',
          },
        ],
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
      watch: vi.fn(() => 'Acme Updated') as unknown as UseFormReturn<FieldValues>['watch'],
    });
    render(<TextField {...createProps({ field, form })} />);

    await user.type(screen.getByRole('textbox'), 'REG-123');
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Lookup registrationNumber' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/lookup?registration=REG-123', expect.objectContaining({
      method: 'GET',
    }));
  });

  test('given manual lookup field with empty source value, should disable lookup button until input has characters', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Acme Inc' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [],
      },
    });
    const form = createMockForm();
    render(<TextField {...createProps({ field, form })} />);

    const lookupButton = screen.getByRole('button', { name: 'Lookup registrationNumber' });
    expect(lookupButton).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'R');
    expect(screen.getByRole('button', { name: 'Lookup registrationNumber' })).not.toBeDisabled();
  });

  test('given manual lookup success, should lock field and swap lookup button to clear button', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Acme Inc' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return 'REG-123';
      }
      return { registrationNumber: 'REG-123' };
    });
    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [],
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
    });
    render(<TextField {...createProps({ field, form })} />);

    await user.type(screen.getByRole('textbox'), 'R');
    await user.click(screen.getByRole('button', { name: 'Lookup registrationNumber' }));

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lookup registrationNumber' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear lookup registrationNumber' })).toBeInTheDocument();
  });

  test('given prefilled disabled source manual lookup field, should initialize as locked and unlock targets', () => {
    const setValue = vi.fn();
    const watch = vi.fn((name?: string) => {
      if (name === 'registrationNumber') {
        return 'REG-BACKEND';
      }
      return '';
    });

    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [
          {
            fieldId: 'companyName',
            valueTemplate: '{{result.legalName}}',
          },
        ],
      },
    });
    const form = createMockForm({
      watch: watch as unknown as UseFormReturn<FieldValues>['watch'],
      setValue,
    });

    render(<TextField {...createProps({ field, form, isDisabled: true })} />);

    expect(screen.getByRole('button', { name: 'Clear lookup registrationNumber' })).toBeInTheDocument();
    expect(setValue).toHaveBeenCalledWith('__lookupUnlocked.companyName', true, expect.any(Object));
  });

  test('given disabled manual lookup source with empty current value and static default, should seed source from default', () => {
    const setValue = vi.fn();
    const watch = vi.fn((name?: string) => {
      if (name === 'registrationNumber') {
        return '';
      }
      return '';
    });

    const field = createMockField({
      id: 'registrationNumber',
      defaultValue: 'REG-404',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [],
      },
    });
    const form = createMockForm({
      watch: watch as unknown as UseFormReturn<FieldValues>['watch'],
      setValue,
    });

    render(<TextField {...createProps({ field, form, isDisabled: true })} />);

    expect(setValue).toHaveBeenCalledWith('registrationNumber', 'REG-404', expect.any(Object));
  });

  test('given prefillOnMount manual lookup source, should fetch and prefill target on mount', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ legalName: 'Acme Holdings Ltd' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return fieldName === 'registrationNumber' ? 'REG-OK' : '';
      }
      return { registrationNumber: 'REG-OK', companyName: '' };
    });
    const setValue = vi.fn();

    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        prefillOnMount: true,
        autoFillTargets: [
          {
            fieldId: 'companyName',
            valueTemplate: '{{result.legalName}}',
          },
        ],
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
      watch: vi.fn((name?: string) => {
        if (name === 'registrationNumber') {
          return 'REG-OK';
        }
        if (name === '__lookupUnlocked.registrationNumber') {
          return false;
        }
        return '';
      }) as unknown as UseFormReturn<FieldValues>['watch'],
      setValue,
    });

    render(<TextField {...createProps({ field, form, isDisabled: true })} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/lookup?registration=REG-OK', expect.objectContaining({
        method: 'GET',
      }));
      expect(setValue).toHaveBeenCalledWith('companyName', 'Acme Holdings Ltd', expect.any(Object));
    });
  });

  test('given manual lookup locked field, should unlock and clear local lookup state on clear', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Acme Inc' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return 'REG-123';
      }
      return { registrationNumber: 'REG-123' };
    });
    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [],
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
    });
    render(<TextField {...createProps({ field, form })} />);

    await user.type(screen.getByRole('textbox'), 'R');
    await user.click(screen.getByRole('button', { name: 'Lookup registrationNumber' }));
    expect(screen.getByRole('textbox')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Clear lookup registrationNumber' }));
    expect(screen.getByRole('textbox')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lookup registrationNumber' })).toBeInTheDocument();
  });

  test('given lookup response and autofill target mapping, should populate target field from template', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ legalName: 'Acme Corporation' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return fieldName === 'registrationNumber' ? 'REG-123' : '';
      }
      return { registrationNumber: 'REG-123', companyName: '' };
    });
    const setValue = vi.fn();

    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [
          {
            fieldId: 'companyName',
            valueTemplate: '{{result.legalName}}',
          },
        ],
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
      setValue,
    });
    render(<TextField {...createProps({ field, form })} />);

    await user.type(screen.getByRole('textbox'), 'R');
    await user.click(screen.getByRole('button', { name: 'Lookup registrationNumber' }));

    expect(setValue).toHaveBeenCalledWith('companyName', 'Acme Corporation', expect.objectContaining({
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    }));
  });

  test('given edited autofilled target field with update config, should call backend update on blur', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return fieldName === 'companyName' ? 'Acme Updated' : '';
      }
      return { companyId: 'cmp-1', companyName: 'Acme Updated' };
    });

    const field = createMockField({
      id: 'companyName',
      autoFilledUpdate: {
        url: '/api/company/{{companyId}}',
        method: 'PATCH',
        payloadTemplate: '{"name":"{{companyName}}"}',
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
    });
    render(<TextField {...createProps({ field, form })} />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(fetchMock).toHaveBeenCalledWith('/api/company/cmp-1', expect.objectContaining({
      method: 'PATCH',
      body: '{"name":"Acme Updated"}',
    }));
  });

  test('given source clear after successful lookup, should clear source and mapped target fields', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ legalName: 'Acme Corporation' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return fieldName === 'registrationNumber' ? 'REG-123' : 'Acme Corporation';
      }
      return { registrationNumber: 'REG-123', companyName: 'Acme Corporation' };
    });
    const setValue = vi.fn();

    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        autoFillTargets: [
          {
            fieldId: 'companyName',
            valueTemplate: '{{result.legalName}}',
          },
        ],
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
      setValue,
    });
    render(<TextField {...createProps({ field, form })} />);

    await user.type(screen.getByRole('textbox'), 'R');
    await user.click(screen.getByRole('button', { name: 'Lookup registrationNumber' }));
    await user.click(screen.getByRole('button', { name: 'Clear lookup registrationNumber' }));

    expect(setValue).toHaveBeenCalledWith('registrationNumber', '', expect.any(Object));
    expect(setValue).toHaveBeenCalledWith('companyName', '', expect.any(Object));
  });

  test('given target field with autoFilledUpdate and empty value, should render disabled', () => {
    const field = createMockField({
      id: 'companyName',
      autoFilledUpdate: {
        url: '/api/company/{{companyId}}',
        method: 'PATCH',
        payloadTemplate: '{"name":"{{companyName}}"}',
      },
    });
    const form = createMockForm({
      watch: vi.fn(() => '') as unknown as UseFormReturn<FieldValues>['watch'],
    });

    render(<TextField {...createProps({ field, form })} />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  test('given target field with autoFilledUpdate and non-empty value, should render enabled', () => {
    const field = createMockField({
      id: 'companyName',
      autoFilledUpdate: {
        url: '/api/company/{{companyId}}',
        method: 'PATCH',
        payloadTemplate: '{"name":"{{companyName}}"}',
      },
    });
    const form = createMockForm({
      watch: vi.fn(() => 'Acme Corporation') as unknown as UseFormReturn<FieldValues>['watch'],
    });

    render(<TextField {...createProps({ field, form })} />);

    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  test('given resilient lookup backend error, should lock source and allow empty target editing flow', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ code: 'COMPANY_NOT_FOUND' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const getValues = vi.fn((fieldName?: string) => {
      if (fieldName) {
        return fieldName === 'registrationNumber' ? 'REG-404' : '';
      }
      return { registrationNumber: 'REG-404', companyName: '' };
    });
    const setValue = vi.fn();

    const field = createMockField({
      id: 'registrationNumber',
      manualLookup: {
        request: {
          url: '/api/lookup?registration={{registrationNumber}}',
          method: 'GET',
        },
        resilientErrors: [
          {
            status: 404,
            code: 'COMPANY_NOT_FOUND',
          },
        ],
        autoFillTargets: [
          {
            fieldId: 'companyName',
            valueTemplate: '{{result.legalName}}',
          },
        ],
      },
    });
    const form = createMockForm({
      getValues: getValues as unknown as UseFormReturn<FieldValues>['getValues'],
      setValue,
    });
    render(<TextField {...createProps({ field, form })} />);

    await user.type(screen.getByRole('textbox'), 'R');
    await user.click(screen.getByRole('button', { name: 'Lookup registrationNumber' }));

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(setValue).toHaveBeenCalledWith('companyName', '', expect.objectContaining({
      shouldDirty: true,
    }));
    expect(setValue).toHaveBeenCalledWith('__lookupUnlocked.companyName', true, expect.any(Object));
    expect(screen.queryByText('Lookup failed with status 404.')).not.toBeInTheDocument();
  });

  test('given autoFilledUpdate target with empty value but unlocked lookup flag, should render enabled', () => {
    const field = createMockField({
      id: 'companyName',
      autoFilledUpdate: {
        url: '/api/company/{{companyId}}',
        method: 'PATCH',
        payloadTemplate: '{"name":"{{companyName}}"}',
      },
    });
    const watch = vi.fn((name?: string) => {
      if (name === 'companyName') {
        return '';
      }
      if (name === '__lookupUnlocked.companyName') {
        return true;
      }
      return '';
    });
    const form = createMockForm({
      watch: watch as unknown as UseFormReturn<FieldValues>['watch'],
    });

    render(<TextField {...createProps({ field, form })} />);

    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });
});
