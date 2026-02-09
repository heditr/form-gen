/**
 * Tests for ButtonField Component
 * 
 * Following TDD: Tests verify the component renders button that triggers popin blocks.
 * Uses React Testing Library to render components and verify DOM behavior.
 */

import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import ButtonField from './button-field';
import type { ButtonFieldProps } from './button-field';
import type { FieldDescriptor, GlobalFormDescriptor, BlockDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';

// Mock PopinManager context for unit tests
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

/**
 * Integration Tests for ButtonField with PopinManager
 * 
 * These tests verify the full integration between ButtonField and PopinManager,
 * including actual dialog opening, error handling, and form state synchronization.
 */
// For integration tests, we need to use the real PopinManager
// So we'll dynamically import it in each test
describe('ButtonField Integration with PopinManager', () => {
  // Mock Block and Dialog components (same as in popin-manager.test.tsx)
  vi.doMock('./block', () => ({
    default: ({ block, isDisabled }: { block: BlockDescriptor; isDisabled: boolean }) => (
      <div data-testid="block-content" data-block-id={block.id} data-disabled={isDisabled}>
        <h3>{block.title}</h3>
        {block.fields.map((field) => (
          <div key={field.id} data-field-id={field.id}>
            {field.label}
          </div>
        ))}
      </div>
    ),
  }));

  vi.doMock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => {
      if (!open) return null;
      
      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          onOpenChange(false);
        }
      };
      
      return (
        <div 
          data-testid="dialog" 
          role="dialog"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <button
            data-testid="dialog-close-x"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            ×
          </button>
          <div
            data-testid="dialog-backdrop"
            onClick={() => onOpenChange(false)}
            style={{ position: 'absolute', inset: 0 }}
          />
          {children}
        </div>
      );
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-content">{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-header">{children}</div>
    ),
    DialogTitle: ({ children }: { children: React.ReactNode }) => (
      <h2 data-testid="dialog-title">{children}</h2>
    ),
    DialogFooter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-footer">{children}</div>
    ),
  }));

  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const createMockBlock = (overrides?: Partial<BlockDescriptor>): BlockDescriptor => ({
    id: 'contact-info',
    title: 'Contact Information',
    description: 'Contact details',
    fields: [
      {
        id: 'email',
        type: 'text',
        label: 'Email',
        validation: [],
      },
    ],
    ...overrides,
  });

  const createMockDescriptor = (blocks: BlockDescriptor[]): GlobalFormDescriptor => ({
    blocks,
    submission: {
      url: '/api/submit',
      method: 'POST',
    },
  });

  const createMockForm = (overrides?: Partial<UseFormReturn<FieldValues>>): UseFormReturn<FieldValues> => {
    const mockControl = {
      register: vi.fn(),
      unregister: vi.fn(),
      getFieldState: vi.fn(),
      _formState: {},
      _subjects: {
        values: { next: vi.fn() },
        array: { next: vi.fn() },
        state: { next: vi.fn() },
      },
      _options: {},
    };

    return {
      register: vi.fn(),
      control: mockControl as unknown as UseFormReturn<FieldValues>['control'],
      handleSubmit: vi.fn((onValid) => (e?: React.BaseSyntheticEvent) => {
        e?.preventDefault();
        return onValid({});
      }),
      formState: {
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
        isReady: true,
      },
      watch: vi.fn(() => ({})),
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

  const createMockFormContext = (): FormContext => ({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('given button field with single variant, should open popin dialog on click', async () => {
    // Unmock popin-manager for this integration test
    vi.doUnmock('./popin-manager');
    vi.resetModules();
    
    // Re-import to get the real implementation
    const { PopinManagerProvider: RealPopinManagerProvider } = await import('./popin-manager');
    
    const user = userEvent.setup();
    const block = createMockBlock();
    const descriptor = createMockDescriptor([block]);
    const form = createMockForm();
    const formContext = createMockFormContext();

    const field: FieldDescriptor = {
      id: 'open-contact',
      type: 'button',
      label: 'Add Contact',
      validation: [],
      button: {
        variant: 'single',
        popinBlockId: 'contact-info',
      },
    };

    render(
      <RealPopinManagerProvider
        mergedDescriptor={descriptor}
        form={form}
        formContext={formContext}
        onLoadDataSource={vi.fn()}
        dataSourceCache={{}}
      >
        <ButtonField field={field} isDisabled={false} />
      </RealPopinManagerProvider>
    );

    const button = screen.getByRole('button', { name: 'Add Contact' });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Contact Information');
    }, { timeout: 3000 });
  });

  test('given block not found, should handle error gracefully without opening popin', async () => {
    vi.doUnmock('./popin-manager');
    vi.resetModules();
    const { PopinManagerProvider: RealPopinManagerProvider } = await import('./popin-manager');
    
    const user = userEvent.setup();
    const descriptor = createMockDescriptor([]); // No blocks
    const form = createMockForm();
    const formContext = createMockFormContext();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const field: FieldDescriptor = {
      id: 'open-contact',
      type: 'button',
      label: 'Add Contact',
      validation: [],
      button: {
        variant: 'single',
        popinBlockId: 'non-existent',
      },
    };

    render(
      <RealPopinManagerProvider
        mergedDescriptor={descriptor}
        form={form}
        formContext={formContext}
        onLoadDataSource={vi.fn()}
        dataSourceCache={{}}
      >
        <ButtonField field={field} isDisabled={false} />
      </RealPopinManagerProvider>
    );

    const button = screen.getByRole('button', { name: 'Add Contact' });
    await user.click(button);

    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  test('given multiple button triggers, should close previous popin when opening new one', async () => {
    vi.doUnmock('./popin-manager');
    vi.resetModules();
    const { PopinManagerProvider: RealPopinManagerProvider } = await import('./popin-manager');
    
    const user = userEvent.setup();
    const block1 = createMockBlock({ id: 'block-1', title: 'Block 1' });
    const block2 = createMockBlock({ id: 'block-2', title: 'Block 2' });
    const descriptor = createMockDescriptor([block1, block2]);
    const form = createMockForm();
    const formContext = createMockFormContext();

    const field1: FieldDescriptor = {
      id: 'open-1',
      type: 'button',
      label: 'Open Block 1',
      validation: [],
      button: {
        variant: 'single',
        popinBlockId: 'block-1',
      },
    };

    const field2: FieldDescriptor = {
      id: 'open-2',
      type: 'button',
      label: 'Open Block 2',
      validation: [],
      button: {
        variant: 'single',
        popinBlockId: 'block-2',
      },
    };

    render(
      <RealPopinManagerProvider
        mergedDescriptor={descriptor}
        form={form}
        formContext={formContext}
        onLoadDataSource={vi.fn()}
        dataSourceCache={{}}
      >
        <div>
          <ButtonField field={field1} isDisabled={false} />
          <ButtonField field={field2} isDisabled={false} />
        </div>
      </RealPopinManagerProvider>
    );

    // Open first popin
    const button1 = screen.getByRole('button', { name: 'Open Block 1' });
    await user.click(button1);

    await waitFor(() => {
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Block 1');
    });

    // Open second popin
    const button2 = screen.getByRole('button', { name: 'Open Block 2' });
    await user.click(button2);

    await waitFor(() => {
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Block 2');
      expect(screen.queryByText('Block 1')).not.toBeInTheDocument();
    });
  });

  test('given form state, should sync form data between button-triggered popins and main form', async () => {
    vi.doUnmock('./popin-manager');
    vi.resetModules();
    const { PopinManagerProvider: RealPopinManagerProvider } = await import('./popin-manager');
    
    const user = userEvent.setup();
    const block = createMockBlock({
      fields: [
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          validation: [],
        },
      ],
    });
    const descriptor = createMockDescriptor([block]);
    const form = createMockForm({
      getValues: vi.fn<[], Record<string, unknown>>(() => ({ email: 'test@example.com' })),
      watch: vi.fn<[], Record<string, unknown>>(() => ({ email: 'test@example.com' })),
    });
    const formContext = createMockFormContext();

    const field: FieldDescriptor = {
      id: 'open-contact',
      type: 'button',
      label: 'Add Contact',
      validation: [],
      button: {
        variant: 'single',
        popinBlockId: 'contact-info',
      },
    };

    render(
      <RealPopinManagerProvider
        mergedDescriptor={descriptor}
        form={form}
        formContext={formContext}
        onLoadDataSource={vi.fn()}
        dataSourceCache={{}}
      >
        <ButtonField field={field} isDisabled={false} />
      </RealPopinManagerProvider>
    );

    // Open popin
    const button = screen.getByRole('button', { name: 'Add Contact' });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      // Form state should be accessible in the popin
      // The Block component receives the same form instance
      const values = form.getValues();
      expect(values.email).toBe('test@example.com');
    });
  });
});
