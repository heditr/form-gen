/**
 * Data Source Loader - Utility for loading dynamic field data from APIs
 * 
 * Handles URL template evaluation, authentication, API calls, response transformation,
 * and caching to prevent duplicate requests.
 */

import type { DataSourceConfig, FieldItem } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';
import { transformResponse } from './response-transformer';
import { evaluateTemplate } from './template-evaluator';

/**
 * Cache for API responses to prevent duplicate requests
 * Key: evaluated URL + auth config, Value: transformed items
 */
const responseCache = new Map<string, FieldItem[]>();

/**
 * Load data from a data source API
 * 
 * @param config - Data source configuration with URL template, items template, and auth
 * @param context - Form context for template evaluation
 * @returns Promise resolving to array of field items
 * @throws Error if API call fails or response is not ok
 */
export async function loadDataSource(
  config: DataSourceConfig,
  context: FormContext
): Promise<FieldItem[]> {
  // Evaluate URL template with form context
  const url = evaluateTemplate(config.url, context);

  // Check cache first (cache key includes URL and auth to prevent conflicts)
  const authKey = config.auth 
    ? config.auth.type === 'basic'
      ? `${config.auth.type}:${config.auth.username || ''}:${config.auth.password || ''}`
      : `${config.auth.type}:${config.auth.token || ''}:${config.auth.headerName || ''}`
    : 'no-auth';
  const cacheKey = `${url}::${authKey}`;
  
  if (responseCache.has(cacheKey)) {
    return [...responseCache.get(cacheKey)!]; // Return copy to prevent mutation
  }

  // Build headers with authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.auth) {
    if (config.auth.type === 'bearer' && config.auth.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    } else if (config.auth.type === 'apikey' && config.auth.token && config.auth.headerName) {
      headers[config.auth.headerName] = config.auth.token;
    } else if (config.auth.type === 'basic' && config.auth.username && config.auth.password) {
      // Basic authentication: Base64 encode username:password
      // Use btoa for browser compatibility, or Buffer for Node.js
      const credentials = typeof btoa !== 'undefined'
        ? btoa(`${config.auth.username}:${config.auth.password}`)
        : Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }
  }

  // Make API call
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load data source: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Transform response using itemsTemplate
  const items = transformResponse(data, config, context);

  // Cache the result (store copy to prevent mutation)
  responseCache.set(cacheKey, [...items]);

  return items;
}

/**
 * Clear the response cache
 * Useful for testing or when cache needs to be invalidated
 */
export function clearDataSourceCache(): void {
  responseCache.clear();
}
