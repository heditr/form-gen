/**
 * Form Query Hooks - TanStack Query hooks for server state operations
 * 
 * Provides hooks for fetching global descriptor, data sources, and form submission
 * with automatic caching, request deduplication, and Redux state synchronization.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store/store';
import { createError } from 'error-causes';
import type {
  GlobalFormDescriptor,
  DataSourceConfig,
  FormData,
} from '@/types/form-descriptor';
import {
  loadGlobalDescriptor,
  loadDataSource,
} from '@/store/form-dux';
import { loadDataSource as loadDataSourceUtil } from '@/utils/data-source-loader';
import { evaluateTemplate } from '@/utils/template-evaluator';
import type { FormContext } from '@/utils/template-evaluator';

/**
 * Auth configuration type
 */
interface AuthConfig {
  type: 'bearer' | 'apikey';
  token?: string;
  headerName?: string;
}

/**
 * Helper function to make API calls
 * 
 * @throws {Error} with error-causes structure if response is not ok
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
 * Hook to fetch global form descriptor
 * 
 * Uses useQuery with long stale time since descriptors rarely change.
 * Automatically syncs to Redux state on success.
 * 
 * @param endpoint - API endpoint for global descriptor (default: '/api/form/global-descriptor')
 * @param options - Additional useQuery options
 * @returns TanStack Query result with descriptor data
 */
export function useGlobalDescriptor(
  endpoint: string = '/api/form/global-descriptor',
  options?: Omit<UseQueryOptions<GlobalFormDescriptor, Error>, 'queryKey' | 'queryFn'>
) {
  const dispatch = useDispatch<AppDispatch>();

  const query = useQuery<GlobalFormDescriptor, Error>({
    queryKey: ['form', 'global-descriptor', endpoint],
    queryFn: async () => {
      const response = await apiCall(endpoint, { method: 'GET' });
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - descriptors rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    ...options,
  });

  // Sync to Redux state when data is available (replaces deprecated onSuccess)
  useEffect(() => {
    if (query.data) {
      dispatch(loadGlobalDescriptor({ descriptor: query.data }));
    }
  }, [query.data, dispatch]);

  return query;
}

/**
 * Parameters for useDataSource hook
 */
interface UseDataSourceParams {
  fieldPath: string;
  config: DataSourceConfig;
  formContext: FormContext;
  enabled?: boolean;
}

/**
 * Hook to fetch dynamic field data source
 * 
 * Uses useQuery with dynamic query keys based on fieldPath and evaluated URL.
 * Automatically syncs to Redux dataSourceCache on success.
 * 
 * @param params - Data source parameters
 * @param options - Additional useQuery options
 * @returns TanStack Query result with data source items
 */
export function useDataSource(
  params: UseDataSourceParams,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  const { fieldPath, config, formContext, enabled = true } = params;
  const dispatch = useDispatch<AppDispatch>();

  // Evaluate URL template to create stable query key
  // Note: This is evaluated synchronously, so formContext should be stable
  const evaluatedUrl = evaluateTemplate(config.url, formContext);

  // Create query key that includes fieldPath and evaluated URL for proper caching
  const queryKey = ['form', 'data-source', fieldPath, evaluatedUrl];

  const query = useQuery<unknown, Error>({
    queryKey,
    queryFn: async () => {
      // Use the data-source-loader utility which handles:
      // - URL template evaluation (already done for query key, but utility does it again)
      // - Authentication (via proxy if dataSourceId is present, or direct if auth is provided)
      // - API calls
      // - Response transformation using itemsTemplate
      const items = await loadDataSourceUtil(config, formContext, fieldPath);
      return items;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - data sources may change more frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled,
    ...options,
  });

  // Sync to Redux dataSourceCache when data is available (replaces deprecated onSuccess)
  useEffect(() => {
    if (query.data) {
      dispatch(loadDataSource({ fieldPath, data: query.data }));
    }
  }, [query.data, fieldPath, dispatch]);

  return query;
}

/**
 * Parameters for form submission
 */
interface SubmitFormParams {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  formData: Partial<FormData>;
  headers?: Record<string, string>;
  auth?: AuthConfig;
}

/**
 * Hook to submit form data
 * 
 * Uses useMutation for form submission. Does not cache since submissions are mutations.
 * 
 * @param options - Additional useMutation options
 * @returns TanStack Query mutation object
 */
export function useSubmitForm(
  options?: Omit<UseMutationOptions<unknown, Error, SubmitFormParams>, 'mutationFn'>
) {
  return useMutation<unknown, Error, SubmitFormParams>({
    mutationFn: async ({ url, method, formData, headers, auth }) => {
      // Build headers with auth
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      if (auth) {
        if (auth.type === 'bearer' && auth.token) {
          requestHeaders['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'apikey' && auth.token && auth.headerName) {
          requestHeaders[auth.headerName] = auth.token;
        }
      }

      const response = await apiCall(url, {
        method,
        headers: requestHeaders,
        body: JSON.stringify(formData),
      });

      // Parse JSON response
      try {
        return await response.json();
      } catch (parseError) {
        // Wrap JSON parsing errors
        throw createError({
          name: 'FormSubmissionError',
          message: 'Failed to parse response from form submission',
          code: 'PARSE_ERROR',
          cause: parseError instanceof Error ? parseError : new Error(String(parseError)),
        });
      }

      return response.json();
    },
    ...options,
  });
}
