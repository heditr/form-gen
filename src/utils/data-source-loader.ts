/**
 * Data Source Loader - Utility for loading dynamic field data from APIs
 * 
 * Handles URL template evaluation, authentication, API calls, response transformation,
 * and caching to prevent duplicate requests.
 */

import Handlebars from 'handlebars';
import type { DataSourceConfig, FieldItem } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';
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
    ? `${config.auth.type}:${config.auth.token || ''}:${config.auth.headerName || ''}`
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
 * Transform API response into field items using Handlebars templates
 * 
 * @param data - API response data
 * @param config - Data source configuration with itemsTemplate and optional iteratorTemplate
 * @param context - Form context for template evaluation
 * @returns Array of field items
 */
function transformResponse(
  data: unknown,
  config: DataSourceConfig,
  context: FormContext
): FieldItem[] {
  // If iteratorTemplate is provided, use it to iterate over array
  if (config.iteratorTemplate) {
    const compiledIterator = Handlebars.compile(config.iteratorTemplate);
    const iteratorContext = { ...context, data };
    const iteratorResult = compiledIterator(iteratorContext);
    
    // Parse the iterator result (assuming it returns JSON or structured data)
    // For now, we'll use the itemsTemplate for each item
    if (Array.isArray(data)) {
      return data.map((item) => transformItem(item, config.itemsTemplate, context));
    }
  }

  // If data is an array, transform each item
  if (Array.isArray(data)) {
    return data.map((item) => transformItem(item, config.itemsTemplate, context));
  }

  // If data is a single object, transform it
  return [transformItem(data, config.itemsTemplate, context)];
}

/**
 * Transform a single item using itemsTemplate
 * 
 * @param item - Single item from API response
 * @param itemsTemplate - Handlebars template for transforming items
 * @param context - Form context for template evaluation
 * @returns Field item with label and value
 */
function transformItem(
  item: unknown,
  itemsTemplate: string,
  context: FormContext
): FieldItem {
  const compiled = Handlebars.compile(itemsTemplate);
  const itemContext = { ...context, item, ...(typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}) };
  
  // The template should return a string that we can parse as JSON or extract label/value
  // For now, assume the template returns something like "{{item.label}}:{{item.value}}"
  // or we need to extract label and value separately
  const result = compiled(itemContext);
  
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(result);
    if (parsed.label && parsed.value !== undefined) {
      return { label: String(parsed.label), value: parsed.value };
    }
  } catch {
    // Not JSON, continue with string parsing
  }

  // If template returns a simple string, use it as label and try to extract value from item
  if (typeof item === 'object' && item !== null) {
    const itemObj = item as Record<string, unknown>;
    return {
      label: result || String(itemObj.label || itemObj.name || ''),
      value: itemObj.value !== undefined ? itemObj.value as string | number | boolean : result,
    };
  }

  // Fallback
  return {
    label: result || String(item),
    value: String(item),
  };
}

/**
 * Clear the response cache
 * Useful for testing or when cache needs to be invalidated
 */
export function clearDataSourceCache(): void {
  responseCache.clear();
}
