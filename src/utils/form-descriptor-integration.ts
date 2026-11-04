/**
 * Form Descriptor Integration - Utilities for integrating react-hook-form with form descriptors
 * 
 * Provides utility functions to extract default values, get validation rules,
 * map backend errors, and identify discriminant fields from form descriptors.
 */

import type { FieldError } from 'react-hook-form';
import { z } from 'zod';
import type {
  DocumentCardConfig,
  DocumentCardData,
  DocumentCardProspectConfig,
  DocumentCardSlotData,
  GlobalFormDescriptor,
  FormData,
  BlockDescriptor,
  FieldDescriptor,
} from '@/types/form-descriptor';
import { convertToReactHookFormRules, convertToZodSchema } from './validation-rule-adapter';
import { bindTemplateIndex, evaluateDefaultValue, hasIndexToken } from './default-value-evaluator';
import { evaluateTemplate } from './template-evaluator';
import type { FormContext } from './template-evaluator';
import { evaluateHiddenStatus } from './template-evaluator';
import { evaluateValidationArrayTemplate, parseJsonArray } from './array-template-evaluator';
import { buildRowContext, rowOpensChild, seedChildRows } from './repeatable-child';
import {
  defaultStatusContext,
  getNestedValue,
  isSubmitSkippedFieldType,
  setNestedValue,
  shouldSkipHiddenDefault,
} from './row-values';

export { getNestedValue, isSubmitSkippedFieldType };

type ValidationScope = 'main' | 'popin';

export interface ExtractDefaultValuesOptions {
  scope?: ValidationScope;
  /**
   * Open popin instance index. Binds `@index` in a group's repeatableDefaultSource
   * and in non-repeatable field defaults. Field defaults inside an inner repeatable
   * group still bind `@index` to that group's own row.
   */
  index?: number;
}

const createDocumentSlotDefault = ({
  requestedDefault = false,
  optionalDefault,
  defaultFiles = [],
}: Pick<DocumentCardProspectConfig, 'requestedDefault' | 'optionalDefault' | 'defaultFiles'>): DocumentCardSlotData => ({
  requested: requestedDefault,
  ...(optionalDefault !== undefined ? { optional: optionalDefault } : {}),
  files: defaultFiles,
});

const normalizeDocumentSlotData = (
  slotDefault: DocumentCardSlotData,
  value?: DocumentCardSlotData
): DocumentCardSlotData => ({
  requested: value?.requested ?? slotDefault.requested,
  ...((value?.optional ?? slotDefault.optional) !== undefined
    ? { optional: value?.optional ?? slotDefault.optional }
    : {}),
  files: value?.files ?? slotDefault.files,
});

const resolveDocumentProspects = (
  config: DocumentCardConfig,
  context: FormContext
): DocumentCardProspectConfig[] => {
  if (config.prospects) {
    return config.prospects;
  }

  if (!config.prospectSource) {
    return [];
  }

  const source = resolveCaseContextPath(config.prospectSource, context);

  return Array.isArray(source)
    ? source.filter((item): item is DocumentCardProspectConfig =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as DocumentCardProspectConfig).id === 'string' &&
      typeof (item as DocumentCardProspectConfig).name === 'string'
    )
    : [];
};

const createDocumentCardDefaultData = (
  field: FieldDescriptor,
  context: FormContext,
  value?: DocumentCardData
): DocumentCardData => {
  const config = field.document;
  const rootDefault = createDocumentSlotDefault({
    requestedDefault: config?.requestedDefault,
    optionalDefault: config?.optionalDefault,
  });
  const root = normalizeDocumentSlotData(rootDefault, value);
  const base = {
    ...root,
    ...(value?.comment !== undefined ? { comment: value.comment } : {}),
  };

  if (config?.layout !== 'perProspect') {
    return base;
  }

  return {
    ...base,
    prospects: Object.fromEntries(
      resolveDocumentProspects(config, context).map((prospect) => [
        prospect.id,
        normalizeDocumentSlotData(
          createDocumentSlotDefault(prospect),
          value?.prospects?.[prospect.id]
        ),
      ])
    ),
  };
};

function shouldIncludeBlockInScope(
  block: BlockDescriptor,
  scope: ValidationScope
): boolean {
  if (scope === 'popin') {
    return true;
  }
  return block.includeInMainValidation !== false;
}

/**
 * Source path for a repeatable group. It is the block's repeatableDefaultSource.
 */
export function repeatableGroupDefaultSource(blockSource?: string): string | undefined {
  const source = blockSource?.trim();
  return source || undefined;
}

