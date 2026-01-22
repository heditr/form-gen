/**
 * Field Descriptor Utilities - Helper functions for working with field descriptors
 * 
 * Provides utility functions to identify fields with template default values,
 * check field properties, and other field descriptor operations.
 */

import type { GlobalFormDescriptor } from '@/types/form-descriptor';

/**
 * Identify fields that have Handlebars template defaultValues
 * 
 * @param descriptor - Global form descriptor
 * @returns Set of field IDs that have template defaultValues
 */
export function identifyFieldsWithTemplateDefaults(
  descriptor: GlobalFormDescriptor | null
): Set<string> {
  if (!descriptor) {
    return new Set<string>();
  }

  const templateFields = new Set<string>();
  for (const block of descriptor.blocks) {
    for (const field of block.fields) {
      if (
        field.defaultValue !== undefined &&
        typeof field.defaultValue === 'string' &&
        field.defaultValue.includes('{{') &&
        field.defaultValue.includes('}}')
      ) {
        templateFields.add(field.id);
      }
    }
  }

  return templateFields;
}
