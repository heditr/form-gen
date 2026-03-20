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

type FieldRule = NonNullable<RulesObject['fields']>[number];
type BlockRule = NonNullable<RulesObject['blocks']>[number];

/**
 * Merge status templates, preserving existing templates and adding new ones
 */
function mergeStatusTemplates(
  existing: StatusTemplates | undefined,
  updates: StatusTemplates | undefined
): StatusTemplates | undefined {
  if (!updates) return existing;
  if (!existing) return updates;
  return { ...existing, ...updates };
}

/**
 * Merge validation rules, appending new rules to existing ones.
 * When `existing` is a Handlebars template string it is preserved as-is.
 */
function mergeValidationRules(
  existing: ValidationRule[] | string,
  updates: ValidationRule[] | undefined
): ValidationRule[] | string {
  if (typeof existing === 'string') return existing;
  if (!updates || updates.length === 0) return existing;
  return [...existing, ...updates];
}

function mergeFieldDescriptor(
  field: FieldDescriptor,
  fieldRules: FieldRule | undefined
): FieldDescriptor {
  if (!fieldRules) return field;

  return {
    ...field,
    validation: mergeValidationRules(field.validation, fieldRules.validation),
    status: mergeStatusTemplates(field.status, fieldRules.status),
  };
}

function mergeBlockDescriptor(
  block: BlockDescriptor,
  blockRules: BlockRule | undefined,
  fieldRulesMap: Map<string, FieldRule>
): BlockDescriptor {
  return {
    ...block,
    fields: block.fields.map((field) =>
      mergeFieldDescriptor(field, fieldRulesMap.get(field.id))
    ),
    status: mergeStatusTemplates(block.status, blockRules?.status),
  };
}

/**
 * Deep merge GlobalFormDescriptor with RulesObject.
 * 
 * Merges validation rules and status templates from a RulesObject into a
 * GlobalFormDescriptor while preserving the original structure.
 * 
 * @param globalDescriptor - The base form descriptor
 * @param rulesObject - Rules object with updates from the backend
 * @returns Merged GlobalFormDescriptor
 */
export function mergeDescriptorWithRules(
  globalDescriptor: GlobalFormDescriptor,
  rulesObject: RulesObject
): GlobalFormDescriptor {
  const fieldRulesMap = new Map<string, FieldRule>(
    rulesObject.fields?.map((r) => [r.id, r]) ?? []
  );

  const blockRulesMap = new Map<string, BlockRule>(
    rulesObject.blocks?.map((r) => [r.id, r]) ?? []
  );

  return {
    ...globalDescriptor,
    blocks: globalDescriptor.blocks.map((block) =>
      mergeBlockDescriptor(block, blockRulesMap.get(block.id), fieldRulesMap)
    ),
  };
}
