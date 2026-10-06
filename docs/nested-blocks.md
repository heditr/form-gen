# Nested Blocks

A block can render another block inside itself. The parent lists references. The referenced block stays one declaration in `descriptor.blocks` and keeps its own title, description, status, layout, fields, and, when it is repeatable, its own limits and source.

On a plain parent, nesting changes where the block is drawn. That block's fields and repeatable group stay on their own form keys.

On a repeatable popin, the nested block's values are part of the open row. A nested repeatable group is a key on that row, not a second array beside the parent group.

This is separate from same-block `repeatableGroupId` groups, which [nested-repeatable-in-repeatable-popin.md](nested-repeatable-in-repeatable-popin.md) describes. It is also separate from `subFormRef` (sibling blocks spliced onto the main list) and `repeatableBlockRef` (fields copied onto the parent).

## Descriptor

```typescript
nestedBlocks?: Array<{
  blockId: string;
  position?: 'top' | 'bottom';
  insertBefore?: string;
  insertAfter?: string;
}>
```

Each entry sets exactly one placement:


| Placement            | Where the nested block is drawn  |
| -------------------- | -------------------------------- |
| `position: "top"`    | Before the parent's fields       |
| `position: "bottom"` | After the parent's fields        |
| `insertBefore`       | Immediately before that field id |
| `insertAfter`        | Immediately after that field id  |


`insertBefore` and `insertAfter` name a field on the parent block itself. That field must exist once, and it must not carry `repeatableGroupId`.

Two entries may name the same slot. They render in `nestedBlocks` array order. `insertAfter` one field and `insertBefore` the next field stay two slots, even when they sit next to each other.

```typescript
{
  id: 'company-block',
  title: 'Company',
  fields: [
    { id: 'legalName', type: 'text', label: 'Legal name', validation: [] },
    { id: 'city', type: 'text', label: 'City', validation: [] },
  ],
  nestedBlocks: [
    { blockId: 'registration-block', position: 'top' },
    { blockId: 'address-notes-block', insertAfter: 'legalName' },
  ],
}
```

`registration-block` and `address-notes-block` remain their own blocks in `descriptor.blocks`. The parent does not copy their fields.

A plain block may nest another plain block, and that block may nest a further plain block. A block id may be nested by only one entry in the whole descriptor.

## When the descriptor loads

Both global-descriptor routes run `assertNestedBlocks` after `resolveSubForms` and `resolveAllRepeatableBlockRefs`. Placement ids are ids on that flattened descriptor. A `blockId` written against a pre-resolution id fails lookup.

A valid descriptor is returned unchanged. An invalid one throws `NestedBlockDescriptorError` (`error-causes`), and the route responds with 500.


| Code                         | What is wrong                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `NESTED_BLOCK_PLACEMENT`     | The entry sets no placement, more than one, or a `position` other than `top` or `bottom` |
| `NESTED_BLOCK_NOT_FOUND`     | `blockId` is not in `descriptor.blocks`                                                  |
| `NESTED_BLOCK_DUPLICATE_USE` | The same block is nested more than once                                                  |
| `NESTED_BLOCK_CYCLE`         | A block nests itself, or a chain of references loops                                     |
| `NESTED_BLOCK_PARENT_KIND`   | The parent is not a plain block or a repeatable popin                                    |
| `NESTED_BLOCK_NESTED_KIND`   | The nested block is a popin (`popin` or `repeatablePopin`)                               |
| `NESTED_BLOCK_GROUP`         | A repeatable nested block does not have exactly one `repeatableGroupId`                  |
| `NESTED_BLOCK_REF_HOST`      | The nested block still has `repeatableBlockRef`                                          |
| `NESTED_BLOCK_ANCHOR`        | The anchor field is missing, duplicated, or belongs to a repeatable group                |
| `NESTED_BLOCK_FIELD_CLASH`   | On a repeatable popin row, a nested field or group key collides with a shell field       |
| `NESTED_BLOCK_GROUP_CLASH`   | A nested group id equals a group id already on the popin parent                          |


A parent in this version is a plain block, or a block with `repeatable: true` and `repeatablePopin: true`. A repeatable parent that is not a popin is rejected. A standalone `popin: true` parent is rejected.

A nested block may be plain, or repeatable and inline. `popin: true` or `repeatablePopin: true` on the nested block is rejected.

Source: `src/utils/nested-block-resolver.ts`. Types: `NestedBlockReference` in `src/types/form-descriptor.ts`.

