# Repeatable Child Rows

An inline repeatable block can let one row hold exactly one nested list of the same group. The standard example is business sectors: a sector row with the value `holding` can list its own subsectors, and each subsector has the same two fields (sector, percentage). The user edits both levels inline on the main form, and the child list is indented under its row.

Depth is capped at 2: a root level and one child level. A child row never holds a further list.

This is separate from the other nesting mechanisms:

- [nested-blocks.md](nested-blocks.md) nests a different block, once. A block cannot nest itself.
- [nested-repeatable-in-repeatable-popin.md](nested-repeatable-in-repeatable-popin.md) stores a different group on a popin row and edits it in a dialog.
- `repeatableBlockRef` copies fields onto the host block. `subFormRef` splices sibling blocks. Neither creates a nested array.

## Descriptor

Set `repeatableChild` on an inline repeatable block (`repeatable: true`, no `popin`, no `repeatablePopin`).

```typescript
{
  id: 'business-sectors-block',
  title: 'Business sector',
  repeatable: true,
  minInstances: 0,
  maxInstances: 10,
  repeatableDefaultSource: 'businessSectors',
  repeatableChild: {
    property: 'subsectors',      // key on the root row that holds the child array
    maxDepth: 2,                 // required literal 2
    title: 'Subsector',          // child row heading and accessible name
    addLabel: 'Add subsector',
    triggerField: 'sector',      // base field id in this group (no group prefix)
    triggerValues: ['holding'],  // values of the trigger field that open the child level
    minInstances: 0,             // per child list
    maxInstances: 5,             // per child list
  },
  fields: [
    {
      id: 'businessSectors.sector',
      type: 'dropdown',
      label: 'Sector',
      repeatableGroupId: 'businessSectors',
      items: [
        { label: 'Holding', value: 'holding' },
        { label: 'Software', value: 'software' },
      ],
      validation: [{ type: 'required', message: 'Sector is required' }],
    },
    {
      id: 'businessSectors.percentage',
      type: 'number',
      label: 'Percentage',
      repeatableGroupId: 'businessSectors',
      validation: [],
    },
  ],
}
```

There are no per-level fields. Child rows reuse the group's fields, and the field `status` templates still apply inside them. The block's `minInstances` and `maxInstances` govern the root list. `repeatableChild.minInstances` and `maxInstances` govern each child list on its own.

`repeatableChild` is not inherited through `repeatableBlockRef`. The check runs after resolution.

### Descriptor errors

The global descriptor routes call `assertRepeatableChildren` right after `assertNestedBlocks`. A failure is a `RepeatableChildDescriptorError` (created with `createError`, code on `error.cause.code`) and the route responds 500.

| Code | Raised when |
| ---- | ----------- |
| `REPEATABLE_CHILD_PARENT_KIND` | The block is not `repeatable: true`, or it is a `popin` or `repeatablePopin`. |
| `REPEATABLE_CHILD_GROUP` | The block does not declare exactly one `repeatableGroupId`. |
| `REPEATABLE_CHILD_GROUP_CLASH` | The group id also appears on another block. |
| `REPEATABLE_CHILD_NESTED_HOST` | Another block lists this block in `nestedBlocks`. |
| `REPEATABLE_CHILD_DEPTH` | `maxDepth` is missing or is not 2. |
| `REPEATABLE_CHILD_UNSUPPORTED` | The config is not an object or has unknown keys, including `repeatableChild` or `fields`. |
| `REPEATABLE_CHILD_PROPERTY` | `property` is missing, empty, or contains a dot. |
| `REPEATABLE_CHILD_PROPERTY_CLASH` | `property` equals the first segment of a base field id in the group, or any group id in the descriptor. |
| `REPEATABLE_CHILD_TRIGGER_FIELD` | `triggerField` is not a top-level base field of the group, or is not a `dropdown` or `radio`. |
| `REPEATABLE_CHILD_TRIGGER_VALUES` | `triggerValues` is empty, has non-strings or duplicates, or (with static `items`) lists a value that is not an item. |
| `REPEATABLE_CHILD_LIMITS` | A child min or max is negative or not an integer, or min is above max. |

## Value shape

The child list is a property of the root row. Child rows hold only the group's base fields.

```json
{
  "businessSectors": [
    {
      "sector": "holding",
      "percentage": 60,
      "subsectors": [
        { "sector": "software", "percentage": 40 },
        { "sector": "holding", "percentage": 20 }
      ]
    },
    { "sector": "software", "percentage": 40 }
  ]
}
```

The key is absent until the user adds the first child row. Removing the last child at child min 0 leaves `[]`. The backend contract treats an absent list and `[]` as equivalent.

A row opens the child level when the trigger field holds one of `triggerValues` and the trigger field is not hidden for that row. A child row set to a trigger value opens nothing: only root rows ever carry the child config.

### Paths

