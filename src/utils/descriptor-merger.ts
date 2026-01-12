/**
 * Descriptor Merger - Utility to deep merge GlobalFormDescriptor with RulesObject
 * 
 * Provides functions to merge validation rules and status templates from RulesObject
 * into GlobalFormDescriptor while preserving the original structure.
 */

import type {
  GlobalFormDescriptor,
  RulesObject,
  BlockDescriptor,
  FieldDescriptor,
  ValidationRule,
  StatusTemplates,
} from '@/types/form-descriptor';

/**
 * Merge status templates, preserving existing templates and adding new ones
 * 
 * @param existing - Existing status templates (may be undefined)
 * @param updates - New status templates from rules
 * @returns Merged status templates
 */
function mergeStatusTemplates(
  existing: StatusTemplates | undefined,
  updates: StatusTemplates | undefined
): StatusTemplates | undefined {
  if (!updates) {
    return existing;
  }
  
  if (!existing) {
    return updates;
  }
  
  return {
    ...existing,
    ...updates,
  };
}

/**
 * Merge validation rules, appending new rules to existing ones
 * 
 * @param existing - Existing validation rules
 * @param updates - New validation rules from rules object
 * @returns Merged validation rules array
 */
function mergeValidationRules(
  existing: ValidationRule[],
  updates: ValidationRule[] | undefined
): ValidationRule[] {
  if (!updates || updates.length === 0) {
    return existing;
  }
  
  return [...existing, ...updates];
}

/**
 * Merge a single field descriptor with rules updates
 * 
 * @param field - Original field descriptor
 * @param fieldRules - Field rules from RulesObject
 * @returns Updated field descriptor
 */
function mergeFieldDescriptor(
  field: FieldDescriptor,
  fieldRules: { id: string; validation?: ValidationRule[]; status?: StatusTemplates } | undefined
): FieldDescriptor {
  if (!fieldRules || fieldRules.id !== field.id) {
    return field;
  }
  
  return {
    ...field,
    validation: mergeValidationRules(field.validation, fieldRules.validation),
    status: mergeStatusTemplates(field.status, fieldRules.status),
  };
}

/**
 * Merge a single block descriptor with rules updates
 * 
 * @param block - Original block descriptor
 * @param blockRules - Block rules from RulesObject
 * @param fieldRulesMap - Map of field ID to field rules
 * @returns Updated block descriptor
 */
function mergeBlockDescriptor(
  block: BlockDescriptor,
  blockRules: { id: string; status?: StatusTemplates } | undefined,
  fieldRulesMap: Map<string, { id: string; validation?: ValidationRule[]; status?: StatusTemplates }>
): BlockDescriptor {
  const updatedFields = block.fields.map((field) => {
    const fieldRules = fieldRulesMap.get(field.id);
    return mergeFieldDescriptor(field, fieldRules);
  });
  
  const updatedStatus = mergeStatusTemplates(block.status, blockRules?.status);
  
  return {
    ...block,
    fields: updatedFields,
    status: updatedStatus,
  };
}

/**
 * Deep merge GlobalFormDescriptor with RulesObject
 * 
 * Merges validation rules and status templates from RulesObject into the
 * GlobalFormDescriptor while preserving the original structure.
 * 
 * @param globalDescriptor - The base form descriptor
 * @param rulesObject - Rules object with updates from backend
 * @returns Merged GlobalFormDescriptor
 */
export function mergeDescriptorWithRules(
  globalDescriptor: GlobalFormDescriptor,
  rulesObject: RulesObject
): GlobalFormDescriptor {
  // Create a map of field rules for efficient lookup
  const fieldRulesMap = new Map<string, { id: string; validation?: ValidationRule[]; status?: StatusTemplates }>();
  if (rulesObject.fields) {
    for (const fieldRule of rulesObject.fields) {
      fieldRulesMap.set(fieldRule.id, fieldRule);
    }
  }
  
  // Create a map of block rules for efficient lookup
  const blockRulesMap = new Map<string, { id: string; status?: StatusTemplates }>();
  if (rulesObject.blocks) {
    for (const blockRule of rulesObject.blocks) {
      blockRulesMap.set(blockRule.id, blockRule);
    }
  }
  
  // Merge blocks
  const mergedBlocks = globalDescriptor.blocks.map((block) => {
    const blockRules = blockRulesMap.get(block.id);
    return mergeBlockDescriptor(block, blockRules, fieldRulesMap);
  });
  
  // Return merged descriptor with preserved structure
  return {
    ...globalDescriptor,
    blocks: mergedBlocks,
  };
}
