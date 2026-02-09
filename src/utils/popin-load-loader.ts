/**
 * Popin Load Loader - Utility for loading object data when popin opens
 * 
 * Handles URL template evaluation, authentication, API calls, and caching
 * for popinLoad configuration. Returns object data (not arrays) that gets merged
 * into formContext.
 */

import type { PopinLoadConfig } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';
import { evaluateTemplate } from './template-evaluator';
import { loadDataSourceViaProxy } from './data-source-proxy';

/**
 * Cache for popin load responses to prevent duplicate requests
 * Key: blockId + evaluated URL + auth config, Value: loaded object data
 */
const popinLoadCache = new Map<string, Record<string, unknown>>();

/**
 * Load object data for popin using backend proxy endpoint
 * 
 * @param blockId - Block identifier
 * @param config - Popin load configuration (must have dataSourceId)
 * @param formContext - Form context for template evaluation
 * @returns Promise resolving to object data
 * @throws Error if proxy call fails or dataSourceId is missing
 */
async function loadPopinDataViaProxy(
  blockId: string,
  config: PopinLoadConfig,
  formContext: FormContext
): Promise<Record<string, unknown>> {
  if (!config.dataSourceId) {
    throw new Error(`Popin load configuration is incomplete: dataSourceId is required for block "${blockId}"`);
  }

  // Evaluate URL template
  const evaluatedUrl = evaluateTemplate(config.url, formContext);

  const response = await fetch('/api/data-sources/popin-load-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      blockId,
      dataSourceId: config.dataSourceId,
      urlTemplate: config.url,
      evaluatedUrl,
      formContext,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Failed to load popin data: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response is not JSON, use default error message
    }
    throw new Error(errorMessage);
  }

  const data: Record<string, unknown> = await response.json();
  return data;
}

/**
 * Load object data for popin using direct API call with auth
 * 
 * @param config - Popin load configuration with auth
 * @param formContext - Form context for template evaluation
 * @returns Promise resolving to object data
 */
async function loadPopinDataDirect(
  config: PopinLoadConfig,
  formContext: FormContext
): Promise<Record<string, unknown>> {
  // Evaluate URL template
  const url = evaluateTemplate(config.url, formContext);

  // Build request headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add authentication headers
  if (config.auth) {
    switch (config.auth.type) {
      case 'bearer':
        if (config.auth.token) {
          headers['Authorization'] = `Bearer ${config.auth.token}`;
        }
        break;
      case 'apikey':
        if (config.auth.token && config.auth.headerName) {
          headers[config.auth.headerName] = config.auth.token;
        }
        break;
      case 'basic':
        if (config.auth.username && config.auth.password) {
          const credentials = btoa(`${config.auth.username}:${config.auth.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
    }
  }

  // Make API call
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Failed to load popin data: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response is not JSON, use default error message
    }
    throw new Error(errorMessage);
  }

  const data: Record<string, unknown> = await response.json();
  return data;
}

/**
 * Load object data for popin when it opens
 * 
 * If dataSourceId is present, uses backend proxy endpoint for secure authentication.
 * Otherwise, falls back to direct API call (when auth is provided directly).
 * 
 * @param blockId - Block identifier for caching
 * @param config - Popin load configuration with URL template and optional auth
 * @param formContext - Form context for template evaluation
 * @returns Promise resolving to object data (merged into formContext)
 * @throws Error if API call fails
 */
export async function loadPopinData(
  blockId: string,
  config: PopinLoadConfig,
  formContext: FormContext
): Promise<Record<string, unknown>> {
  // Evaluate URL template to create cache key
  const evaluatedUrl = evaluateTemplate(config.url, formContext);

  // Create cache key (includes blockId, URL, and auth config to prevent conflicts)
  const authKey = config.auth
    ? `${config.auth.type}-${config.auth.token || config.auth.username || ''}`
    : config.dataSourceId || 'none';
  const cacheKey = `${blockId}:${evaluatedUrl}:${authKey}`;

  // Check cache first
  if (popinLoadCache.has(cacheKey)) {
    return popinLoadCache.get(cacheKey)!;
  }

  // Load data (via proxy if dataSourceId, otherwise direct)
  let data: Record<string, unknown>;
  if (config.dataSourceId) {
    data = await loadPopinDataViaProxy(blockId, config, formContext);
  } else if (config.auth) {
    data = await loadPopinDataDirect(config, formContext);
  } else {
    // No auth config - try direct call without auth
    const evaluatedUrl = evaluateTemplate(config.url, formContext);
    const response = await fetch(evaluatedUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load popin data: ${response.status} ${response.statusText}`);
    }

    data = await response.json();
  }

  // Cache the result
  popinLoadCache.set(cacheKey, data);

  return data;
}
