/**
 * Sub-Form Collector - Utility to collect sub-form references from a descriptor
 * 
 * Traverses a GlobalFormDescriptor to find all subFormRef values,
 * including nested references within sub-forms.
 */

import type { GlobalFormDescriptor, BlockDescriptor } from '@/types/form-descriptor';

/**
 * Collect all unique sub-form references from a descriptor
 * 
 * Traverses blocks recursively to find all subFormRef values.
 * 
 * @param descriptor - Global form descriptor to scan
 * @returns Array of unique sub-form IDs referenced in the descriptor
 */
export function collectSubFormReferences(descriptor: GlobalFormDescriptor): string[] {
  const subFormRefs = new Set<string>();
  const visited = new Set<string>(); // Track visited sub-forms to avoid infinite loops

  function collectFromBlocks(blocks: BlockDescriptor[]): void {
    for (const block of blocks) {
      if (block.subFormRef) {
        const subFormId = block.subFormRef;
        
        // Add to set if not already visited (prevents duplicates)
        if (!visited.has(subFormId)) {
          subFormRefs.add(subFormId);
          visited.add(subFormId);
        }
      }
    }
  }

  // Collect from top-level blocks
  collectFromBlocks(descriptor.blocks);

  return Array.from(subFormRefs);
}
