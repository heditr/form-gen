/**
 * Context Extractor - Utility to extract and update CaseContext from CasePrefill and form data
 * 
 * Provides functions to initialize CaseContext from CasePrefill, identify discriminant fields,
 * update context from form data, and detect context changes.
 */

import type { FieldDescriptor, CaseContext, CasePrefill, FormData } from '@/types/form-descriptor';

/**
 * Initialize CaseContext from CasePrefill provided at case creation
 * 
 * @param casePrefill - Case prefill data with initial values
 * @returns CaseContext initialized with prefill values
 */
export function initializeCaseContext(casePrefill: CasePrefill): CaseContext {
  const context: CaseContext = {};

  if (casePrefill.incorporationCountry !== undefined) {
    context.incorporationCountry = casePrefill.incorporationCountry;
  }
  if (casePrefill.onboardingCountries !== undefined) {
    context.onboardingCountries = casePrefill.onboardingCountries;
  }
  if (casePrefill.processType !== undefined) {
    context.processType = casePrefill.processType;
  }
  if (casePrefill.needSignature !== undefined) {
    context.needSignature = casePrefill.needSignature;
  }
  if (casePrefill.addresses !== undefined && Array.isArray(casePrefill.addresses)) {
    context.addresses = casePrefill.addresses;
  }

  return context;
}

/**
 * Identify discriminant fields from field descriptors
 * 
 * @param fields - Array of field descriptors
 * @returns Array of field descriptors that are marked as discriminant
 */
export function identifyDiscriminantFields(fields: FieldDescriptor[]): FieldDescriptor[] {
  return fields.filter((field) => field.isDiscriminant === true);
}

/**
 * Extract value from form data using field path
 * Supports both flat paths (e.g., 'jurisdiction') and nested paths (e.g., 'personalInfo.jurisdiction')
 * 
 * @param formData - Form data object
 * @param fieldPath - Field path (can be nested with dots)
 * @returns Extracted value or undefined
 */
function extractFieldValue(formData: Partial<import('@/types/form-descriptor').FormData>, fieldPath: string): unknown {
  // Check for direct property access first
  if (fieldPath in formData) {
    return (formData as Record<string, unknown>)[fieldPath];
  }

  // Handle nested paths (e.g., 'personalInfo.jurisdiction')
  const parts = fieldPath.split('.');
  let value: unknown = formData;

  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

/**
 * Update CaseContext with discriminant field values from form data
 * 
 * @param currentContext - Current CaseContext (may include prefill values)
 * @param formData - Current form data
 * @param discriminantFields - Array of discriminant field descriptors
 * @returns Updated CaseContext
 */
export function updateCaseContext(
  currentContext: CaseContext,
  formData: Partial<FormData>,
  discriminantFields: FieldDescriptor[]
): CaseContext {
  // Start with a copy of the current context to preserve prefill values
  const updatedContext: CaseContext = { ...currentContext };

  for (const field of discriminantFields) {
    const value = extractFieldValue(formData, field.id);
    
    // Only update if value exists in formData (don't overwrite with undefined)
    // This preserves existing context values when formData doesn't have the field
    if (value !== undefined) {
      // Only include values that are valid CaseContext types
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        Array.isArray(value)
      ) {
        updatedContext[field.id] = value;
      }
    }
  }

  return updatedContext;
}

/**
 * Compare two CaseContext objects to detect changes
 * 
 * @param oldContext - Previous CaseContext
 * @param newContext - New CaseContext
 * @returns true if contexts are different, false if identical
 */
export function hasContextChanged(oldContext: CaseContext, newContext: CaseContext): boolean {
  // Get all unique keys from both contexts
  const allKeys = new Set([...Object.keys(oldContext), ...Object.keys(newContext)]);

  // Compare each key
  for (const key of allKeys) {
    const oldValue = oldContext[key];
    const newValue = newContext[key];

    // Use strict equality to detect changes (including null/undefined differences)
    // For arrays, do a shallow comparison
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      if (oldValue.length !== newValue.length) {
        return true;
      }
      if (oldValue.some((val, index) => val !== newValue[index])) {
        return true;
      }
    } else if (oldValue !== newValue) {
      return true;
    }
  }

  return false;
}
