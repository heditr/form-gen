/**
 * Sub-Form Registry - Hardcoded sub-form descriptors
 * 
 * This registry stores hardcoded sub-form descriptors. In a future phase,
 * this will be replaced with database-backed storage.
 * 
 * For now, sub-forms are defined here as hardcoded data structures.
 */

import type { SubFormDescriptor } from '@/types/form-descriptor';

/**
 * Registry of available sub-forms
 * Key: sub-form ID, Value: SubFormDescriptor
 */
const subFormRegistry = new Map<string, SubFormDescriptor>();

/**
 * Initialize the registry with hardcoded sub-forms
 * This function can be called during server startup or on first access
 */
function initializeRegistry(): void {
  // Example: Address sub-form
  const addressSubForm: SubFormDescriptor = {
    id: 'address',
    title: 'Address Sub-Form',
    version: '1.0.0',
    blocks: [
      {
        id: 'address-block',
        title: 'Address',
        fields: [
          {
            id: 'line1',
            type: 'text',
            label: 'Address Line 1',
            validation: [
              {
                type: 'required',
                message: 'Address line 1 is required',
              },
            ],
          },
          {
            id: 'line2',
            type: 'text',
            label: 'Address Line 2',
            validation: [],
          },
          {
            id: 'city',
            type: 'text',
            label: 'City',
            validation: [
              {
                type: 'required',
                message: 'City is required',
              },
            ],
          },
          {
            id: 'zipcode',
            type: 'text',
            label: 'ZIP/Postal Code',
            validation: [
              {
                type: 'required',
                message: 'ZIP/Postal Code is required',
              },
            ],
          },
          {
            id: 'country',
            type: 'dropdown',
            label: 'Country',
            items: [
              { label: 'United States', value: 'US' },
              { label: 'Canada', value: 'CA' },
              { label: 'United Kingdom', value: 'UK' },
            ],
            validation: [
              {
                type: 'required',
                message: 'Country is required',
              },
            ],
          },
        ],
      },
    ],
  };

  subFormRegistry.set('address', addressSubForm);
}

/**
 * Get a sub-form by ID
 * 
 * @param id - Sub-form identifier
 * @returns SubFormDescriptor if found, undefined otherwise
 */
export function getSubFormById(id: string): SubFormDescriptor | undefined {
  // Initialize registry on first access if empty
  if (subFormRegistry.size === 0) {
    initializeRegistry();
  }

  return subFormRegistry.get(id);
}

/**
 * Get all available sub-form IDs
 * 
 * @returns Array of sub-form IDs
 */
export function getAllSubFormIds(): string[] {
  // Initialize registry on first access if empty
  if (subFormRegistry.size === 0) {
    initializeRegistry();
  }

  return Array.from(subFormRegistry.keys());
}

/**
 * Register a sub-form (for testing or dynamic registration)
 * 
 * @param subForm - Sub-form descriptor to register
 */
export function registerSubForm(subForm: SubFormDescriptor): void {
  subFormRegistry.set(subForm.id, subForm);
}

/**
 * Clear the registry (for testing)
 */
export function clearRegistry(): void {
  subFormRegistry.clear();
}