| What | Path |
| ---- | ---- |
| Root field | `businessSectors.0.sector` |
| Child array | `businessSectors.0.subsectors` |
| Child field | `businessSectors.0.subsectors.1.percentage` |

Backend errors must use these dot-index paths so `mapBackendErrorsToForm` can place them. An array-level error (limits, sum rules) belongs on `businessSectors` or `businessSectors.<i>.subsectors`. Both render in an alert.

## Validation schema

`buildZodSchemaFromDescriptor` builds the root row shape and one child row shape from the same fields, with the same status-hidden filter. The child array is an optional key on the root row, so it appears in the Zod output. A child row declares its own `property` key as `never`, so a child row that holds a `subsectors` array fails at `businessSectors.<i>.subsectors.<j>.subsectors`.

| Child list | Result |
| ---------- | ------ |
| Absent | valid |
| `[]` | valid when child min is 0 or unset; "At least N instance(s) required" when min is 1 or more |
| Non-empty | each row is validated, and child max applies |

Child limits are independent of root limits. A child list can require 1 row while the root list allows 0.

Per-row percentage rules come from each field's `validation`. Sum rules ("roots total 100", "subsectors total the parent") are not modelled. The backend owns them and reports them as array-level errors.

## Prefill

With `repeatableDefaultSource` set, root rows are seeded as for any inline group. Child rows come from `sourceRow[property]` and are copied by base field id. The prefill shape must mirror the form shape:

```json
{
  "businessSectors": [
    { "sector": "retail", "percentage": 30 },
    {
      "sector": "holding",
      "percentage": 70,
      "subsectors": [{ "sector": "software", "percentage": 40 }]
    }
  ]
}
```

- A source row whose trigger value is not in `triggerValues` is seeded without children, even if the source has some.
- Field `defaultValue` templates with `@index` or `@outerIndex` are not evaluated for child rows. They are bound to the root list and would read the wrong rows.
- A default hidden by a row template with no explicit default is omitted from the child row, as for root rows.
- Saved drafts load through `pruneInactiveChildLists`, so a descriptor that changed `triggerValues` drops lists that no longer apply.

## Adding and removing

- Root Add and Remove behave as before.
- A root row that opens the child level shows an Add control (`addLabel`). The first click creates the child list with one default row and moves focus to its first field. Later rows are added inside the labelled fieldset.
- Child Add is disabled at child `maxInstances`. Child Remove is disabled at child `minInstances`. Limits apply per list.
- Removing a root row removes its child list with it. Other rows' lists keep their DOM nodes and values.
- Child Remove and root Remove both flush the draft and invalidate queries for the block.
- `isDisabled` disables both levels. Child rows inherit the block's disabled and readonly state.

## Trigger change

When the user changes the trigger field of a root row to a value that is not in `triggerValues`, the row's child list is dropped from form state at once. There is no confirmation in v1. The draft is flushed, and a polite live region announces "Subsectors removed because the sector changed" when a non-empty list was dropped.

Only a user edit does this. `setValue`, reset, prefill, and re-hydration never delete a child list. A programmatic change of the trigger value (for example autofill) leaves the stale list in form state. It is hidden from the UI, and `omitStatusHiddenFormValues` and `pruneInactiveChildLists` strip it at submit and on load. The draft payload does not run that strip.

If the trigger field is hidden by status for a row, its list is not rendered and the submit strips it. Form state is kept, so unhiding restores it.

## Row template context

Templates on fields (`status.hidden`, `disabled`, `readonly`) read the row's values plus `index`, `first`, and `last`. For a block with `repeatableChild`, they also read `depth` (1 for a root row, 2 for a child row) and, on child rows, `parentIndex` (the root row's index). `index` is the position inside the row's own list. Blocks without `repeatableChild` get exactly the context they had before.

A data-source URL that uses `{{index}}` is ambiguous in child rows. Use `parentIndex` with `index`.

## Submission

The payload is the nested tree. There is no serializer.

- JSON submit passes the tree through.
- Multipart submit stringifies each root row, so the child list stays inside that row's JSON string.
- A `payloadTemplate` can reach both levels with `{{json businessSectors}}` or nested `{{#each}}`.
- The final submit strips status-hidden fields one level into child rows and drops child lists that the row does not open.

## Compatibility

`repeatableChild` is optional. Existing descriptors, saved drafts, and groups without it validate and render as before.

A client that does not know `repeatableChild` ignores it, and Zod silently strips `subsectors` from the output. Ship the frontend first and gate the descriptor `version`.

## Demo

`/api/form/global-descriptor-demo` includes a `business-sectors-block`. `/api/demo/prefill` supplies two rows, the `holding` row with two subsectors.

## Open product questions

1. Confirm or immediate clear when a holding row with subsectors is changed. Is accidental loss acceptable?
2. Must a holding row have at least one subsector?
3. Which sum rules exist, and does the backend own them all?
4. Are duplicate sectors among siblings allowed?
5. Does a read-only or review page need a tree summary?
6. What are the real caps for root and child lists?
