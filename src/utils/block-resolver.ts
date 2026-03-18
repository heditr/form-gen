/**
 * Block Resolver - Utility to resolve blocks by ID from mergedDescriptor
 * 
 * Provides functions to lookup blocks by ID for popin triggers, with
 * status template evaluation and caching for performance.
 */

import type {
  GlobalFormDescriptor,
  BlockDescriptor,
} from '@/types/form-descriptor';
import type { FormContext } from './template-evaluator';
import { evaluateHiddenStatus, evaluateDisabledStatus } from './template-evaluator';

/**
 * Result of block resolution with evaluated status
 */
export interface ResolvedBlock {
  block: BlockDescriptor;
  isHidden: boolean;
  isDisabled: boolean;
}

/**
 * Cache for block lookup map to enable O(1) access
 * Key: descriptor reference
 * Value: Map of block ID to BlockDescriptor
 */
const blockCache = new WeakMap<GlobalFormDescriptor, Map<string, BlockDescriptor>>();

/**
 * Build or retrieve cached block lookup map for a descriptor
 * 
 * @param descriptor - Global form descriptor
 * @returns Map of block ID to BlockDescriptor
 */
function getBlockMap(descriptor: GlobalFormDescriptor): Map<string, BlockDescriptor> {
  // Check cache first
  const cached = blockCache.get(descriptor);
  if (cached) {
    return cached;
  }

  // Build lookup map
  const blockMap = new Map<string, BlockDescriptor>();
  for (const block of descriptor.blocks) {
    blockMap.set(block.id, block);
  }

  // Cache the map
  blockCache.set(descriptor, blockMap);

  return blockMap;
}

/**
 * Resolve a block by ID from mergedDescriptor
 * 
 * @param blockId - ID of the block to resolve
 * @param descriptor - Merged global form descriptor
 * @param formContext - Form context for status template evaluation
 * @returns ResolvedBlock with evaluated status, or null if block not found
 */
export function resolveBlockById(
  blockId: string,
  descriptor: GlobalFormDescriptor,
  formContext: FormContext
): ResolvedBlock | null {
  // Get cached block map
  const blockMap = getBlockMap(descriptor);

  // Lookup block by ID
  const block = blockMap.get(blockId);

  if (!block) {
    console.error(`Block "${blockId}" not found. Available blocks: ${Array.from(blockMap.keys()).join(', ') || 'none'}`);
    return null;
  }

  // Evaluate status templates
  const isHidden = evaluateHiddenStatus(block, formContext);
  const isDisabled = evaluateDisabledStatus(block, formContext);

  return {
    block,
    isHidden,
    isDisabled,
  };
}
