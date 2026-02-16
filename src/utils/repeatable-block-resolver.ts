/**
 * Repeatable Block Reference Resolver
 * 
 * Utility functions to resolve repeatableBlockRef references in form descriptors.
 * Handles finding referenced blocks, validating they exist and aren't repeatable,
 * detecting circular references, and merging fields into repeatable blocks.
 */

import type {
  GlobalFormDescriptor,
  BlockDescriptor,
} from '@/types/form-descriptor';
import { isRepeatableBlock } from './form-descriptor-integration';

/**
 * Resolve a repeatable block reference for a specific block
 * 
 * @param blockId - ID of the block with repeatableBlockRef
 * @param descriptor - Global form descriptor
 * @returns Referenced block if found and valid, null otherwise
 */
export function resolveRepeatableBlockRef(
  blockId: string,
  descriptor: GlobalFormDescriptor
): BlockDescriptor | null {
  // Find the block with repeatableBlockRef
  const block = descriptor.blocks.find(b => b.id === blockId);
  
  if (!block || !block.repeatableBlockRef) {
    return null;
  }

  // Must be a repeatable block
  if (!isRepeatableBlock(block)) {
    return null;
  }

  // Find the referenced block
  const referencedBlock = descriptor.blocks.find(
    b => b.id === block.repeatableBlockRef
  );

  if (!referencedBlock) {
    return null;
  }

  // Referenced block must not be repeatable itself
  if (isRepeatableBlock(referencedBlock)) {
    return null;
  }

  return referencedBlock;
}

/**
 * Resolve all repeatable block references in a descriptor
 * 
 * Merges referenced block fields into repeatable blocks with proper ID prefixing.
 * 
 * @param descriptor - Global form descriptor
 * @returns New descriptor with all repeatable block references resolved
 * @throws Error if circular dependency is detected or referenced block is missing
 */
export function resolveAllRepeatableBlockRefs(
  descriptor: GlobalFormDescriptor
): GlobalFormDescriptor {
  const resolvedBlocks: BlockDescriptor[] = [];
  const resolutionPath: string[] = []; // Track resolution path for circular dependency detection

  for (const block of descriptor.blocks) {
    if (block.repeatableBlockRef) {
      // This block references another block - resolve it
      const mergedBlock = resolveRepeatableBlockRefWithValidation(
        block,
        descriptor,
        resolutionPath
      );
      resolvedBlocks.push(mergedBlock);
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
 * Resolve a repeatable block reference with validation
 * 
 * @param block - Block with repeatableBlockRef
 * @param descriptor - Global form descriptor
 * @param resolutionPath - Current resolution path for circular dependency detection
 * @returns Merged block with referenced fields
 * @throws Error if circular dependency or missing block
 */
function resolveRepeatableBlockRefWithValidation(
  block: BlockDescriptor,
  descriptor: GlobalFormDescriptor,
  resolutionPath: string[]
): BlockDescriptor {
  if (!block.repeatableBlockRef) {
    return block;
  }

  const referencedBlockId = block.repeatableBlockRef;

  // Check for self-reference first
  if (block.id === referencedBlockId) {
    throw new Error(
      `Block "${block.id}" references itself (circular dependency)`
    );
  }

  // Add current block to resolution path before checking circular dependency
  const currentPath = [...resolutionPath, block.id];

  // Check for circular dependency
  if (currentPath.includes(referencedBlockId)) {
    const cycle = [...currentPath, referencedBlockId].join(' -> ');
    throw new Error(
      `Circular dependency detected in repeatable block reference: ${cycle}`
    );
  }

  // Find referenced block
  const referencedBlock = descriptor.blocks.find(
    b => b.id === referencedBlockId
  );

  if (!referencedBlock) {
    throw new Error(
      `Referenced block "${referencedBlockId}" not found. Available blocks: ${descriptor.blocks.map(b => b.id).join(', ') || 'none'}`
    );
  }

  // Validate referenced block is not repeatable
  if (isRepeatableBlock(referencedBlock)) {
    throw new Error(
      `Referenced block "${referencedBlockId}" cannot be repeatable. Only non-repeatable blocks can be referenced.`
    );
  }

  // Add to resolution path (use current path which includes block.id)
  const newResolutionPath = [...currentPath, referencedBlockId];

  // Check if referenced block itself has a repeatableBlockRef (nested references)
  if (referencedBlock.repeatableBlockRef) {
    // Recursively resolve nested reference
    const nestedReferencedBlock = resolveRepeatableBlockRefWithValidation(
      referencedBlock,
      descriptor,
      newResolutionPath
    );
    
    // Derive repeatableGroupId from block ID
    const repeatableGroupId = block.id.endsWith('-block')
      ? block.id.slice(0, -6) // Remove "-block" (6 characters)
      : block.id;
    
    // Prefix field IDs and assign repeatableGroupId
    const mergedFields = nestedReferencedBlock.fields.map(field => ({
      ...field,
      id: `${repeatableGroupId}.${field.id}`, // Prefix field ID with groupId
      repeatableGroupId, // Assign repeatableGroupId to all fields
    }));
    
    return {
      ...block,
      fields: mergedFields,
      repeatableBlockRef: undefined, // Clear the reference after resolution
    };
  }

  // Derive repeatableGroupId from block ID
  // Remove "-block" suffix if present (e.g., "addresses-block" -> "addresses")
  // Otherwise use the block ID as-is
  const repeatableGroupId = block.id.endsWith('-block')
    ? block.id.slice(0, -6) // Remove "-block" (6 characters)
    : block.id;

  // Merge referenced block's fields into the repeatable block
  // Prefix field IDs with repeatableGroupId and assign repeatableGroupId to all fields
  const mergedFields = referencedBlock.fields.map(field => ({
    ...field,
    id: `${repeatableGroupId}.${field.id}`, // Prefix field ID with groupId
    repeatableGroupId, // Assign repeatableGroupId to all fields
  }));

  return {
    ...block,
    fields: mergedFields,
    repeatableBlockRef: undefined, // Clear the reference after resolution
  };
}
