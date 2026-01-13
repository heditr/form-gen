/**
 * Submit Button Component
 * 
 * Submit button with loading and disabled states, error count display,
 * and submission orchestration integration.
 */

import { useMemo } from 'react';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import type { GlobalFormDescriptor } from '@/types/form-descriptor';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

export interface SubmitButtonProps {
  /**
   * React Hook Form instance
   */
  form: UseFormReturn<FieldValues>;

  /**
   * Global form descriptor with submission config
   */
  descriptor: GlobalFormDescriptor;

  /**
   * Whether form is currently re-hydrating
   */
  isRehydrating: boolean;

  /**
   * Submit handler function from submission orchestrator
   */
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

/**
 * Submit Button Component
 * 
 * Displays submit button with:
 * - Disabled state during re-hydration
 * - Error count when validation errors exist
 * - Loading state during submission
 * - Submission orchestration on click
 */
export default function SubmitButton({
  form,
  descriptor,
  isRehydrating,
  onSubmit,
}: SubmitButtonProps) {
  // Count validation errors
  const errorCount = useMemo(() => {
    return Object.keys(form.formState.errors).length;
  }, [form.formState.errors]);

  // Determine if button should be disabled
  const isDisabled = isRehydrating || form.formState.isSubmitting;

  // Determine button text and loading state
  const buttonText = form.formState.isSubmitting ? 'Submitting...' : 'Submit';
  const showLoading = form.formState.isSubmitting;

  return (
    <Button
      type="submit"
      disabled={isDisabled}
      onClick={onSubmit}
      className="w-full sm:w-auto"
      data-testid="submit-button"
    >
      {showLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      <span>{buttonText}</span>
      {errorCount > 0 && !showLoading && (
        <span
          className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground"
          aria-label={`${errorCount} validation error${errorCount !== 1 ? 's' : ''}`}
        >
          {errorCount}
        </span>
      )}
    </Button>
  );
}
