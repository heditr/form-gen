/**
 * Debounced Rehydration Hook
 * 
 * Custom hook that combines debouncing with TanStack Query mutation for rules rehydration.
 * Debounces CaseContext changes by 500ms and triggers TanStack Query mutation.
 * Cancels previous debounced calls on rapid changes.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import debounce from 'lodash.debounce';
import { createError } from 'error-causes';
import type { CaseContext, RulesObject } from '@/types/form-descriptor';
import { triggerRehydration, applyRulesUpdate } from '@/store/form-dux';
import type { AppDispatch } from '@/store/store';

/**
 * Helper function to make API calls
 */
async function apiCall(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw createError({
      name: 'ApiError',
      message: `API call failed: ${response.status} ${response.statusText}`,
      code: `HTTP_${response.status}`,
      url,
      status: response.status,
      statusText: response.statusText,
    });
  }
  
  return response;
}

/**
 * Hook to debounce and trigger rules rehydration
 * 
 * Debounces CaseContext changes by 500ms before triggering the mutation.
 * Cancels previous debounced calls when new changes occur rapidly.
 * Updates Redux state on mutation success.
 * 
 * @returns Object with mutate function and mutation state
 */
export function useDebouncedRehydration() {
  const dispatch = useDispatch<AppDispatch>();
  
  // Create mutation for rehydration
  const mutation = useMutation<RulesObject, Error, CaseContext>({
    mutationFn: async (caseContext: CaseContext) => {
      // Dispatch trigger rehydration action before API call
      dispatch(triggerRehydration());
      
      const response = await apiCall('/api/rules/context', {
        method: 'POST',
        body: JSON.stringify(caseContext),
      });

      const rulesObject: RulesObject = await response.json();
      return rulesObject;
    },
    onSuccess: (rulesObject) => {
      // Update Redux state on success
      dispatch(applyRulesUpdate({ rulesObject }));
    },
    onError: () => {
      // Update Redux state on error
      dispatch(applyRulesUpdate({ rulesObject: null }));
    },
  });

  // Use ref to store the debounced function so we can cancel it
  const debouncedMutateRef = useRef<ReturnType<typeof debounce> | null>(null);

  // Create debounced mutate function
  const debouncedMutate = useCallback(
    (caseContext: CaseContext) => {
      // Cancel previous debounced call if it exists
      if (debouncedMutateRef.current) {
        debouncedMutateRef.current.cancel();
      }

      // Create new debounced function with the current context
      // The context is captured in the closure
      debouncedMutateRef.current = debounce(
        () => {
          mutation.mutate(caseContext);
        },
        500 // 500ms debounce delay
      );

      // Trigger the debounced function
      debouncedMutateRef.current();
    },
    [mutation]
  );

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      if (debouncedMutateRef.current) {
        debouncedMutateRef.current.cancel();
      }
    };
  }, []);

  return {
    mutate: debouncedMutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
