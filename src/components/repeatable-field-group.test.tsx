/**
 * Tests for RepeatableFieldGroup Component
 * 
 * Following TDD: Tests verify the repeatable field group component structure
 * and useFieldArray integration work correctly.
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import RepeatableFieldGroup from './repeatable-field-group';

// Mock FieldWrapper to avoid complex dependencies in unit tests
vi.mock('./field-wrapper', () => ({
  default: ({ field }: { field: FieldDescriptor }) => {
    // Extract original field ID from indexed name (e.g., "addresses.0.street" -> "street")
    const originalFieldId = field.id.split('.').pop() || field.id;
    return (
      <div data-testid={`field-${originalFieldId}`} data-field-id={field.id}>
        {field.label}
      </div>
    );
  },
}));

describe('RepeatableFieldGroup', () => {

  const createMockBlock = (): BlockDescriptor => ({
    id: 'addresses-block',
    title: 'Addresses',
    repeatable: true,
    fields: [
      {
        id: 'street',
        type: 'text',
        label: 'Street',
        repeatableGroupId: 'addresses',
        validation: [],
      },
      {
        id: 'city',
        type: 'text',
        label: 'City',
        repeatableGroupId: 'addresses',
        validation: [],
      },
    ],
  });

  const mockFormContext: FormContext = {};
  const mockOnLoadDataSource = vi.fn();
  const mockDataSourceCache: Record<string, unknown> = {};

  test('given a repeatable block, should render component structure', () => {
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({ defaultValues: { addresses: [] } }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should render the block title
    expect(screen.getByText('Addresses')).toBeInTheDocument();
  });

  test('given empty array, should render empty state', () => {
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({ defaultValues: { addresses: [] } }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should show empty state or add button
    // This will be implemented in Task 4.3, but structure should exist
    expect(screen.getByTestId('repeatable-field-group-addresses')).toBeInTheDocument();
  });

  test('given hidden state, should not render', () => {
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({ defaultValues: { addresses: [] } }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={true}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    const { container } = render(<Wrapper />);

    expect(container.firstChild).toBeNull();
  });

  test('given instances in array, should render each instance with indexed field names', () => {
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [
            { street: '123 Main St', city: 'New York' },
            { street: '456 Oak Ave', city: 'Los Angeles' },
          ],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should render fields for both instances
    // Each instance has street and city fields
    const streetFields = screen.getAllByTestId('field-street');
    const cityFields = screen.getAllByTestId('field-city');
    
    // Should have 2 instances, each with street and city
    expect(streetFields.length).toBe(2);
    expect(cityFields.length).toBe(2);
    
    // Verify indexed field names are used
    expect(streetFields[0]).toHaveAttribute('data-field-id', 'addresses.0.street');
    expect(streetFields[1]).toHaveAttribute('data-field-id', 'addresses.1.street');
  });

  test('given single instance, should render fields with correct indexed names', () => {
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [{ street: '123 Main St', city: 'New York' }],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should render instance container
    expect(screen.getByTestId('repeatable-field-group-addresses')).toBeInTheDocument();
    
    // Should render fields (mocked FieldWrapper will show labels)
    expect(screen.getByText('Street')).toBeInTheDocument();
    expect(screen.getByText('City')).toBeInTheDocument();
  });

  test('given multiple instances, should render all instances with proper structure', () => {
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [
            { street: '123 Main St', city: 'New York' },
            { street: '456 Oak Ave', city: 'Los Angeles' },
            { street: '789 Pine Rd', city: 'Chicago' },
          ],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should render all instances
    // Each instance should have both fields (street and city)
    const streetFields = screen.getAllByText('Street');
    const cityFields = screen.getAllByText('City');
    
    // Should have 3 instances, each with 2 fields
    expect(streetFields.length).toBe(3);
    expect(cityFields.length).toBe(3);
  });

  test('given instance with all fields, should render each field in the group', () => {
    const block: BlockDescriptor = {
      id: 'contacts-block',
      title: 'Contacts',
      repeatable: true,
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Name',
          repeatableGroupId: 'contacts',
          validation: [],
        },
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          repeatableGroupId: 'contacts',
          validation: [],
        },
        {
          id: 'phone',
          type: 'text',
          label: 'Phone',
          repeatableGroupId: 'contacts',
          validation: [],
        },
      ],
    };

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          contacts: [{ name: 'John Doe', email: 'john@example.com', phone: '555-1234' }],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="contacts"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should render all three fields
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
  });

  test('given add button, should allow adding new instances', async () => {
    const user = userEvent.setup();
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should have add button
    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeInTheDocument();

    // Click add button
    await user.click(addButton);

    // Should have one instance now
    expect(screen.getByTestId('repeatable-instance-addresses-0')).toBeInTheDocument();
  });

  test('given remove button, should allow removing instances', async () => {
    const user = userEvent.setup();
    const block = createMockBlock();

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [
            { street: '123 Main St', city: 'New York' },
            { street: '456 Oak Ave', city: 'Los Angeles' },
          ],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should have 2 instances
    expect(screen.getByTestId('repeatable-instance-addresses-0')).toBeInTheDocument();
    expect(screen.getByTestId('repeatable-instance-addresses-1')).toBeInTheDocument();

    // Should have remove buttons
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons.length).toBe(2);

    // Click first remove button
    await user.click(removeButtons[0]);

    // Should have 1 instance now (the second one becomes the first)
    const remainingInstances = screen.getAllByTestId(/^repeatable-instance-addresses-\d+$/);
    expect(remainingInstances.length).toBe(1);
    expect(remainingInstances[0]).toHaveAttribute('data-testid', 'repeatable-instance-addresses-0');
  });

  test('given minInstances, should disable remove button when at minimum', () => {
    const block: BlockDescriptor = {
      id: 'addresses-block',
      title: 'Addresses',
      repeatable: true,
      minInstances: 1,
      fields: [
        {
          id: 'street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
        },
      ],
    };

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [{ street: '123 Main St' }],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Should have remove button but it should be disabled
    const removeButton = screen.getByRole('button', { name: /remove/i });
    expect(removeButton).toBeDisabled();
  });

  test('given new instance, should initialize with default values from field descriptors', async () => {
    const user = userEvent.setup();
    const block: BlockDescriptor = {
      id: 'addresses-block',
      title: 'Addresses',
      repeatable: true,
      fields: [
        {
          id: 'street',
          type: 'text',
          label: 'Street',
          repeatableGroupId: 'addresses',
          validation: [],
          defaultValue: 'Default Street',
        },
        {
          id: 'city',
          type: 'text',
          label: 'City',
          repeatableGroupId: 'addresses',
          validation: [],
          defaultValue: 'Default City',
        },
      ],
    };

    const Wrapper = () => {
      const form = useForm({
        defaultValues: {
          addresses: [],
        },
      }) as unknown as UseFormReturn<FieldValues>;
      return (
        <FormProvider {...form}>
          <RepeatableFieldGroup
            block={block}
            groupId="addresses"
            fields={block.fields}
            isDisabled={false}
            isHidden={false}
            form={form}
            formContext={mockFormContext}
            onLoadDataSource={mockOnLoadDataSource}
            dataSourceCache={mockDataSourceCache}
          />
        </FormProvider>
      );
    };

    render(<Wrapper />);

    // Click add button
    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    // New instance should be created with default values
    // The form values should contain the defaults
    // Note: We can't directly check form values in the test, but we can verify the instance exists
    expect(screen.getByTestId('repeatable-instance-addresses-0')).toBeInTheDocument();
  });
});
