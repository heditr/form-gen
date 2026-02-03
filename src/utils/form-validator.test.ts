/**
 * Tests for Form Validator
 * 
 * Following TDD: Tests verify validation logic for form values against
 * merged descriptor rules and data sources.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { validateFormValues, validateFieldValue } from './form-validator';
import type { GlobalFormDescriptor, FieldDescriptor, FormData } from '@/types/form-descriptor';

// Mock data source loader
const mockLoadDataSource = vi.fn();
vi.mock('./data-source-loader', () => ({
  loadDataSource: (...args: unknown[]) => mockLoadDataSource(...args),
}));

describe('validateFormValues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('given field with validation rules and valid value, should return empty errors', async () => {
    const descriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'name',
              type: 'text',
              label: 'Name',
              validation: [
                {
                  type: 'required',
                  message: 'Name is required',
                },
                {
                  type: 'minLength',
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              ],
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    const formValues: Partial<FormData> = {
      name: 'John Doe',
    };

    const errors = await validateFormValues(descriptor, formValues);

    expect(errors).toEqual([]);
  });

  test('given field with validation rules and invalid value, should return validation errors', async () => {
    const descriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'name',
              type: 'text',
              label: 'Name',
              validation: [
                {
                  type: 'required',
                  message: 'Name is required',
                },
                {
                  type: 'minLength',
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              ],
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    const formValues: Partial<FormData> = {
      name: '', // Empty name should fail required validation
    };

    const errors = await validateFormValues(descriptor, formValues);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('name');
    expect(errors[0].message).toBe('Name is required');
  });

  test('given field with dataSource and valid value, should return empty errors', async () => {
    mockLoadDataSource.mockResolvedValue([
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ]);

    const descriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'country',
              type: 'dropdown',
              label: 'Country',
              dataSource: {
                url: '/api/countries',
                itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
              },
              validation: [],
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    const formValues: Partial<FormData> = {
      country: 'opt1',
    };

    const errors = await validateFormValues(descriptor, formValues);

    expect(errors).toEqual([]);
    expect(mockLoadDataSource).toHaveBeenCalled();
  });

  test('given field with dataSource and invalid value, should return data source validation error', async () => {
    mockLoadDataSource.mockResolvedValue([
      { label: 'Option 1', value: 'opt1' },
      { label: 'Option 2', value: 'opt2' },
    ]);

    const descriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'country',
              type: 'dropdown',
              label: 'Country',
              dataSource: {
                url: '/api/countries',
                itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
              },
              validation: [],
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    const formValues: Partial<FormData> = {
      country: 'invalid-option', // Value not in data source
    };

    const errors = await validateFormValues(descriptor, formValues);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('country');
    expect(errors[0].message).toContain('not from valid data source options');
  });

  test('given field with dataSource and empty value, should not validate data source', async () => {
    const descriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'country',
              type: 'dropdown',
              label: 'Country',
              dataSource: {
                url: '/api/countries',
                itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
              },
              validation: [],
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    const formValues: Partial<FormData> = {
      country: '', // Empty value - should skip data source validation
    };

    const errors = await validateFormValues(descriptor, formValues);

    // Should not call data source loader for empty values
    expect(mockLoadDataSource).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  });

  test('given field with dataSource and null value, should not validate data source', async () => {
    const descriptor: GlobalFormDescriptor = {
      version: '1.0.0',
      blocks: [
        {
          id: 'block1',
          title: 'Block 1',
          fields: [
            {
              id: 'country',
              type: 'dropdown',
              label: 'Country',
              dataSource: {
                url: '/api/countries',
                itemsTemplate: '{"label":"{{item.name}}","value":"{{item.code}}"}',
              },
              validation: [],
            },
          ],
        },
      ],
      submission: {
        url: '/api/submit',
        method: 'POST',
      },
    };

    const formValues: Partial<FormData> = {
      country: null,
    };

    const errors = await validateFormValues(descriptor, formValues);

    // Should not call data source loader for null values
    expect(mockLoadDataSource).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  });
});

describe('validateFieldValue', () => {
  test('given field with required rule and empty value, should return error', async () => {
    const field: FieldDescriptor = {
      id: 'name',
      type: 'text',
      label: 'Name',
      validation: [
        {
          type: 'required',
          message: 'Name is required',
        },
      ],
    };

    const errors = await validateFieldValue(field, '', {});

    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('name');
    expect(errors[0].message).toBe('Name is required');
  });

  test('given field with minLength rule and short value, should return error', async () => {
    const field: FieldDescriptor = {
      id: 'name',
      type: 'text',
      label: 'Name',
      validation: [
        {
          type: 'minLength',
          value: 5,
          message: 'Name must be at least 5 characters',
        },
      ],
    };

    const errors = await validateFieldValue(field, 'Jo', {});

    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('name');
    expect(errors[0].message).toBe('Name must be at least 5 characters');
  });

  test('given field with maxLength rule and long value, should return error', async () => {
    const field: FieldDescriptor = {
      id: 'name',
      type: 'text',
      label: 'Name',
      validation: [
        {
          type: 'maxLength',
          value: 5,
          message: 'Name must not exceed 5 characters',
        },
      ],
    };

    const errors = await validateFieldValue(field, 'John Doe', {});

    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('name');
    expect(errors[0].message).toBe('Name must not exceed 5 characters');
  });

  test('given field with pattern rule and non-matching value, should return error', async () => {
    const field: FieldDescriptor = {
      id: 'email',
      type: 'text',
      label: 'Email',
      validation: [
        {
          type: 'pattern',
          value: '^[^@]+@[^@]+\\.[^@]+$',
          message: 'Please enter a valid email address',
        },
      ],
    };

    const errors = await validateFieldValue(field, 'invalid-email', {});

    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('email');
    expect(errors[0].message).toBe('Please enter a valid email address');
  });
});
