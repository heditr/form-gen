/**
 * Tests for PopinManager Component
 * 
 * Following TDD: Tests verify popin management functionality including
 * opening/closing dialogs, block resolution, form state sync, and validation.
 */

import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { PopinManagerProvider, usePopinManager } from './popin-manager';
import type { GlobalFormDescriptor, BlockDescriptor } from '@/types/form-descriptor';
import type { FormContext } from '@/utils/template-evaluator';
import { registerHandlebarsHelpers } from '@/utils/handlebars-helpers';

// Mock Block component
vi.mock('./block', () => ({
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

// Mock Dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => {
    if (!open) return null;
    
    // Handle escape key
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

// Mock resolveBlockById
const mockResolveBlockById = vi.fn();
vi.mock('@/utils/block-resolver', () => ({
  resolveBlockById: (blockId: string, descriptor: GlobalFormDescriptor, formContext: FormContext) => {
    return mockResolveBlockById(blockId, descriptor, formContext);
  },
}));

// Mock popin-load-loader
const mockLoadPopinData = vi.fn();
vi.mock('@/utils/popin-load-loader', () => ({
  loadPopinData: (blockId: string, config: unknown, formContext: FormContext) => {
    return mockLoadPopinData(blockId, config, formContext);
  },
}));

describe('PopinManager', () => {
  beforeAll(() => {
    registerHandlebarsHelpers();
  });

  const createMockBlock = (overrides?: Partial<BlockDescriptor>): BlockDescriptor => ({
    id: 'test-block',
    title: 'Test Block',
    description: 'Test Description',
    fields: [
      {
        id: 'test-field',
        type: 'text',
        label: 'Test Field',
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

  const createMockFormContext = (overrides: Record<string, unknown> = {}): FormContext => {
    return {
      ...overrides,
    } as FormContext;
  };

  // Test component that uses the popin manager
  const TestComponent = ({ blockId }: { blockId: string }) => {
    const { openPopin } = usePopinManager();
    return (
      <button onClick={() => openPopin(blockId)} data-testid="trigger-button">
        Open Popin
      </button>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveBlockById.mockReturnValue(null);
  });

  describe('openPopin', () => {
    test('given openPopin call, should open dialog with referenced block content', async () => {
      const block = createMockBlock({ id: 'contact-info', title: 'Contact Information' });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="contact-info" />
        </PopinManagerProvider>
      );

      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('dialog-title')).toHaveTextContent('Contact Information');
        expect(screen.getByTestId('block-content')).toHaveAttribute('data-block-id', 'contact-info');
      });
    });

    test('given block not found, should handle error gracefully without opening popin', async () => {
      const descriptor = createMockDescriptor([]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue(null);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="non-existent" />
        </PopinManagerProvider>
      );

      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    test('given multiple openPopin calls, should close previous popin when opening new one', async () => {
      const block1 = createMockBlock({ id: 'block-1', title: 'Block 1' });
      const block2 = createMockBlock({ id: 'block-2', title: 'Block 2' });
      const descriptor = createMockDescriptor([block1, block2]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockImplementation((blockId: string) => {
        if (blockId === 'block-1') {
          return { block: block1, isHidden: false, isDisabled: false };
        }
        if (blockId === 'block-2') {
          return { block: block2, isHidden: false, isDisabled: false };
        }
        return null;
      });

      const OpenButton1 = () => {
        const { openPopin } = usePopinManager();
        return (
          <button onClick={() => openPopin('block-1')} data-testid="open-1">
            Open Block 1
          </button>
        );
      };

      const OpenButton2 = () => {
        const { openPopin } = usePopinManager();
        return (
          <button onClick={() => openPopin('block-2')} data-testid="open-2">
            Open Block 2
          </button>
        );
      };

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <div>
            <OpenButton1 />
            <OpenButton2 />
          </div>
        </PopinManagerProvider>
      );

      // Open first popin
      await userEvent.click(screen.getByTestId('open-1'));
      await waitFor(() => {
        expect(screen.getByTestId('dialog-title')).toHaveTextContent('Block 1');
      });

      // Open second popin
      await userEvent.click(screen.getByTestId('open-2'));
      await waitFor(() => {
        expect(screen.getByTestId('dialog-title')).toHaveTextContent('Block 2');
        expect(screen.queryByText('Block 1')).not.toBeInTheDocument();
      });
    });

    test('given block visibility, should respect block status.hidden template before opening', async () => {
      const block = createMockBlock({ id: 'hidden-block', title: 'Hidden Block' });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: true,
        isDisabled: false,
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="hidden-block" />
        </PopinManagerProvider>
      );

      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cannot open popin: Block "hidden-block" is hidden')
        );
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('dialog interactions', () => {
    test('given cancel button, should close dialog immediately without side effects', async () => {
      const block = createMockBlock();
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="test-block" />
        </PopinManagerProvider>
      );

      // Open popin
      await userEvent.click(screen.getByTestId('trigger-button'));
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });

    test('given validate button without popinSubmit config, should close popin immediately', async () => {
      const block = createMockBlock();
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="test-block" />
        </PopinManagerProvider>
      );

      // Open popin
      await userEvent.click(screen.getByTestId('trigger-button'));
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Click validate button
      const validateButton = screen.getByRole('button', { name: /validate/i });
      await userEvent.click(validateButton);

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });

    test('given escape key, should act as cancel (close without side effects)', async () => {
      const block = createMockBlock();
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="test-block" />
        </PopinManagerProvider>
      );

      // Open popin
      await userEvent.click(screen.getByTestId('trigger-button'));
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Focus the dialog and press escape key
      const dialog = screen.getByTestId('dialog');
      dialog.focus();
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test('given backdrop click, should act as cancel (close without side effects)', async () => {
      const block = createMockBlock();
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="test-block" />
        </PopinManagerProvider>
      );

      // Open popin
      await userEvent.click(screen.getByTestId('trigger-button'));
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Click backdrop
      const backdrop = screen.getByTestId('dialog-backdrop');
      await userEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });

    test('given close button (X), should act as cancel (close without side effects)', async () => {
      const block = createMockBlock();
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="test-block" />
        </PopinManagerProvider>
      );

      // Open popin
      await userEvent.click(screen.getByTestId('trigger-button'));
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Click close button (X)
      const closeButton = screen.getByTestId('dialog-close-x');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('dialog content rendering', () => {
    test('given dialog open, should render Block component inside dialog with correct props', async () => {
      const block = createMockBlock({
        id: 'contact-info',
        title: 'Contact Information',
        fields: [
          { id: 'email', type: 'text', label: 'Email', validation: [] },
          { id: 'phone', type: 'text', label: 'Phone', validation: [] },
        ],
      });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="contact-info" />
        </PopinManagerProvider>
      );

      // Open popin
      await userEvent.click(screen.getByTestId('trigger-button'));

      await waitFor(() => {
        const blockContent = screen.getByTestId('block-content');
        expect(blockContent).toBeInTheDocument();
        expect(blockContent).toHaveAttribute('data-block-id', 'contact-info');
        expect(blockContent).toHaveAttribute('data-disabled', 'false');
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Phone')).toBeInTheDocument();
      });
    });

    test('given block disabled state, should respect block status.disabled template (fields disabled in popin)', async () => {
      const block = createMockBlock({ id: 'disabled-block', title: 'Disabled Block' });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: true,
      });

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent blockId="disabled-block" />
        </PopinManagerProvider>
      );

      // Open popin
      await userEvent.click(screen.getByTestId('trigger-button'));

      await waitFor(() => {
        const blockContent = screen.getByTestId('block-content');
        expect(blockContent).toHaveAttribute('data-disabled', 'true');
      });
    });
  });

  describe('usePopinManager hook', () => {
    test('given hook used outside provider, should throw error', () => {
      // Suppress console.error for this test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponent = () => {
        try {
          usePopinManager();
          return <div>No error</div>;
        } catch (error) {
          return <div>{(error as Error).message}</div>;
        }
      };

      render(<TestComponent />);
      expect(screen.getByText(/usePopinManager must be used within PopinManagerProvider/i)).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('popinLoad functionality', () => {
    test('given popinLoad config, should load object data from popinLoad.url when popin opens', async () => {
      const block = createMockBlock({
        id: 'contact-info',
        popinLoad: {
          url: '/api/popin-data',
          auth: {
            type: 'bearer',
            token: 'test-token',
          },
        },
      });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      const loadedData = { email: 'test@example.com', phone: '123-456-7890' };
      mockLoadPopinData.mockResolvedValue(loadedData);

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      const TestComponent = () => {
        const { openPopin } = usePopinManager();
        return (
          <button onClick={() => openPopin('contact-info')} data-testid="trigger-button">
            Open Popin
          </button>
        );
      };

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent />
        </PopinManagerProvider>
      );

      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      await waitFor(() => {
        expect(mockLoadPopinData).toHaveBeenCalledWith(
          'contact-info',
          block.popinLoad,
          expect.objectContaining({})
        );
      });
    });

    test('given popinLoad errors, should handle load errors gracefully without breaking popin', async () => {
      const block = createMockBlock({
        id: 'contact-info',
        popinLoad: {
          url: '/api/popin-data',
        },
      });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadPopinData.mockRejectedValue(new Error('Failed to load'));

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      const TestComponent = () => {
        const { openPopin } = usePopinManager();
        return (
          <button onClick={() => openPopin('contact-info')} data-testid="trigger-button">
            Open Popin
          </button>
        );
      };

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent />
        </PopinManagerProvider>
      );

      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      // Wait for error handling
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load popin data:',
          expect.any(Error)
        );
        // Popin should still open despite error
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      }, { timeout: 2000 });

      consoleErrorSpy.mockRestore();
    });

    test('given popinLoad config, should show loading state while loading', async () => {
      const block = createMockBlock({
        id: 'contact-info',
        popinLoad: {
          url: '/api/popin-data',
        },
      });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      // Delay the promise resolution to test loading state
      let resolvePromise: (value: Record<string, unknown>) => void;
      const delayedPromise = new Promise<Record<string, unknown>>((resolve) => {
        resolvePromise = resolve;
      });
      mockLoadPopinData.mockReturnValue(delayedPromise);

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      const TestComponent = () => {
        const { openPopin } = usePopinManager();
        return (
          <button onClick={() => openPopin('contact-info')} data-testid="trigger-button">
            Open Popin
          </button>
        );
      };

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent />
        </PopinManagerProvider>
      );

      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise!({ email: 'test@example.com' });

      // Loading should disappear
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });

  describe('error clearing on popin close', () => {
    test('given popin with errors displayed, should clear errors when popin closes', async () => {
      const block = createMockBlock({
        id: 'contact-info',
        title: 'Contact Information',
        fields: [
          {
            id: 'contactEmail',
            type: 'text',
            label: 'Email',
            validation: [],
          },
          {
            id: 'contactPhone',
            type: 'text',
            label: 'Phone',
            validation: [],
          },
        ],
      });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      const TestComponent = () => {
        const { openPopin } = usePopinManager();
        return (
          <>
            <button onClick={() => openPopin('contact-info')} data-testid="trigger-button">
              Open Popin
            </button>
            <button
              onClick={() => {
                // Simulate errors being set (as would happen after failed submission)
                form.setError('contactEmail', { type: 'server', message: 'Email is invalid' });
                form.setError('contactPhone', { type: 'server', message: 'Phone is required' });
              }}
              data-testid="set-errors-button"
            >
              Set Errors
            </button>
          </>
        );
      };

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent />
        </PopinManagerProvider>
      );

      // Open popin
      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Set errors on popin fields
      const setErrorsButton = screen.getByTestId('set-errors-button');
      await userEvent.click(setErrorsButton);

      // Verify errors were set
      expect(form.setError).toHaveBeenCalledWith('contactEmail', {
        type: 'server',
        message: 'Email is invalid',
      });
      expect(form.setError).toHaveBeenCalledWith('contactPhone', {
        type: 'server',
        message: 'Phone is required',
      });

      // Close popin by clicking cancel button
      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      // Verify clearErrors was called for each field ID from the popin block
      await waitFor(() => {
        expect(form.clearErrors).toHaveBeenCalledWith('contactEmail');
        expect(form.clearErrors).toHaveBeenCalledWith('contactPhone');
      });
    });

    test('given popin closes after successful submit, should clear errors', async () => {
      const block = createMockBlock({
        id: 'contact-info',
        title: 'Contact Information',
        fields: [
          {
            id: 'contactEmail',
            type: 'text',
            label: 'Email',
            validation: [],
          },
        ],
        popinSubmit: {
          url: '/api/popin-submit',
          method: 'POST',
        },
      });
      const descriptor = createMockDescriptor([block]);
      const form = createMockForm();
      const formContext = createMockFormContext();

      // Mock successful fetch response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      mockResolveBlockById.mockReturnValue({
        block,
        isHidden: false,
        isDisabled: false,
      });

      const TestComponent = () => {
        const { openPopin } = usePopinManager();
        return (
          <button onClick={() => openPopin('contact-info')} data-testid="trigger-button">
            Open Popin
          </button>
        );
      };

      render(
        <PopinManagerProvider
          mergedDescriptor={descriptor}
          form={form}
          formContext={formContext}
          onLoadDataSource={vi.fn()}
          dataSourceCache={{}}
        >
          <TestComponent />
        </PopinManagerProvider>
      );

      // Open popin
      const triggerButton = screen.getByTestId('trigger-button');
      await userEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Click validate button (should succeed and close popin)
      const validateButton = screen.getByText('Validate');
      await userEvent.click(validateButton);

      // Wait for popin to close
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });

      // Verify clearErrors was called for the field ID from the popin block
      expect(form.clearErrors).toHaveBeenCalledWith('contactEmail');
    });
  });
});
