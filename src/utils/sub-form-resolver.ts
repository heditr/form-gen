/**
 * Sub-Form Resolver - Utility to resolve and merge sub-forms into global descriptor
 * 
 * Server-side utility that traverses a GlobalFormDescriptor, finds all subFormRef
 * references, fetches the referenced sub-forms, and merges them into a fully
 * flattened GlobalFormDescriptor. This keeps the frontend completely agnostic
 * to sub-form complexity.
 * 
 * Features:
 * - Recursive resolution of nested sub-forms
 * - Block ID prefixing to prevent collisions
 * - Field ID prefixing with instance IDs
 * - Circular dependency detection
 * - JSON-serializable output
 */

import type {
  GlobalFormDescriptor,
  SubFormDescriptor,
  BlockDescriptor,
  FieldDescriptor,
} from '@/types/form-descriptor';

/**
 * Options for sub-form resolution
 */
export interface ResolveSubFormsOptions {
  /**
   * Map of sub-form ID to SubFormDescriptor
   * Used to fetch sub-forms during resolution
   */
  subFormMap: Map<string, SubFormDescriptor>;
}

/**
 * Resolve and merge all sub-forms referenced in a GlobalFormDescriptor
 * 
 * @param descriptor - Global form descriptor that may contain subFormRef references
 * @param options - Resolution options including sub-form map
 * @returns Fully merged GlobalFormDescriptor with all sub-forms resolved
 * @throws Error if sub-form is missing or circular dependency is detected
 */
export function resolveSubForms(
  descriptor: GlobalFormDescriptor,
  subFormMap: Map<string, SubFormDescriptor>
): GlobalFormDescriptor {
  const resolvedBlocks: BlockDescriptor[] = [];
  const resolutionPath: string[] = []; // Track resolution path for circular dependency detection

  // Process each block in the descriptor
  for (const block of descriptor.blocks) {
    if (block.subFormRef) {
      // This block references a sub-form - resolve and merge it
      const mergedBlocks = resolveSubFormBlock(
        block,
        subFormMap,
        resolutionPath
      );
      resolvedBlocks.push(...mergedBlocks);
    } else {
      // Regular block - add as-is
      resolvedBlocks.push(block);
    }
  }

  return {
    ...descriptor,
    blocks: resolvedBlocks,
  };
}

/**
 * Resolve a single block that references a sub-form
 * 
 * @param block - Block descriptor with subFormRef
 * @param subFormMap - Map of available sub-forms
 * @param resolutionPath - Current resolution path for circular dependency detection
 * @returns Array of merged block descriptors
 */
function resolveSubFormBlock(
  block: BlockDescriptor,
  subFormMap: Map<string, SubFormDescriptor>,
  resolutionPath: string[]
): BlockDescriptor[] {
  const subFormId = block.subFormRef!;

  // Check for circular dependency
  if (resolutionPath.includes(subFormId)) {
    const cycle = [...resolutionPath, subFormId].join(' -> ');
    throw new Error(
      `Circular dependency detected in sub-form resolution: ${cycle}`
    );
  }

  // Fetch sub-form
  const subForm = subFormMap.get(subFormId);
  if (!subForm) {
    throw new Error(
      `Sub-form "${subFormId}" not found. Available sub-forms: ${Array.from(subFormMap.keys()).join(', ') || 'none'}`
    );
  }

  // Add to resolution path
  const newResolutionPath = [...resolutionPath, subFormId];

  // Process sub-form blocks
  const mergedBlocks: BlockDescriptor[] = [];

  for (const subFormBlock of subForm.blocks) {
    // Check if this block itself references another sub-form (nested sub-forms)
    if (subFormBlock.subFormRef) {
      // Recursively resolve nested sub-form
      const nestedBlocks = resolveSubFormBlock(
        subFormBlock,
        subFormMap,
        newResolutionPath
      );
      // Add nested blocks with proper prefixing
      for (const nestedBlock of nestedBlocks) {
        const prefixedNestedBlock = prefixBlockIds(
          nestedBlock,
          subForm.id,
          block.subFormInstanceId
        );
        mergedBlocks.push(prefixedNestedBlock);
      }
    } else {
      // Regular block - merge with prefixing
      const mergedBlock = mergeSubFormBlock(
        subFormBlock,
        subForm.id,
        block.subFormInstanceId,
        subFormMap,
        newResolutionPath
      );
      mergedBlocks.push(mergedBlock);
    }
  }

  return mergedBlocks;
}

/**
 * Merge a sub-form block into the parent descriptor with proper ID prefixing
 * 
 * @param subFormBlock - Block from sub-form
 * @param subFormId - ID of the sub-form
 * @param instanceId - Optional instance ID for multiple uses of same sub-form
 * @param subFormMap - Map of available sub-forms (for nested resolution)
 * @param resolutionPath - Current resolution path
 * @returns Merged block descriptor with prefixed IDs
 */
function mergeSubFormBlock(
  subFormBlock: BlockDescriptor,
  subFormId: string,
  instanceId: string | undefined,
  subFormMap: Map<string, SubFormDescriptor>,
  resolutionPath: string[]
): BlockDescriptor {
  return prefixBlockIds(subFormBlock, subFormId, instanceId);
}

/**
 * Prefix block and field IDs with sub-form ID and instance ID
 * 
 * @param block - Block to prefix
 * @param subFormId - ID of the sub-form
 * @param instanceId - Optional instance ID for multiple uses of same sub-form
 * @returns Block with prefixed IDs
 */
function prefixBlockIds(
  block: BlockDescriptor,
  subFormId: string,
  instanceId: string | undefined
): BlockDescriptor {
  // Prefix block ID: subFormId_instanceId_blockId or subFormId_blockId
  const blockIdPrefix = instanceId
    ? `${subFormId}_${instanceId}`
    : subFormId;
  const prefixedBlockId = `${blockIdPrefix}_${block.id}`;

  // Process fields with ID prefixing
  const mergedFields: FieldDescriptor[] = block.fields.map((field) => {
    // Prefix field ID if instance ID is provided
    const prefixedFieldId = instanceId
      ? `${instanceId}.${field.id}`
      : field.id;

    return {
      ...field,
      id: prefixedFieldId,
    };
  });

  return {
    ...block,
    id: prefixedBlockId,
    fields: mergedFields,
    // Remove subFormRef and subFormInstanceId since we're resolving
    subFormRef: undefined,
    subFormInstanceId: undefined,
  };
}
