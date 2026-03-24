/**
 * Form Descriptor Integration - Utilities for integrating react-hook-form with form descriptors
 * 
 * Provides utility functions to extract default values, get validation rules,
 * map backend errors, and identify discriminant fields from form descriptors.
 */

import type { FieldError } from 'react-hook-form';
import { z } from 'zod';
import type { GlobalFormDescriptor, FormData, BlockDescriptor, FieldDescriptor } from '@/types/form-descriptor';
import { convertToReactHookFormRules, convertToZodSchema } from './validation-rule-adapter';
import { evaluateDefaultValue } from './default-value-evaluator';
import { evaluateTemplate } from './template-evaluator';
import type { FormContext } from './template-evaluator';
import { evaluateValidationArrayTemplate } from './array-template-evaluator';

/**
 * Helper to set a nested value on an object using dot-notation path
 * (e.g. "businessAddress.line1" → obj.businessAddress.line1).
 */
function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  if (!path) {
    return;
  }
  const parts = path.split('.');
  let current: Record<string, unknown> = target;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const existing = current[key];

    if (
      !existing ||
      typeof existing !== 'object' ||
      Array.isArray(existing)
    ) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  const lastKey = parts[parts.length - 1];
  current[lastKey] = value;
}

/**
 * Helper to get a nested value from an object using dot-notation path
 * (e.g. "businessAddress.line1" ← obj.businessAddress.line1).
 */
