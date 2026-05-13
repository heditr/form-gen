/**
 * Debounced documents rehydration — mirrors useDebouncedRehydration:
 * POST `/api/cases/:caseId/documents` with `caseContext`, then dispatch applyDocumentsUpdate.
 * Skips when `caseContext.caseId` is absent (string).
 */

import { useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { createError } from 'error-causes';
import type { CaseContext } from '@/types/form-descriptor';
import { applyDocumentsUpdate } from '@/store/form-dux';
import type { CaseDocumentsEntry } from '@/utils/document-card-builder';
import type { AppDispatch } from '@/store/store';

export function readCaseIdFromCaseContext(caseContext: CaseContext): string | undefined {
  const v = caseContext.caseId;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

async function postCaseDocuments(caseId: string, caseContext: CaseContext): Promise<CaseDocumentsEntry[]> {
  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseContext }),
  });

  if (!response.ok) {
    throw createError({
      name: 'ApiError',
      message: `Documents rehydration failed: ${response.status} ${response.statusText}`,
      code: `HTTP_${response.status}`,
      url: `/api/cases/${caseId}/documents`,
      status: response.status,
      statusText: response.statusText,
    });
  }

  const json = (await response.json()) as { documents?: CaseDocumentsEntry[] };
  return json.documents ?? [];
}

export function useDebouncedDocumentsRehydration() {
  const dispatch = useDispatch<AppDispatch>();

  const mutation = useMutation<CaseDocumentsEntry[], Error, { caseId: string; caseContext: CaseContext }>({
    mutationFn: ({ caseId, caseContext }) => postCaseDocuments(caseId, caseContext),
    onSuccess: (documents) => {
      dispatch(applyDocumentsUpdate({ documents }));
    },
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestPayloadRef = useRef<{ caseId: string; caseContext: CaseContext } | null>(null);
  const lastSentContextRef = useRef<string | null>(null);
  const mutateRef = useRef(mutation.mutate);
  const isMountedRef = useRef(true);

  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const debouncedMutate = useCallback(
    (caseContext: CaseContext) => {
      const caseId = readCaseIdFromCaseContext(caseContext);
      if (!caseId) {
        return;
      }

      const contextString = JSON.stringify(caseContext);
      if (contextString === lastSentContextRef.current) {
        return;
      }

      latestPayloadRef.current = { caseId, caseContext };

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const timeoutId = setTimeout(() => {
        if (timeoutRef.current !== timeoutId) {
          return;
        }
        if (!isMountedRef.current) {
          return;
        }
        timeoutRef.current = null;

        if (latestPayloadRef.current !== null) {
          const currentString = JSON.stringify(latestPayloadRef.current.caseContext);
          if (currentString !== lastSentContextRef.current) {
            lastSentContextRef.current = currentString;
            mutateRef.current(latestPayloadRef.current);
          }
        }
      }, 500);

      timeoutRef.current = timeoutId;
    },
    []
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
