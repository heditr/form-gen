/**
 * Response Transformer - Utility for transforming API responses into dropdown items
 * 
 * Provides functions to transform API responses using Handlebars templates
 * into arrays of {label, value} objects for use in form fields.
 */

import Handlebars from 'handlebars';
import type { DataSourceConfig, FieldItem } from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

/**
 * Transform API response into field items using Handlebars templates
 * 
 * @param data - API response data (can be array or single object)
 * @param config - Data source configuration with itemsTemplate and optional iteratorTemplate
 * @param context - Form context for template evaluation
 * @returns Array of field items with label and value
 */
export function transformResponse(
  data: unknown,
  config: DataSourceConfig,
  context: FormContext
): FieldItem[] {
  // If iteratorTemplate is provided, use it to iterate over array
  if (config.iteratorTemplate) {
    const compiledIterator = Handlebars.compile(config.iteratorTemplate);
    const iteratorContext = { ...context, data };
    compiledIterator(iteratorContext); // Execute iterator template
    
    // If data is an array, transform each item
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
export function transformItem(
  item: unknown,
  itemsTemplate: string,
  context: FormContext
): FieldItem {
  const compiled = Handlebars.compile(itemsTemplate);
  const itemContext = { 
    ...context, 
    item, 
    ...(typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}) 
  };
  
  const result = compiled(itemContext);
  
  // Try to parse as JSON first (e.g., {"label":"...","value":"..."})
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

  // Fallback: use template result as both label and value
  return {
    label: result || String(item),
    value: String(item),
  };
}
