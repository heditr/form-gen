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
                    row[bid] = evaluateDefaultValue(templateWithIndex, field.type, context);
                  } else {
                    const item = sourceArray[i] as Record<string, unknown> | undefined;
                    row[bid] = (item && typeof item === 'object' && bid in item) ? item[bid] : '';
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
                  out[id] = (item && typeof item === 'object' && id in item) ? item[id] : '';
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
              groupDefault[baseFieldId] = evaluatedValue;
            } else {
              switch (field.type) {
                case 'text':
                case 'dropdown':
                case 'autocomplete':
                case 'date':
                  groupDefault[baseFieldId] = '';
                  break;
                case 'checkbox':
                  groupDefault[baseFieldId] = false;
                  break;
                case 'radio':
                  groupDefault[baseFieldId] = '';
                  break;
                case 'number':
                  groupDefault[baseFieldId] = 0;
                  break;
                case 'file':
                  groupDefault[baseFieldId] = null;
                  break;
                default:
                  groupDefault[baseFieldId] = '';
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
                emptyInstance[baseFieldId] = false;
                break;
              case 'number':
                emptyInstance[baseFieldId] = 0;
                break;
              case 'file':
                emptyInstance[baseFieldId] = null;
                break;
              default:
                emptyInstance[baseFieldId] = '';
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
        if (field.defaultValue !== undefined) {
          // Evaluate defaultValue as Handlebars template if it's a string, otherwise use directly
          const evaluatedValue = evaluateDefaultValue(
            field.defaultValue,
            field.type,
            context
          );
          defaultValues[field.id as keyof FormData] = evaluatedValue as FormData[keyof FormData];
        } else {
          // Set type-appropriate default values for uncontrolled -> controlled transition
          switch (field.type) {
            case 'text':
            case 'dropdown':
            case 'autocomplete':
            case 'date':
              defaultValues[field.id as keyof FormData] = '' as FormData[keyof FormData];
              break;
            case 'checkbox':
              defaultValues[field.id as keyof FormData] = false as unknown as FormData[keyof FormData];
              break;
            case 'radio':
              defaultValues[field.id as keyof FormData] = '' as FormData[keyof FormData];
              break;
            case 'number':
              defaultValues[field.id as keyof FormData] = 0 as unknown as FormData[keyof FormData];
              break;
            case 'file':
              defaultValues[field.id as keyof FormData] = null as FormData[keyof FormData];
              break;
            default:
              defaultValues[field.id as keyof FormData] = '' as FormData[keyof FormData];
          }
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
  fieldId: string
): ReturnType<typeof convertToReactHookFormRules> {
  if (!descriptor) {
    return {};
  }

  for (const block of descriptor.blocks) {
    const field = block.fields.find((f) => f.id === fieldId);
    if (field && field.validation) {
      return convertToReactHookFormRules(field.validation);
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
  descriptor: GlobalFormDescriptor | null
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!descriptor) {
    return z.object({});
  }

  const schemaShape: Record<string, z.ZodTypeAny> = {};
  const processedRepeatableGroups = new Set<string>();

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
        // Use base field id (no groupId prefix) so schema matches form shape: addresses[0].street not addresses[0]['addresses.street']
        const objectShape: Record<string, z.ZodTypeAny> = {};
        for (const field of fields) {
          if (field.type === 'button') {
            continue;
          }
          const baseFieldId = field.id.startsWith(`${groupId}.`)
            ? field.id.slice(groupId.length + 1)
            : field.id;
          const fieldType = field.type as Exclude<typeof field.type, 'button'>;
          objectShape[baseFieldId] = convertToZodSchema(field.validation, fieldType);
        }
        
        // Create array schema for this repeatable group
        let arraySchema = z.array(z.object(objectShape));
        
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
          schemaShape[field.id] = convertToZodSchema(field.validation, fieldType);
        }
      }
    }
  }

  return z.object(schemaShape);
}
