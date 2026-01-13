/**
 * Tests for submit button component
 * 
 * Following TDD: Tests verify submit button with loading, disabled states,
 * error count display, and submission orchestration.
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseFormReturn, FieldErrors } from 'react-hook-form';
import SubmitButton from './submit-button';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';

// Mock react-hook-form
const createMockForm = (
  errors: FieldErrors<Record<string, unknown>> = {},
  isSubmitting = false
): UseFormReturn<Record<string, unknown>> => {
  return {
    formState: {
      errors,
      isSubmitting,
      isValid: Object.keys(errors).length === 0,
    },
    handleSubmit: vi.fn((onValid) => async (e?: unknown) => {
      if (e) {
        e.preventDefault?.();
      }
      await onValid({});
    }),
  } as unknown as UseFormReturn<Record<string, unknown>>;
};

describe('submit button', () => {
  describe('SubmitButton', () => {
    test('given form state, should disable button during re-hydration', () => {
      const mockForm = createMockForm();
      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      render(
        <SubmitButton
          form={mockForm}
          descriptor={descriptor}
          isRehydrating={true}
          onSubmit={vi.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    test('given validation errors, should show error count', () => {
      const errors: FieldErrors<Record<string, unknown>> = {
        email: { type: 'required', message: 'Email is required' },
        password: { type: 'minLength', message: 'Password too short' },
      };

      const mockForm = createMockForm(errors);
      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      render(
        <SubmitButton
          form={mockForm}
          descriptor={descriptor}
          isRehydrating={false}
          onSubmit={vi.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent(/2/);
    });

    test('given no validation errors, should not show error count', () => {
      const mockForm = createMockForm({});
      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      render(
        <SubmitButton
          form={mockForm}
          descriptor={descriptor}
          isRehydrating={false}
          onSubmit={vi.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).not.toHaveTextContent(/\d/);
    });

    test('given submission in progress, should show loading state', () => {
      const mockForm = createMockForm({}, true);
      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      render(
        <SubmitButton
          form={mockForm}
          descriptor={descriptor}
          isRehydrating={false}
          onSubmit={vi.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // Should show loading indicator (spinner or text)
      expect(button).toHaveTextContent(/submitting/i);
    });

    test('given click, should trigger submission orchestration', async () => {
      const user = userEvent.setup();
      const mockForm = createMockForm();
      const mockOnSubmit = vi.fn();
      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      render(
        <SubmitButton
          form={mockForm}
          descriptor={descriptor}
          isRehydrating={false}
          onSubmit={mockOnSubmit}
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    test('given disabled state, should not trigger submission on click', async () => {
      const user = userEvent.setup();
      const mockForm = createMockForm();
      const mockOnSubmit = vi.fn();
      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      render(
        <SubmitButton
          form={mockForm}
          descriptor={descriptor}
          isRehydrating={true}
          onSubmit={mockOnSubmit}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      // Try to click disabled button
      await user.click(button);

      // Should not call onSubmit when disabled
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('given submission in progress, should not trigger submission on click', async () => {
      const user = userEvent.setup();
      const mockForm = createMockForm({}, true);
      const mockOnSubmit = vi.fn();
      const descriptor: GlobalFormDescriptor = {
        blocks: [],
        submission: {
          url: '/api/submit',
          method: 'POST',
        },
      };

      render(
        <SubmitButton
          form={mockForm}
          descriptor={descriptor}
          isRehydrating={false}
          onSubmit={mockOnSubmit}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      // Try to click disabled button
      await user.click(button);

      // Should not call onSubmit when submitting
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