/**
 * Resolve a repeatable or prospect source.
 * A string that parses as a JSON array is the source itself (a `json` helper
 * template, or a literal JSON array). Any other string is a caseContext key
 * or path, including a template that evaluates to that key.
 * `@index` is bound before evaluation.
 */
function resolveCaseContextPath(
  sourceTemplate: string,
  context: FormContext,
  index?: number
): unknown {
  let template = sourceTemplate.trim();
  if (template.includes('@index')) {
    if (typeof index !== 'number' || index < 0) {
      return undefined;
    }
    template = bindTemplateIndex(template, index);
  }

  const evaluated = template.includes('{{') && template.includes('}}')
    ? evaluateTemplate(template, context).trim()
    : template;

  if (!evaluated) {
    return undefined;
  }

  const parsedArray = parseJsonArray(evaluated);
  if (parsedArray) {
    return parsedArray;
  }

  const path = evaluated.startsWith('caseContext.')
    ? evaluated.slice('caseContext.'.length)
    : evaluated;

  return getNestedValue(
    context.caseContext as Record<string, unknown> | undefined,
    path
  );
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

export interface AutoFillSelectionResult {
  /** Values to write into the form now. */
  patch: Partial<FormData>;
  /**
   * Hidden targets kept out of live values when respectHidden is true.
   * Callers hold these until the field is shown.
   */
  deferredPatch: Partial<FormData>;
}

const emptyAutoFillResult = (): AutoFillSelectionResult => ({
  patch: {},
  deferredPatch: {},
});

/**
 * Build a form value patch based on autoFill mappings defined on the selection field.
 *
 * This function is pure: it does not mutate descriptor or form values.
 * Hidden targets are returned on deferredPatch when respectHidden is true.
 * Disabled targets are omitted from both results.
 */
export function buildAutoFillPatchFromSelection({
  descriptor,
  selectionFieldId,
  selectedPayload,
  currentValues,
  hiddenFieldIds = [],
  disabledFieldIds = [],
}: AutoFillSelectionParams): AutoFillSelectionResult {
  if (!descriptor || !selectedPayload || typeof selectedPayload !== 'object' || Array.isArray(selectedPayload)) {
    return emptyAutoFillResult();
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
    return emptyAutoFillResult();
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
  const deferredPatch: Record<string, unknown> = {};
  const selected = selectedPayload as Record<string, unknown>;
  const current = (currentValues || {}) as Record<string, unknown>;

  for (const mapping of mappings) {
    const targetId = mapping.to;
    const sourcePath = mapping.from;

    if (!targetId || !sourcePath) {
      continue;
    }

    if (disabledSet.has(targetId)) {
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

    const destination = hiddenSet.has(targetId) ? deferredPatch : patch;
    setNestedValue(destination, targetId, newValue);
  }

  return {
    patch: patch as Partial<FormData>,
    deferredPatch: deferredPatch as Partial<FormData>,
  };
}

/**
 * Build one row of a repeatable group from field defaults, keyed by base field id.
 * `@index` stays unbound (type default). `@outerIndex` binds to the open popin row.
 */
function buildRowDefaults({
  fields,
  groupId,
  context,
  outerIndex,
}: {
  fields: FieldDescriptor[];
  groupId: string;
  context: FormContext;
  outerIndex?: number;
}): Record<string, unknown> {
  const groupDefault: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'button') {
      continue;
    }
    const baseFieldId = field.id.startsWith(`${groupId}.`)
      ? field.id.slice(groupId.length + 1)
      : field.id;
    if (shouldSkipHiddenDefault(field, defaultStatusContext(context, undefined, groupDefault))) {
      continue;
    }
    if (field.defaultValue !== undefined) {
      const evaluatedValue = evaluateDefaultValue(
        field.defaultValue,
        field.type,
        context,
        { outerIndex }
      );
      setNestedValue(
        groupDefault,
        baseFieldId,
        field.type === 'document'
          ? createDocumentCardDefaultData(field, context, evaluatedValue as DocumentCardData)
          : evaluatedValue
      );
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
        case 'document':
          setNestedValue(groupDefault, baseFieldId, createDocumentCardDefaultData(field, context));
          break;
        default:
          setNestedValue(groupDefault, baseFieldId, '');
      }
    }
  }
  return groupDefault;
}

/**
 * Extract default values from form descriptor fields
 * 
 * @param descriptor - Global form descriptor
 * @param context - Optional form context for template evaluation (formData, caseContext)
 * @param optionsOrScope - Validation scope string, or options with scope + optional outer index
 * @returns Object with field IDs as keys and default values as values
 */
