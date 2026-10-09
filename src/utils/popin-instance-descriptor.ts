/**
 * Builds the descriptor for one open repeatable popin row.
 *
 * The shell holds the opened group's fields. A block referenced by nestedBlocks
 * stays a later block, with its own title, limits, and layout.
 */

import type { BlockDescriptor, GlobalFormDescriptor } from '@/types/form-descriptor';
import { groupFieldsByRepeatableGroupId } from '@/utils/form-descriptor-integration';

export function buildRepeatablePopinInstanceDescriptor({
  block,
  groupId,
  descriptor,
}: {
  block: BlockDescriptor;
  groupId: string;
  descriptor: GlobalFormDescriptor;
}): GlobalFormDescriptor | null {
  const groupFields = groupFieldsByRepeatableGroupId(block.fields)[groupId];
  if (!groupFields?.length) {
    return null;
  }

  const instanceFields = groupFields
    .filter((field) => field.type !== 'button')
    .map((field) => {
      const baseId = field.id.startsWith(`${groupId}.`)
        ? field.id.slice(groupId.length + 1)
        : field.id;
      return { ...field, id: baseId, repeatableGroupId: undefined };
    });

  const sameBlockGroupFields = block.fields.filter(
    (field) => field.repeatableGroupId && field.repeatableGroupId !== groupId
  );

  const blocksById = new Map(descriptor.blocks.map((item) => [item.id, item]));
  const nestedBlocks = (block.nestedBlocks ?? []).flatMap((entry) => {
    const nested = blocksById.get(entry.blockId);
    return nested ? [nested] : [];
  });

  const shell: BlockDescriptor = {
    id: `${block.id}-instance`,
    title: block.title,
    ...(block.description ? { description: block.description } : {}),
    ...(block.layout ? { layout: block.layout } : {}),
    ...(sameBlockGroupFields.length > 0 ? { repeatable: true } : {}),
    ...(block.nestedBlocks ? { nestedBlocks: block.nestedBlocks } : {}),
    fields: [...instanceFields, ...sameBlockGroupFields],
  };

  return {
    ...(descriptor.version ? { version: descriptor.version } : {}),
    blocks: [shell, ...nestedBlocks],
    submission: descriptor.submission,
  };
}
