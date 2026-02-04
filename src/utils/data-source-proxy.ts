/**
 * Data Source Proxy - Utility for calling backend proxy endpoint for secure data source loading
 * 
 * Provides functions to call the /api/data-sources/proxy endpoint with proper parameters
 * and handle responses/errors.
 */

import type { DataSourceConfig, FieldItem } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

/**
 * Response format from proxy endpoint
 */
interface ProxyResponse {
  items: FieldItem[];
}

/**
 * Error response format from proxy endpoint
 */
interface ProxyErrorResponse {
  error: string;
}

/**
 * Load data source using backend proxy endpoint
 * 
 * @param fieldId - Field identifier
 * @param config - Data source configuration (must have dataSourceId)
 * @param formContext - Form context for template evaluation
 * @returns Promise resolving to array of field items
 * @throws Error if proxy call fails or dataSourceId is missing
 */
export async function loadDataSourceViaProxy(
  fieldId: string,
  config: DataSourceConfig,
  formContext: FormContext
): Promise<FieldItem[]> {
  if (!config.dataSourceId) {
    throw new Error(`Data source configuration is incomplete: dataSourceId is required for field "${fieldId}"`);
  }

  const response = await fetch('/api/data-sources/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fieldId,
      dataSourceId: config.dataSourceId,
      urlTemplate: config.url,
      itemsTemplate: config.itemsTemplate,
      formContext,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Failed to load data source: ${response.status} ${response.statusText}`;
    try {
      const errorData: ProxyErrorResponse = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response is not JSON, use default error message
    }
    throw new Error(errorMessage);
  }

  const data: ProxyResponse = await response.json();
  return data.items;
}
