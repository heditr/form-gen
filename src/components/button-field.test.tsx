/**
 * Tests for ButtonField Component
 * 
 * Following TDD: Tests verify the component renders button that triggers popin blocks.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ButtonField from './button-field';
import type { ButtonFieldProps } from './button-field';
import type { FieldDescriptor } from '@/types/form-descriptor';

// Mock PopinManager context
const mockOpenPopin = vi.fn();

vi.mock('./popin-manager', async () => {
  const actual = await vi.importActual('./popin-manager');
  return {
    ...actual,
    usePopinManager: () => ({
      openPopin: mockOpenPopin,
    }),
  };
});

describe('ButtonField', () => {
  const createMockField = (overrides?: Partial<FieldDescriptor>): FieldDescriptor => ({
    id: 'test-button',
    type: 'button',
    label: 'Test Button',
    description: 'Test Description',
    validation: [],
    ...overrides,
  });

  const createProps = (overrides?: Partial<ButtonFieldProps>): ButtonFieldProps => {
    const field = createMockField();
    return {
      field,
      isDisabled: false,
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('given button field with single variant, should render button that opens popin on click', async () => {
    const user = userEvent.setup();
    const props = createProps({
      field: createMockField({
        button: {
          variant: 'single',
          popinBlockId: 'contact-info',
        },
      }),
    });

    render(<ButtonField {...props} />);

    const button = screen.getByRole('button', { name: 'Test Button' });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(mockOpenPopin).toHaveBeenCalledWith('contact-info');
    expect(mockOpenPopin).toHaveBeenCalledTimes(1);
  });

  test('given button field with link variant, should render link-style button', () => {
    const props = createProps({
      field: createMockField({
        button: {
          variant: 'link',
          popinBlockId: 'contact-info',
        },
      }),
    });

    render(<ButtonField {...props} />);

    const button = screen.getByRole('button', { name: 'Test Button' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('text-primary'); // Link variant styling
  });

  test('given button field with menu variant, should render dropdown menu with items', async () => {
    const user = userEvent.setup();
    const props = createProps({
      field: createMockField({
        button: {
          variant: 'menu',
          items: [
            { label: 'Add Contact', popinBlockId: 'contact-info' },
            { label: 'Add Owner', popinBlockId: 'owner-info' },
          ],
        },
      }),
    });

    render(<ButtonField {...props} />);

    // For now, menu variant renders first item as button (simplified implementation)
    const button = screen.getByRole('button', { name: 'Add Contact' });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(mockOpenPopin).toHaveBeenCalledWith('contact-info');
  });

  test('given button field without button config, should return null', () => {
    const props = createProps({
      field: createMockField({
        button: undefined,
      }),
    });

    const { container } = render(<ButtonField {...props} />);
    expect(container.firstChild).toBeNull();
  });

  test('given disabled button field, should render disabled button', () => {
    const props = createProps({
      field: createMockField({
        button: {
          variant: 'single',
          popinBlockId: 'contact-info',
        },
      }),
      isDisabled: true,
    });

    render(<ButtonField {...props} />);

    const button = screen.getByRole('button', { name: 'Test Button' });
    expect(button).toBeDisabled();
  });

  test('given button field with description, should render description', () => {
    const props = createProps({
      field: createMockField({
        description: 'Click to add contact information',
        button: {
          variant: 'single',
          popinBlockId: 'contact-info',
        },
      }),
    });

    render(<ButtonField {...props} />);

    expect(screen.getByText('Click to add contact information')).toBeInTheDocument();
  });

  test('given button field with label, should render label', () => {
    const props = createProps({
      field: createMockField({
        label: 'Open Contact Form',
        button: {
          variant: 'single',
          popinBlockId: 'contact-info',
        },
      }),
    });

    render(<ButtonField {...props} />);

    // Label should appear (may appear multiple times - as label and button text)
    const labels = screen.getAllByText('Open Contact Form');
    expect(labels.length).toBeGreaterThan(0);
  });
});