function getNestedValue(
  source: Record<string, unknown> | undefined,
  path: string
): unknown {
  if (!source || !path) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = source;

  for (const part of parts) {
    if (
      !current ||
      typeof current !== 'object' ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Parameters for building an auto-fill patch from a selection payload.
 * 
 * Used when a selection field (dropdown/autocomplete) is configured with
 * descriptor-driven autoFill mappings that copy properties from the selected
 * payload object into other fields in the form.
 */
export interface AutoFillSelectionParams {
  descriptor: GlobalFormDescriptor | null;
  selectionFieldId: string;
  selectedPayload: Record<string, unknown> | null | undefined;
  currentValues?: Partial<FormData>;
  hiddenFieldIds?: string[];
  disabledFieldIds?: string[];
}

/**
 * Build a form value patch based on autoFill mappings defined on the selection field.
 * 
 * This function is pure: it does not mutate descriptor or form values. It returns
 * a partial FormData object that callers can apply via react-hook-form setValue().
 */
export function buildAutoFillPatchFromSelection({
  descriptor,
  selectionFieldId,
  selectedPayload,
  currentValues,
  hiddenFieldIds = [],
  disabledFieldIds = [],
}: AutoFillSelectionParams): Partial<FormData> {
  if (!descriptor || !selectedPayload || typeof selectedPayload !== 'object' || Array.isArray(selectedPayload)) {
    return {};
  }

  // Find the selection field in the descriptor
  let selectionField: FieldDescriptor | undefined;
  for (const block of descriptor.blocks) {
    const found = block.fields.find((field) => field.id === selectionFieldId);
    if (found) {
      selectionField = found;
      break;
    }
  }

  const autoFill = selectionField?.autoFill;

  if (!autoFill || !autoFill.mappings || autoFill.mappings.length === 0) {
    return {};
  }

  const {
    mappings,
    overwrite = true,
    respectHidden = true,
    respectDisabled = true,
  } = autoFill;

  const hiddenSet = new Set(respectHidden ? hiddenFieldIds : []);
  const disabledSet = new Set(respectDisabled ? disabledFieldIds : []);

  const patch: Record<string, unknown> = {};
  const selected = selectedPayload as Record<string, unknown>;
  const current = (currentValues || {}) as Record<string, unknown>;

  for (const mapping of mappings) {
    const targetId = mapping.to;
    const sourcePath = mapping.from;

    if (!targetId || !sourcePath) {
      continue;
    }

    // Respect hidden/disabled status when configured
    if (hiddenSet.has(targetId) || disabledSet.has(targetId)) {
      continue;
    }

    const newValue = getNestedValue(selected, sourcePath);
    if (newValue === undefined) {
      continue;
    }

    if (!overwrite) {
      const existingValue = getNestedValue(current, targetId);
      if (existingValue !== undefined && existingValue !== null && existingValue !== '') {
        // Preserve existing non-empty value when overwrite is disabled
        continue;
      }
    }

    setNestedValue(patch, targetId, newValue);
  }

  return patch as Partial<FormData>;
}

/**
 * Extract default values from form descriptor fields
 * 
 * @param descriptor - Global form descriptor
 * @param context - Optional form context for template evaluation (formData, caseContext)
 * @returns Object with field IDs as keys and default values as values
 */
export function extractDefaultValues(
  descriptor: GlobalFormDescriptor | null,
  context: FormContext = {}
): Partial<FormData> {
  if (!descriptor) {
    return {};
  }

  const defaultValues: Partial<FormData> = {};
  const processedRepeatableGroups = new Set<string>();

  for (const block of descriptor.blocks) {
    if (isRepeatableBlock(block)) {
      // Handle repeatable blocks - group fields by repeatableGroupId
      const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
      
      for (const [groupId, fields] of Object.entries(fieldGroups)) {
        // Skip if we've already processed this group
        if (processedRepeatableGroups.has(groupId)) {
          continue;
        }

        // Fill repeatable group from caseContext when repeatableDefaultSource is set (Handlebars template → key)
        const sourceTemplate = block.repeatableDefaultSource;
        if (sourceTemplate) {
          const key = sourceTemplate.includes('{{') && sourceTemplate.includes('}}')
            ? evaluateTemplate(sourceTemplate, context).trim()
            : sourceTemplate.trim();
          const caseCtx = context.caseContext as Record<string, unknown> | undefined;
          const sourceArray = key && caseCtx && caseCtx[key];
          if (Array.isArray(sourceArray) && sourceArray.length > 0) {
            const baseFieldId = (f: FieldDescriptor) =>
              f.id.startsWith(`${groupId}.`) ? f.id.slice(groupId.length + 1) : f.id;
            const nonButtonFields = fields.filter(f => f.type !== 'button');
            const hasAtIndex = nonButtonFields.some(
              f => typeof f.defaultValue === 'string' && f.defaultValue.includes('@index')
            );
            if (hasAtIndex) {
              // Per-row: evaluate each field's defaultValue with @index substituted (e.g. {{caseContext.addresses.@index.street}} → .0.street for i=0)
              const rows = sourceArray.map((_item: Record<string, unknown>, i: number) => {
                const row: Record<string, unknown> = {};
                for (const field of nonButtonFields) {
                  const bid = baseFieldId(field);
                  if (field.defaultValue !== undefined && typeof field.defaultValue === 'string' && field.defaultValue.includes('@index')) {
                    const templateWithIndex = field.defaultValue.replace(/@index/g, String(i));
                    const value = evaluateDefaultValue(templateWithIndex, field.type, context);
                    setNestedValue(row, bid, value);
                  } else {
                    const item = sourceArray[i] as Record<string, unknown> | undefined;
                    const rawValue = getNestedValue(item, bid);
                    const value = rawValue !== undefined ? rawValue : '';
                    setNestedValue(row, bid, value);
                  }
                }
                return row;
              });
              (defaultValues as Record<string, unknown>)[groupId] = rows;
            } else {
              // No @index in any defaultValue: use source array as-is (normalized to field ids)
              const baseFieldIds = new Set(nonButtonFields.map(f => baseFieldId(f)));
              const normalized = sourceArray.map((item: Record<string, unknown>) => {
                const out: Record<string, unknown> = {};
                for (const id of baseFieldIds) {
                  const rawValue = getNestedValue(item, id);
                  const value = rawValue !== undefined ? rawValue : '';
                  setNestedValue(out, id, value);
                }
                return out;
              });
              (defaultValues as Record<string, unknown>)[groupId] = normalized;
            }
            processedRepeatableGroups.add(groupId);
            continue;
          }
        }
        
        // Check if any field in this group has a defaultValue
        const hasAnyDefault = fields.some(field => field.defaultValue !== undefined);
        
        if (hasAnyDefault) {
          // Build default object for this repeatable group using base field id (no groupId prefix)
          const groupDefault: Record<string, unknown> = {};
          for (const field of fields) {
            if (field.type === 'button') {
              continue;
            }
            const baseFieldId = field.id.startsWith(`${groupId}.`)
              ? field.id.slice(groupId.length + 1)
              : field.id;
            if (field.defaultValue !== undefined) {
              const evaluatedValue = evaluateDefaultValue(
                field.defaultValue,
                field.type,
                context
              );
              setNestedValue(groupDefault, baseFieldId, evaluatedValue);
            } else {
              switch (field.type) {
                case 'text':
                case 'dropdown':
                case 'autocomplete':
                  setNestedValue(groupDefault, baseFieldId, '');
                  break;
                case 'date':
                  setNestedValue(groupDefault, baseFieldId, null);
                  break;
                case 'checkbox':
                  setNestedValue(groupDefault, baseFieldId, false);
                  break;
                case 'radio':
                  setNestedValue(groupDefault, baseFieldId, '');
                  break;
                case 'number':
                  setNestedValue(groupDefault, baseFieldId, 0);
                  break;
                case 'file':
                  setNestedValue(groupDefault, baseFieldId, null);
                  break;
                default:
                  setNestedValue(groupDefault, baseFieldId, '');
              }
            }
          }
          
          (defaultValues as Record<string, unknown>)[groupId] = [groupDefault];
        } else {
          // No defaults - build empty instance shape (base field ids) and fill up to minInstances
          const emptyInstance: Record<string, unknown> = {};
          for (const field of fields) {
            if (field.type === 'button') continue;
            const baseFieldId = field.id.startsWith(`${groupId}.`)
              ? field.id.slice(groupId.length + 1)
              : field.id;
            switch (field.type) {
              case 'checkbox':
                setNestedValue(emptyInstance, baseFieldId, false);
                break;
              case 'number':
                setNestedValue(emptyInstance, baseFieldId, 0);
                break;
              case 'file':
                setNestedValue(emptyInstance, baseFieldId, null);
                break;
              default:
                setNestedValue(emptyInstance, baseFieldId, '');
            }
          }
          const min = block.minInstances ?? 0;
          (defaultValues as Record<string, unknown>)[groupId] = Array.from(
            { length: min },
            () => ({ ...emptyInstance })
          );
        }
        
        processedRepeatableGroups.add(groupId);
      }
    } else {
      // Handle non-repeatable blocks - add fields as individual properties
      for (const field of block.fields) {
        // Skip fields that belong to a repeatable group (they're handled above)
        if (field.repeatableGroupId) {
          continue;
        }
        
        // Always set a default value to ensure controlled inputs
        const target = defaultValues as Record<string, unknown>;

        if (field.defaultValue !== undefined) {
          // Evaluate defaultValue as Handlebars template if it's a string, otherwise use directly
          const evaluatedValue = evaluateDefaultValue(
            field.defaultValue,
            field.type,
            context
          );
          setNestedValue(target, field.id, evaluatedValue);
        } else {
          // Set type-appropriate default values for uncontrolled -> controlled transition
          let typeDefault: unknown;
          switch (field.type) {
            case 'text':
            case 'dropdown':
            case 'autocomplete':
              typeDefault = '';
              break;
              case 'date':
                typeDefault = null;
                break;
            case 'checkbox':
              typeDefault = false;
              break;
            case 'radio':
              typeDefault = '';
              break;
            case 'number':
              typeDefault = 0;
              break;
            case 'file':
              typeDefault = null;
              break;
            default:
              typeDefault = '';
          }
          setNestedValue(target, field.id, typeDefault);
        }
      }
    }
  }

  return defaultValues;
}

/**
 * Get validation rules for a specific field from descriptor
 * 
 * @param descriptor - Global form descriptor
 * @param fieldId - Field ID to get validation rules for
 * @returns React Hook Form validation rules object
 */
export function getFieldValidationRules(
  descriptor: GlobalFormDescriptor | null,
  fieldId: string,
  formContext: FormContext = {}
): ReturnType<typeof convertToReactHookFormRules> {
  if (!descriptor) {
    return {};
  }

  for (const block of descriptor.blocks) {
    const field = block.fields.find((f) => f.id === fieldId);
    if (field && field.validation) {
      const rules = evaluateValidationArrayTemplate(field.validation, formContext);
      return convertToReactHookFormRules(rules);
    }
  }

  return {};
}

/**
 * Backend error format
 */
export interface BackendError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Mapped error format for react-hook-form setError
 */
export interface MappedFormError {
  field: string;
  error: FieldError;
}

/**
 * Map backend validation errors to react-hook-form setError format
 * 
 * @param errors - Array of backend validation errors
 * @returns Array of mapped errors ready for setError() calls
 */
export function mapBackendErrorsToForm(errors: BackendError[]): MappedFormError[] {
  return errors.map((error) => ({
    field: error.field,
    error: {
      type: 'server',
      message: error.message,
    } as FieldError,
  }));
}

/**
 * Identify all discriminant fields from descriptor
 * 
 * @param descriptor - Global form descriptor
 * @returns Array of field IDs that are marked as discriminant
 */
export function identifyDiscriminantFields(descriptor: GlobalFormDescriptor | null): string[] {
  if (!descriptor) {
    return [];
  }

  const discriminantFields: string[] = [];

  for (const block of descriptor.blocks) {
    for (const field of block.fields) {
      if (field.isDiscriminant === true) {
        discriminantFields.push(field.id);
      }
    }
  }

  return discriminantFields;
}

/**
 * Check if a block is repeatable
 * 
 * @param block - Block descriptor to check
 * @returns true if block is marked as repeatable, false otherwise
 */
export function isRepeatableBlock(block: BlockDescriptor): boolean {
  return block.repeatable === true;
}

/**
 * Check if a block is a repeatable popin block (summary + edit in popin)
 */
export function isRepeatablePopinBlock(block: BlockDescriptor): boolean {
  return block.repeatable === true && block.repeatablePopin === true;
}

/**
 * Group fields by their repeatableGroupId
 * 
 * @param fields - Array of field descriptors
 * @returns Object mapping repeatableGroupId to array of fields in that group
 */
export function groupFieldsByRepeatableGroupId(
  fields: FieldDescriptor[]
): Record<string, FieldDescriptor[]> {
  const groups: Record<string, FieldDescriptor[]> = {};

  for (const field of fields) {
    if (field.repeatableGroupId) {
      if (!groups[field.repeatableGroupId]) {
        groups[field.repeatableGroupId] = [];
      }
      groups[field.repeatableGroupId].push(field);
    }
  }

  return groups;
}

/**
 * Build a complete Zod schema object from form descriptor
 * 
 * For repeatable blocks, builds array schemas (z.array(z.object({...}))) for each repeatable group.
 * For non-repeatable fields, builds individual field schemas.
 * 
 * @param descriptor - Global form descriptor
 * @returns Zod schema object with field IDs or group IDs as keys and Zod schemas as values
 */
export function buildZodSchemaFromDescriptor(
  descriptor: GlobalFormDescriptor | null,
  formContext: FormContext = {}
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!descriptor) {
    return z.object({});
  }

  /**
   * Tree node type for building nested Zod schemas from dot-notation ids.
   * Leaf nodes are Zod schemas; intermediate nodes are plain objects of children.
   * Using an interface avoids direct circular type aliasing.
   */
  interface SchemaTreeObject {
    [key: string]: SchemaTreeNode;
  }

  type SchemaTreeNode = z.ZodTypeAny | SchemaTreeObject;

  const schemaShape: Record<string, z.ZodTypeAny> = {};
  const processedRepeatableGroups = new Set<string>();
  const nonRepeatableTree: SchemaTreeObject = {};

  const addSchemaToTree = (
    tree: SchemaTreeObject,
    path: string,
    schema: z.ZodTypeAny
  ): void => {
    const parts = path.split('.');
    let current: SchemaTreeObject = tree;

    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      const existing = current[key];

      if (
        !existing ||
        typeof existing !== 'object' ||
        Array.isArray(existing)
      ) {
        current[key] = {};
      }

      current = current[key] as SchemaTreeObject;
    }

    const lastKey = parts[parts.length - 1];
    current[lastKey] = schema;
  };

  const schemaTreeToZod = (node: SchemaTreeNode): z.ZodTypeAny => {
    if (node && typeof node === 'object' && '_def' in (node as object)) {
      return node as z.ZodTypeAny;
    }

    const shape: Record<string, z.ZodTypeAny> = {};
    const objectNode = node as SchemaTreeObject;

    for (const [key, child] of Object.entries(objectNode)) {
      shape[key] = schemaTreeToZod(child);
    }

    return z.object(shape);
  };

  for (const block of descriptor.blocks) {
    if (isRepeatableBlock(block)) {
      // Handle repeatable blocks - group fields by repeatableGroupId
      const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
      
      for (const [groupId, fields] of Object.entries(fieldGroups)) {
        // Skip if we've already processed this group (e.g., multiple blocks with same group)
        if (processedRepeatableGroups.has(groupId)) {
          continue;
        }
        
        // Build object schema for fields in this repeatable group.
        // Use base field id (no groupId prefix) and support nested paths so schema
        // matches form shape: addresses[0].street or addresses[0].location.street
        const groupTree: Record<string, SchemaTreeNode> = {};
        for (const field of fields) {
          if (field.type === 'button') {
            continue;
          }
          const baseFieldId = field.id.startsWith(`${groupId}.`)
            ? field.id.slice(groupId.length + 1)
            : field.id;
          const fieldType = field.type as Exclude<typeof field.type, 'button'>;
          const fieldRules = evaluateValidationArrayTemplate(field.validation, formContext);
          const fieldSchema = convertToZodSchema(fieldRules, fieldType);

          if (baseFieldId.includes('.')) {
            addSchemaToTree(groupTree, baseFieldId, fieldSchema);
          } else {
            groupTree[baseFieldId] = fieldSchema;
          }
        }
        
        // Create array schema for this repeatable group
        const rowSchema = schemaTreeToZod(groupTree);
        let arraySchema = z.array(rowSchema);
        
        // Apply array-level validation (minInstances/maxInstances)
        if (block.minInstances !== undefined) {
          arraySchema = arraySchema.min(block.minInstances, {
            message: `At least ${block.minInstances} instance(s) required`,
          });
        }
        if (block.maxInstances !== undefined) {
          arraySchema = arraySchema.max(block.maxInstances, {
            message: `At most ${block.maxInstances} instance(s) allowed`,
          });
        }
        
        schemaShape[groupId] = arraySchema;
        processedRepeatableGroups.add(groupId);
      }
    } else {
      // Handle non-repeatable blocks - add fields as individual properties
      for (const field of block.fields) {
        // Skip fields that belong to a repeatable group (they're handled above)
        // Skip button fields - they don't have values to validate
        if (!field.repeatableGroupId && field.type !== 'button') {
          // Type assertion: we've already checked it's not a button
          const fieldType = field.type as Exclude<typeof field.type, 'button'>;
          const fieldRules = evaluateValidationArrayTemplate(field.validation, formContext);
          const fieldSchema = convertToZodSchema(fieldRules, fieldType);

          if (field.id.includes('.')) {
            addSchemaToTree(nonRepeatableTree, field.id, fieldSchema);
          } else {
            schemaShape[field.id] = fieldSchema;
          }
        }
      }
    }
  }

  // Convert non-repeatable nested tree into Zod object schemas at the top level
  for (const [key, node] of Object.entries(nonRepeatableTree)) {
    schemaShape[key] = schemaTreeToZod(node);
  }

  return z.object(schemaShape);
}
