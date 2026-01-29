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
 * Extract array from response using iteratorTemplate or direct access
 * 
 * @param data - API response data
 * @param iteratorTemplate - Optional Handlebars template to extract array (can be a path string or Handlebars expression)
 * @param fullContext - Full context with RESPONSE exposed
 * @returns Array to iterate over, or null if extraction fails
 */
function extractArray(
  data: unknown,
  iteratorTemplate: string | undefined,
  fullContext: FormContext
): unknown[] | null {
  // If no iteratorTemplate, check if data is already an array
  if (!iteratorTemplate) {
    return Array.isArray(data) ? data : null;
  }

  // Check if template is a simple path (no Handlebars syntax)
  // Simple paths like "results" or "data.items" can be used directly
  const hasHandlebarsSyntax = iteratorTemplate.includes('{{');
  
  if (!hasHandlebarsSyntax) {
    // Simple path string - navigate directly
    const extracted = navigatePath(data, iteratorTemplate.trim());
    if (Array.isArray(extracted)) {
      return extracted;
    }
    return null;
  }

  // Template contains Handlebars syntax - evaluate it
  try {
    const compiledIterator = Handlebars.compile(iteratorTemplate);
    const iteratorResult = compiledIterator(fullContext);
    
    // Handlebars always returns a string, but we can check if it's a path
    // If the result is a string path, navigate to it
    if (typeof iteratorResult === 'string' && iteratorResult.trim()) {
      const path = iteratorResult.trim();
      const extracted = navigatePath(data, path);
      if (Array.isArray(extracted)) {
        return extracted;
      }
      
      // Try parsing as JSON in case it's a stringified array
      try {
        const parsed = JSON.parse(path);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Not JSON, continue
      }
    }
    
    // If template result is not usable, return null to fall back
    return null;
  } catch (error) {
    console.error('Error evaluating iteratorTemplate:', error, 'Template:', iteratorTemplate);
    return null;
  }
}

/**
 * Navigate a path through an object (e.g., "results" or "data.items")
 * 
 * @param obj - Object to navigate
 * @param path - Dot-separated path (e.g., "results" or "data.items")
 * @returns Value at path, or undefined if path doesn't exist
 */
function navigatePath(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }
  
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
    if (current === undefined) {
      return undefined;
    }
  }
  
  return current;
}

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
  // Create full context with RESPONSE exposed for template access
  // Cast data to FormContext-compatible type (Handlebars can handle any value)
  const fullContext: FormContext = {
    ...context,
    RESPONSE: data as FormContext,
    data: data as FormContext, // Keep 'data' for backward compatibility
  };
  
  // Try to extract array using iteratorTemplate
  const itemsArray = extractArray(data, config.iteratorTemplate, fullContext);
  
  if (itemsArray) {
    // Transform each item in the extracted array
    return itemsArray.map((item) => transformItem(item, config.itemsTemplate, fullContext));
  }
  
  // Fallback: if data is already an array, transform each item
  if (Array.isArray(data)) {
    return data.map((item) => transformItem(item, config.itemsTemplate, fullContext));
  }
  
  // Fallback: if data is a single object, transform it
  return [transformItem(data, config.itemsTemplate, fullContext)];
}

/**
 * Transform a single item using itemsTemplate
 * 
 * @param item - Single item from API response
 * @param itemsTemplate - Handlebars template for transforming items
 * @param context - Form context for template evaluation (includes RESPONSE)
 * @returns Field item with label and value
 */
export function transformItem(
  item: unknown,
  itemsTemplate: string,
  context: FormContext
): FieldItem {
  try {
    const compiled = Handlebars.compile(itemsTemplate);
    const itemContext: FormContext = { 
      ...context, 
      item: item as FormContext, 
      ...(typeof item === 'object' && item !== null ? item as Record<string, FormContext> : {}) 
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
  } catch (error) {
    console.error('Error transforming item:', error, 'Item:', item, 'Template:', itemsTemplate);
    // Return a safe fallback
    return {
      label: String(item || ''),
      value: String(item || ''),
    };
  }
}
