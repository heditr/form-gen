/**
 * Sub-Form Fetcher - Utility to fetch sub-forms for resolution
 * 
 * Provides functions to fetch sub-forms from the registry and build
 * a map for the sub-form resolver.
 */

import type { SubFormDescriptor } from '@/types/form-descriptor';
import { getSubFormById } from './sub-form-registry';

/**
 * Fetch a sub-form by ID
 * 
 * @param id - Sub-form identifier
 * @returns SubFormDescriptor if found
 * @throws Error if sub-form is not found
 */
export async function fetchSubForm(id: string): Promise<SubFormDescriptor> {
  const subForm = getSubFormById(id);
  
  if (!subForm) {
    throw new Error(`Sub-form "${id}" not found`);
  }
  
  return subForm;
}

/**
 * Fetch multiple sub-forms by their IDs
 * 
 * @param ids - Array of sub-form identifiers
 * @returns Map of sub-form ID to SubFormDescriptor
 * @throws Error if any sub-form is not found
 */
export async function fetchSubForms(
  ids: string[]
): Promise<Map<string, SubFormDescriptor>> {
  const subFormMap = new Map<string, SubFormDescriptor>();
  
  for (const id of ids) {
    const subForm = await fetchSubForm(id);
    subFormMap.set(id, subForm);
  }
  
  return subFormMap;
}
