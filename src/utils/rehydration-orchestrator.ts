/**
 * Re-hydration Orchestrator - Utility to orchestrate form re-hydration when discriminant fields change
 * 
 * Provides functions to:
 * - Check if re-hydration is needed (context changed)
 * - Build updated context from form data
 * - Merge rules response into descriptor
 * - Re-evaluate status templates
 * - Debounce re-hydration calls
 * - Manage loading indicator state
 */

import {
  updateCaseContext,
  hasContextChanged,
  identifyDiscriminantFields,
} from './context-extractor';
import { mergeDescriptorWithRules } from './descriptor-merger';
import type {
  GlobalFormDescriptor,
  CaseContext,
  RulesObject,
  FieldDescriptor,
  FormData,
} from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';

/**
 * Check if re-hydration should be triggered based on context changes
 * 
 * @param oldContext - Previous CaseContext
 * @param newContext - New CaseContext
 * @returns true if contexts are different and re-hydration should be triggered
 */
export function shouldTriggerRehydration(
  oldContext: CaseContext,
  newContext: CaseContext
): boolean {
  return hasContextChanged(oldContext, newContext);
}

/**
 * Build updated CaseContext from form data and discriminant fields
 * 
 * @param currentContext - Current CaseContext (may include prefill values)
 * @param formData - Current form data
 * @param discriminantFields - Array of discriminant field descriptors
 * @returns Updated CaseContext
 */
export function buildRehydrationContext(
  currentContext: CaseContext,
  formData: Partial<FormData>,
  discriminantFields: FieldDescriptor[]
): CaseContext {
  return updateCaseContext(currentContext, formData, discriminantFields);
}

/**
 * Merge RulesObject into GlobalFormDescriptor and prepare for status re-evaluation
 * 
 * Note: Status templates are merged but not evaluated here. Evaluation happens
 * in components when rendering, using the current form context.
 * 
 * @param globalDescriptor - The base form descriptor
 * @param rulesObject - Rules object with updates from backend
 * @param formContext - Form context for potential future status evaluation
 * @returns Merged GlobalFormDescriptor with updated rules and status templates
 */
export function mergeRulesAndReevaluateStatus(
  globalDescriptor: GlobalFormDescriptor,
  rulesObject: RulesObject,
  formContext: FormContext
): GlobalFormDescriptor {
  // Merge rules into descriptor
  const mergedDescriptor = mergeDescriptorWithRules(globalDescriptor, rulesObject);
  
  // Note: Status template evaluation is done in components during rendering
  // using the template-evaluator utilities. The merged descriptor now contains
  // the updated status templates that will be evaluated with the current form context.
  
  return mergedDescriptor;
}

/**
 * Re-hydration orchestrator instance
 * 
 * Provides debounced re-hydration and loading indicator management
 */
export interface RehydrationOrchestrator {
  /**
   * Debounced re-hydration function
   * Waits 500ms before calling the provided rehydrate function
   * If called again before the delay completes, cancels the previous call
   * 
   * @param context - CaseContext to send to backend
   * @param rehydrateFn - Function to call after debounce delay
   */
  debouncedRehydrate: (context: CaseContext, rehydrateFn: (context: CaseContext) => void) => void;

  /**
   * Set the loading indicator callback
   * 
   * @param setLoading - Function to call to update loading state
   */
  setLoadingIndicator: (setLoading: (loading: boolean) => void) => void;

  /**
   * Start re-hydration (show loading indicator)
   */
  startRehydration: () => void;

  /**
   * Complete re-hydration (hide loading indicator)
   */
  completeRehydration: () => void;
}

/**
 * Create a new re-hydration orchestrator instance
 * 
 * @returns RehydrationOrchestrator instance
 */
export function createRehydrationOrchestrator(): RehydrationOrchestrator {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let loadingIndicator: ((loading: boolean) => void) | null = null;

  const debouncedRehydrate = (
    context: CaseContext,
    rehydrateFn: (context: CaseContext) => void
  ): void => {
    // Clear any existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Set new timer for 500ms debounce
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      rehydrateFn(context);
    }, 500);
  };

  const setLoadingIndicator = (setLoading: (loading: boolean) => void): void => {
    loadingIndicator = setLoading;
  };

  const startRehydration = (): void => {
    if (loadingIndicator) {
      loadingIndicator(true);
    }
  };

  const completeRehydration = (): void => {
    if (loadingIndicator) {
      loadingIndicator(false);
    }
  };

  return {
    debouncedRehydrate,
    setLoadingIndicator,
    startRehydration,
    completeRehydration,
  };
}

/**
 * Helper function to get all discriminant fields from a descriptor
 * 
 * @param descriptor - GlobalFormDescriptor
 * @returns Array of discriminant field descriptors
 */
export function getDiscriminantFieldsFromDescriptor(
  descriptor: GlobalFormDescriptor
): FieldDescriptor[] {
  const allFields: FieldDescriptor[] = [];
  for (const block of descriptor.blocks) {
    allFields.push(...block.fields);
  }
  return identifyDiscriminantFields(allFields);
}