export function extractDefaultValues(
  descriptor: GlobalFormDescriptor | null,
  context: FormContext = {},
  optionsOrScope: ExtractDefaultValuesOptions | ValidationScope = 'main'
): Partial<FormData> {
  if (!descriptor) {
    return {};
  }

  const options: ExtractDefaultValuesOptions =
    typeof optionsOrScope === 'string'
      ? { scope: optionsOrScope }
      : optionsOrScope;
  const scope = options.scope ?? 'main';
  const outerIndex = options.index;

  const defaultValues: Partial<FormData> = {};
  const processedRepeatableGroups = new Set<string>();
  const nestedOnMain = new Set(
    scope === 'main'
      ? repeatablePopinNestedPlacements(descriptor).map((placement) => placement.nestedBlockId)
      : []
  );

  for (const block of descriptor.blocks) {
    if (!shouldIncludeBlockInScope(block, scope)) {
      continue;
    }
    if (nestedOnMain.has(block.id)) {
      continue;
    }

    if (evaluateHiddenStatus(block, context)) {
      continue;
    }

    if (isRepeatableBlock(block)) {
      // Handle repeatable blocks - group fields by repeatableGroupId
      const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
      
      for (const [groupId, fields] of Object.entries(fieldGroups)) {
        // Skip if we've already processed this group
        if (processedRepeatableGroups.has(groupId)) {
          continue;
        }

        // Fill repeatable group from caseContext when repeatableDefaultSource is set (Handlebars template → path)
        const sourceTemplate = repeatableGroupDefaultSource(block.repeatableDefaultSource);
        if (sourceTemplate) {
          if (sourceTemplate.includes('@index') && (typeof outerIndex !== 'number' || outerIndex < 0)) {
            (defaultValues as Record<string, unknown>)[groupId] = [];
            processedRepeatableGroups.add(groupId);
            continue;
          }
          const sourceArray = resolveCaseContextPath(sourceTemplate, context, outerIndex);
          if (Array.isArray(sourceArray) && sourceArray.length > 0) {
            const baseFieldId = (f: FieldDescriptor) =>
              f.id.startsWith(`${groupId}.`) ? f.id.slice(groupId.length + 1) : f.id;
            const nonButtonFields = fields.filter(f => f.type !== 'button');
            // Child lists come from the source row, copied by base field id, and only
            // under rows whose trigger value opens the child level.
            const withSeededChildRows = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
              const config = block.repeatableChild;
              if (!config) {
                return rows;
              }
              return rows.map((row, i) => {
                const children = seedChildRows({
                  sourceRow: sourceArray[i] as Record<string, unknown>,
                  fields: nonButtonFields,
                  groupId,
                  property: config.property,
                  formContext: context,
                });
                const opensChild = rowOpensChild(
                  row,
                  block,
                  buildRowContext({ formContext: context, groupId, rows, index: i })
                );
                return children && opensChild ? { ...row, [config.property]: children } : row;
              });
            };
            const hasAtIndex = nonButtonFields.some(
              f => typeof f.defaultValue === 'string' && hasIndexToken(f.defaultValue)
            );
            if (hasAtIndex) {
              // Per-row: @index is the inner row i; @outerIndex is the open popin row
              const rows = sourceArray.map((_item: Record<string, unknown>, i: number) => {
                const row: Record<string, unknown> = {};
                const item = sourceArray[i] as Record<string, unknown> | undefined;
                for (const field of nonButtonFields) {
                  const bid = baseFieldId(field);
                  if (shouldSkipHiddenDefault(field, defaultStatusContext(context, item, row))) {
                    continue;
                  }
                  if (field.defaultValue !== undefined && typeof field.defaultValue === 'string' && hasIndexToken(field.defaultValue)) {
                    const value = evaluateDefaultValue(
                      field.defaultValue,
                      field.type,
                      context,
                      { index: i, outerIndex }
                    );
                    setNestedValue(row, bid, value);
                  } else {
                    const rawValue = getNestedValue(item, bid);
                    const value = rawValue !== undefined ? rawValue : '';
                    setNestedValue(row, bid, value);
                  }
                }
                return row;
              });
              (defaultValues as Record<string, unknown>)[groupId] = withSeededChildRows(rows);
            } else {
              // No @index or @outerIndex in any defaultValue: use source array as-is (normalized to field ids)
              const normalized = sourceArray.map((item: Record<string, unknown>) => {
                const out: Record<string, unknown> = {};
                for (const field of nonButtonFields) {
                  const id = baseFieldId(field);
                  if (shouldSkipHiddenDefault(field, defaultStatusContext(context, item, out))) {
                    continue;
                  }
                  const rawValue = getNestedValue(item, id);
                  const value = rawValue !== undefined ? rawValue : '';
                  setNestedValue(out, id, value);
                }
                return out;
              });
              (defaultValues as Record<string, unknown>)[groupId] = withSeededChildRows(normalized);
            }
            processedRepeatableGroups.add(groupId);
            continue;
          }
        }
        
        // Check if any field in this group has a defaultValue
        const hasAnyDefault = fields.some(field => field.defaultValue !== undefined);
        
        if (hasAnyDefault) {
          // Build default object for this repeatable group using base field id (no groupId prefix)
          // @index stays unbound here (type default). @outerIndex still binds to the open popin row.
          const groupDefault = buildRowDefaults({ fields, groupId, context, outerIndex });
          (defaultValues as Record<string, unknown>)[groupId] = [groupDefault];
        } else {
          // minInstances is a validation floor, not a reason to seed blank rows
          (defaultValues as Record<string, unknown>)[groupId] = [];
        }
        
        processedRepeatableGroups.add(groupId);
      }
    } else {
      // Handle non-repeatable blocks - add fields as individual properties
      // Outer index applies here (flattened popin instance fields)
      for (const field of block.fields) {
        // Skip fields that belong to a repeatable group (they're handled above)
        if (field.repeatableGroupId) {
          continue;
        }
        
        // Always set a default value to ensure controlled inputs
        const target = defaultValues as Record<string, unknown>;
        if (shouldSkipHiddenDefault(field, defaultStatusContext(context, undefined, target))) {
          continue;
        }

        if (field.defaultValue !== undefined) {
          // Evaluate defaultValue as Handlebars template if it's a string, otherwise use directly
          const evaluatedValue = evaluateDefaultValue(
            field.defaultValue,
            field.type,
            context,
            typeof outerIndex === 'number' ? { index: outerIndex, outerIndex } : {}
          );
          setNestedValue(
            target,
            field.id,
            field.type === 'document'
              ? createDocumentCardDefaultData(field, context, evaluatedValue as DocumentCardData)
              : evaluatedValue
          );
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
            case 'document':
              typeDefault = createDocumentCardDefaultData(field, context);
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

export interface RepeatablePopinNestedPlacement {
  nestedBlockId: string;
  parentGroupId: string;
  nestedBlock: BlockDescriptor;
}

function outerRepeatableGroupId(block: BlockDescriptor): string | undefined {
  const groups = groupFieldsByRepeatableGroupId(block.fields);
  const ids = Object.keys(groups);
  if (ids.length === 0) {
    return undefined;
  }
  if (ids.length === 1) {
    return ids[0];
  }
  return (
    ids.find((id) => {
      const source = repeatableGroupDefaultSource(block.repeatableDefaultSource);
      return !source?.includes('@index');
    }) ?? ids[0]
  );
}

/**
 * Blocks drawn inside a repeatable popin. On the main form their values live
 * on the parent row, not as their own top-level keys.
 */
export function repeatablePopinNestedPlacements(
  descriptor: GlobalFormDescriptor | null
): RepeatablePopinNestedPlacement[] {
  if (!descriptor) {
    return [];
  }

  const blocksById = new Map(descriptor.blocks.map((block) => [block.id, block]));
  return descriptor.blocks.flatMap((block) => {
    if (!isRepeatablePopinBlock(block) || !block.nestedBlocks?.length) {
      return [];
    }
    const parentGroupId = outerRepeatableGroupId(block);
    if (!parentGroupId) {
      return [];
    }
    return block.nestedBlocks.flatMap((entry) => {
      const nestedBlock = blocksById.get(entry.blockId);
      return nestedBlock
        ? [{ nestedBlockId: nestedBlock.id, parentGroupId, nestedBlock }]
        : [];
    });
  });
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
  formContext: FormContext = {},
  scope: ValidationScope = 'main'
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
  const nestedPlacements = scope === 'main' ? repeatablePopinNestedPlacements(descriptor) : [];
  const nestedBlockIds = new Set(nestedPlacements.map((placement) => placement.nestedBlockId));
  const nestedByParentGroup = nestedPlacements.reduce((map, placement) => {
    const current = map.get(placement.parentGroupId) ?? [];
    map.set(placement.parentGroupId, [...current, placement.nestedBlock]);
    return map;
  }, new Map<string, BlockDescriptor[]>());

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

  /**
   * Row shape of one repeatable group: base field ids (dotted ids nest), minus buttons,
   * submit-skipped types, and status-hidden fields. Shared by root and child rows.
   */
  const buildRowSchemaShape = (
    fields: FieldDescriptor[],
    groupId: string
  ): Record<string, z.ZodTypeAny> => {
    const groupTree: SchemaTreeObject = {};
    for (const field of fields) {
      if (field.type === 'button' || isSubmitSkippedFieldType(field.type)) {
        continue;
      }
      if (evaluateHiddenStatus(field, formContext)) {
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

    return Object.fromEntries(
      Object.entries(groupTree).map(([key, node]) => [key, schemaTreeToZod(node)])
    );
  };

  const limitInstances = <T extends z.ZodTypeAny>(
    schema: z.ZodArray<T>,
    { minInstances, maxInstances }: { minInstances?: number; maxInstances?: number }
  ): z.ZodArray<T> => {
    const withMin =
      minInstances !== undefined
        ? schema.min(minInstances, { message: `At least ${minInstances} instance(s) required` })
        : schema;
    return maxInstances !== undefined
      ? withMin.max(maxInstances, { message: `At most ${maxInstances} instance(s) allowed` })
      : withMin;
  };

  const arraySchemaForGroup = (owner: BlockDescriptor, fields: FieldDescriptor[]) =>
    limitInstances(z.array(z.object(buildRowSchemaShape(fields, fields[0]?.repeatableGroupId ?? ''))), owner);

  /**
   * The child list of a root row: the group's row shape with its own limits. A child row
   * cannot hold a child list, so its `property` key is rejected with a specific message.
   */
  const childArraySchemaForBlock = (
    owner: BlockDescriptor,
    groupId: string,
    fields: FieldDescriptor[]
  ) => {
    const config = owner.repeatableChild;
    if (!config) {
      return undefined;
    }
    const childRow = z.object({
      ...buildRowSchemaShape(fields, groupId),
      [config.property]: z
        .never({ message: `${config.title} rows cannot hold their own ${config.property} list` })
        .optional(),
    });
    return limitInstances(z.array(childRow), config).optional();
  };

  for (const block of descriptor.blocks) {
    if (!shouldIncludeBlockInScope(block, scope)) {
      continue;
    }
    if (nestedBlockIds.has(block.id)) {
      continue;
    }

    // Hidden blocks should not participate in submit-time validation.
    if (evaluateHiddenStatus(block, formContext)) {
      continue;
    }

    if (isRepeatableBlock(block)) {
      // Handle repeatable blocks - group fields by repeatableGroupId
      const fieldGroups = groupFieldsByRepeatableGroupId(block.fields);
      
      for (const [groupId, fields] of Object.entries(fieldGroups)) {
        // Skip if we've already processed this group (e.g., multiple blocks with same group)
        if (processedRepeatableGroups.has(groupId)) {
          continue;
        }
        
        // Build the row shape from base field ids (no groupId prefix); dotted ids nest, so the
        // schema matches the form shape: addresses[0].street or addresses[0].location.street.
        // A nested block's array is an optional key on this row, with that block's own limits.
        // The child list of a repeatableChild block is declared here too, because Zod strips
        // undeclared keys from the submitted output.
        const childArray = childArraySchemaForBlock(block, groupId, fields);
        const rowShape: Record<string, z.ZodTypeAny> = {
          ...buildRowSchemaShape(fields, groupId),
          ...(childArray && block.repeatableChild ? { [block.repeatableChild.property]: childArray } : {}),
        };
        for (const nested of nestedByParentGroup.get(groupId) ?? []) {
          if (evaluateHiddenStatus(nested, formContext) || !isRepeatableBlock(nested)) {
            continue;
          }
          const nestedGroups = groupFieldsByRepeatableGroupId(nested.fields);
          for (const [nestedGroupId, nestedFields] of Object.entries(nestedGroups)) {
            if (processedRepeatableGroups.has(nestedGroupId)) {
              continue;
            }
            rowShape[nestedGroupId] = arraySchemaForGroup(nested, nestedFields).optional();
            processedRepeatableGroups.add(nestedGroupId);
          }
        }
        const arraySchema = limitInstances(z.array(z.object(rowShape)), block);

        schemaShape[groupId] = arraySchema;
        processedRepeatableGroups.add(groupId);
      }
    } else {
      // Handle non-repeatable blocks - add fields as individual properties
      for (const field of block.fields) {
        // Skip fields that belong to a repeatable group (they're handled above)
        // Skip button fields - they don't have values to validate
        if (
          !field.repeatableGroupId &&
          field.type !== 'button' &&
          !isSubmitSkippedFieldType(field.type) &&
          !evaluateHiddenStatus(field, formContext)
        ) {
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
