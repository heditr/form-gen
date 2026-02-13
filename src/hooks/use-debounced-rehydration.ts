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

  // Use ref to store the latest context value (so debounced function always uses latest)
  const latestContextRef = useRef<CaseContext | null>(null);
  
  // Use ref to track the last context that was actually sent to prevent duplicates
  const lastSentContextRef = useRef<string | null>(null);
  
  // Use ref to track pending context (scheduled to be sent) to prevent duplicate scheduling
  const pendingContextRef = useRef<string | null>(null);
  
  // Use ref to store the mutate function so it's always up-to-date
  const mutateRef = useRef(mutation.mutate);
  
  // Update ref when mutation changes
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);
  
  // Use ref to store the debounced function so we can cancel it
  const debouncedMutateRef = useRef<ReturnType<typeof debounce> | null>(null);

  // Initialize debounced function once on mount
  // Use useEffect to avoid accessing refs during render
  useEffect(() => {
    // Create debounced function that uses refs for latest values
    debouncedMutateRef.current = debounce(
      () => {
        // Use the latest context and mutate function from refs (always up-to-date)
        if (latestContextRef.current !== null) {
          const contextString = JSON.stringify(latestContextRef.current);
          
          // Only call if context actually changed (deduplication)
          if (contextString !== lastSentContextRef.current) {
            lastSentContextRef.current = contextString;
            pendingContextRef.current = null; // Clear pending since we're sending now
            mutateRef.current(latestContextRef.current);
          } else {
            // Same context, clear pending flag
            pendingContextRef.current = null;
          }
        }
      },
      500 // 500ms debounce delay
    );

    // Cleanup function - capture the debounced function in a variable
    const debouncedFn = debouncedMutateRef.current;
    return () => {
      if (debouncedFn) {
        debouncedFn.cancel();
      }
    };
  }, []); // Empty deps - create once

  // Create debounced mutate function
  const debouncedMutate = useCallback(
    (caseContext: CaseContext) => {
      // Serialize context for comparison
      const contextString = JSON.stringify(caseContext);
      
      // Skip if this is the same context we already sent or are about to send
      if (contextString === lastSentContextRef.current || contextString === pendingContextRef.current) {
        return;
      }
      
      // Mark this context as pending
      pendingContextRef.current = contextString;
      
      // Store the latest context in ref
      latestContextRef.current = caseContext;
      
      // Cancel any pending debounced call
      if (debouncedMutateRef.current) {
        debouncedMutateRef.current.cancel();
      }

      // Trigger the debounced function (will use latest context from ref)
      if (debouncedMutateRef.current) {
        debouncedMutateRef.current();
      }
    },
    [] // No dependencies - debounced function is stable
  );


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
