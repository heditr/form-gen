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

  // Use ref to store the timeout ID so we can cancel it
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use ref to store the latest context value (so debounced function always uses latest)
  const latestContextRef = useRef<CaseContext | null>(null);
  
  // Use ref to track the last context that was actually sent to prevent duplicates
  const lastSentContextRef = useRef<string | null>(null);
  
  // Use ref to store the mutate function so it's always up-to-date
  const mutateRef = useRef(mutation.mutate);
  
  // Use ref to track if component is mounted (prevent state updates after unmount)
  const isMountedRef = useRef(true);
  
  // Update ref when mutation changes
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);

  // Cleanup function to cancel pending timeout
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []); // Empty deps - cleanup on unmount

  // Create debounced mutate function
  const debouncedMutate = useCallback(
    (caseContext: CaseContext) => {
      // Serialize context for comparison
      const contextString = JSON.stringify(caseContext);
      
      // Skip if this is the same context we already sent
      if (contextString === lastSentContextRef.current) {
        return;
      }
      
      // Store the latest context in ref (always use the most recent)
      latestContextRef.current = caseContext;
      
      // Cancel any pending timeout first - this is the key to debouncing
      // Each new call cancels the previous timeout, so only the last call executes
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Schedule the debounced call using setTimeout
      const timeoutId = setTimeout(() => {
        // Verify this timeout is still active (not cancelled)
        if (timeoutRef.current !== timeoutId) {
          return; // This timeout was cancelled, ignore it
        }
        
        // Verify component is still mounted
        if (!isMountedRef.current) {
          return; // Component unmounted, don't execute
        }
        
        // Clear the timeout ref since we're executing
        timeoutRef.current = null;
        
        // Use the latest context from ref (may have changed since timeout was scheduled)
        if (latestContextRef.current !== null) {
          const currentContextString = JSON.stringify(latestContextRef.current);
          
          // Only call if context actually changed (deduplication)
          if (currentContextString !== lastSentContextRef.current) {
            lastSentContextRef.current = currentContextString;
            mutateRef.current(latestContextRef.current);
          }
        }
      }, 500); // 500ms debounce delay
      
      // Store the timeout ID so we can verify it's still active when it fires
      timeoutRef.current = timeoutId;
    },
    [] // No dependencies - function is stable
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