## What the main form draws

`FormPresentation` collects every `nestedBlocks[].blockId` and skips those blocks at the top level, the same way it skips `popin` blocks. The referenced block stays in `descriptor.blocks` so lookup can find it. An unreferenced block still renders as its own section.

`FormPresentation` passes the full descriptor into `Block`. A plain parent calls `buildPlainNestedPlacement` (`src/utils/nested-block-placement.ts`) and walks its fields in order:

1. `position: "top"` entries, in array order
2. For each field: that field's `insertBefore` entries, the field, then that field's `insertAfter` entries
3. `position: "bottom"` entries, in array order

Each hit renders `Block` with the referenced descriptor, so the nested block shows its own title and applies its own layout inside itself. The nested block is full width. It is not a cell in the parent grid. Consecutive parent fields still share a grid row. A nested block between them splits that run.

```
Company
┌ Registration          ← position: "top"
│  [ registration no ]
└
Legal name
┌ Address notes         ← insertAfter: "legalName"
│  [ note ]
└
City
```

A repeatable summary does not run this walk, so nested entries stay off the summary rows. The open popin does run it. See the last section.

## Status

Status is the nested block's own status, read from the status map when `statusMode` is `"context"`, or from the block's templates otherwise.


| State                           | What is drawn                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Hidden parent                   | The parent is not rendered, so neither are its nested blocks                   |
| Hidden nested block             | That slot renders nothing. The parent's fields stay                            |
| Disabled parent                 | `isDisabled` is passed into the nested `Block`, so its fields are disabled too |
| Disabled nested block           | Only that block's fields are disabled                                          |
| Readonly parent or nested block | Readonly cascades the same way as disabled                                     |


Disabled and readonly fields still submit. Hiding a block only removes it from the page. It does not, by itself, drop that block's keys from the schema.

## Form values

On a plain parent, nesting is visual. The nested block's field ids are the form keys, exactly as they would be if the block were rendered at the top level. A repeatable nested block's group id is still that group's key on the form. The parent id is not a wrapper around those values.

On a repeatable popin, main-form defaults store only the parent rows. The nested rows stay on `caseContext` until that contact is opened. The main-form schema does not emit the nested group at the top level. It composes the nested array into the parent row. The key is optional, so an unopened row with no nested array still passes. When the key is present, the nested block's min and max apply. The parent's min and max stay on the parent array.

```typescript
contactGroupId: [
  { name: 'Ada' },
  {
    name: 'Grace',
    'emergency-contacts': [
      { emergencyName: 'Jane', emergencyPhone: '098' },
      { emergencyName: 'John', emergencyPhone: '123' },
    ],
  },
]
```

`'emergency-contacts'` is the nested block's own group id. Opening index `1` seeds only Grace's list, because `@index` in that block's `repeatableDefaultSource` is the open parent. `@index` inside an inner field `defaultValue` is the inner row. Create mode (`index < 0`) leaves a source that contains `@index` unresolved, so the nested array is `[]`.

In the popin, the instance descriptor's schema uses the nested block's min and max for that array. A hidden nested block drops its key from each parent row on the main form, and from the popin value when the instance descriptor is used.

## Repeatable popin

`assertNestedBlocks` allows a repeatable popin to list `nestedBlocks`, and it checks row clashes for that case.

Opening a row builds an instance descriptor in `buildRepeatablePopinInstanceDescriptor` (`src/utils/popin-instance-descriptor.ts`):

- `blocks[0]` is the shell. Its id is `${parent.id}-instance`. Title, description, and layout stay the parent's. Fields are the opened group only, with the group prefix removed and `repeatableGroupId` cleared. The shell keeps `nestedBlocks`. It does not take the parent's min, max, or `repeatable: true` merely because a nested block exists.
- Each referenced block follows unchanged, with its own title, min, max, layout, source, and fields.
- A same-block group that is not a nested block stays on the shell. That is what still sets `repeatable: true`.

The dialog renders the shell through `Block` and passes the instance descriptor, with `renderRepeatablesAsSummary={false}`. The shell places each nested block at its configured slot. Those later blocks are not drawn again after the shell. A repeatable summary on the main form still does not place them among its rows. `FormPresentation` also hides a referenced block as its own section.

The dialog chrome title stays the parent title. Inside the body, a nested repeatable block shows its title once, from `RepeatableFieldGroup`. Add and remove labels, min, max, and layout come from that nested block.
