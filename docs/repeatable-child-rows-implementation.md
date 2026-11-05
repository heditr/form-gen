# Repeatable Child Rows: Implementation and Debugging Guide

This guide explains how `repeatableChild` is implemented and how to debug it. For the descriptor contract, value shape and product behaviour, read [repeatable-child-rows.md](repeatable-child-rows.md) first.

## 1. What it is, in one paragraph

An inline repeatable block (`repeatable: true`, no popin) can set `repeatableChild`. A root row whose trigger field (for example `sector`) holds a trigger value (for example `holding`) can then hold one list of child rows under a property (for example `subsectors`). Child rows use the same field descriptors as root rows. Depth is capped at 2. The tree lives in a single form key:

```json
{
  "businessSectors": [
    { "sector": "holding", "percentage": 60, "subsectors": [{ "sector": "software", "percentage": 40 }] }
  ]
}
```

Everything is opt-in. A block without `repeatableChild` takes the same code paths as before.

## 2. Map of the code

| Concern | File | Entry point |
| ------- | ---- | ----------- |
| Type | `src/types/form-descriptor.ts` | `RepeatableChildConfig`, `BlockDescriptor.repeatableChild` |
| Descriptor validation | `src/utils/repeatable-child-validator.ts` | `assertRepeatableChildren` |
| Pure helpers | `src/utils/repeatable-child.ts` | `rowOpensChild`, `pruneInactiveChildLists`, `seedChildRows`, `buildRowContext`, `buildNewRowValues`, `childArrayPath`, `childRowPath`, `withRepeatableMeta` |
| Shared value helpers | `src/utils/row-values.ts` | `getNestedValue`, `setNestedValue`, `shouldSkipHiddenDefault`, `defaultStatusContext` |
| Zod schema | `src/utils/form-descriptor-integration.ts` | `buildZodSchemaFromDescriptor` (`buildRowSchemaShape`, `childArraySchemaForBlock`, `limitInstances`) |
| Prefill defaults | `src/utils/form-descriptor-integration.ts` | `extractDefaultValues` (`withSeededChildRows`) |
| Submit strip | `src/utils/schema-fingerprint.ts` | `omitStatusHiddenFormValues` (`collectChildDeletions`) |
| Saved draft prune | `src/hooks/use-form-descriptor.ts` | `initialValues` memo |
| Root list UI | `src/components/repeatable-field-group.tsx` | `RepeatableFieldGroup` |
| Child list UI | `src/components/repeatable-child-group.tsx` | `RepeatableChildGroup` |
| Row fields (shared) | `src/components/repeatable-row-fields.tsx` | `RepeatableRowFields` |
| Clear on trigger change | `src/hooks/use-repeatable-child-clear.ts` | `useRepeatableChildClear` |
| Routes | `src/app/api/form/global-descriptor/route.ts`, `.../global-descriptor-demo/route.ts` | call `assertRepeatableChildren` after `assertNestedBlocks` |
| Demo | `global-descriptor-demo/route.ts` (`business-sectors-block`), `src/app/api/demo/prefill/route.ts` | |

`row-values.ts` exists only to avoid an import cycle between `form-descriptor-integration.ts` and `repeatable-child.ts`. `getNestedValue` and `setNestedValue` are re-exported from the old file.

## 3. Lifecycle of the data

```
descriptor (JSON)
   |  route: assertRepeatableChildren   -> 500 + RepeatableChildDescriptorError on a bad config
   v
useFormDescriptor
   |  extractDefaultValues              -> root rows + child rows seeded from the prefill source
   |  merge saved draft
   |  pruneInactiveChildLists           -> drops lists the row no longer opens
   v
useForm (RHF) + live Zod resolver (buildZodSchemaFromDescriptor)
   v
FormContainer -> RepeatableFieldGroup  (useFieldArray on `businessSectors`)
                   |- RepeatableRowFields (root row fields)
                   |- Add subsector button   (list absent)  -> setValue(path, [defaultRow])
                   '- RepeatableChildGroup   (list present) -> useFieldArray on `businessSectors.<i>.subsectors`
                          '- RepeatableRowFields (child row fields)
   |  user edits trigger field -> useRepeatableChildClear -> setValue(listPath, undefined)
   v
submit: Zod parse -> omitStatusHiddenFormValues -> payload (nested tree)
draft:  raw form values (no strip)
```

## 4. How each part works

### 4.1 Descriptor validation

`assertRepeatableChildren(descriptor)` checks every block that sets `repeatableChild`, in this order, and throws on the first failure. The error is created with `createError` (`name: 'RepeatableChildDescriptorError'`). The code is on `error.cause.code`.

Order of checks: parent kind, group id (exactly one), group clash, nested host, config shape and unknown keys, `maxDepth === 2`, `property`, property clash, trigger field, trigger values, limits. The full code table is in [repeatable-child-rows.md](repeatable-child-rows.md#descriptor-errors).

Notes that matter when debugging:

- Descriptors arrive as JSON, so the type `maxDepth: 2` is not enough. The validator checks it at runtime.
- The static `triggerValues` against `items` check runs only when `triggerField.items` is an array. With a template string for `items` it is skipped.
- The check runs on the resolved descriptor. `repeatableBlockRef` copies fields only and does not copy `repeatableChild`.

### 4.2 Row context (templates)

`buildRowContext({ formContext, groupId, rows, groupRows, index, depth, parentIndex })` builds the context that status templates and `items` templates see for one row. It contains:

- the form context,
- `[groupId]: groupRows` (the root rows, also for child rows),
- the row's own values spread at the top level, so `{{sector}}` is the row's sector,
- `index`, `first`, `last` for the row's own list,
- `depth` and `parentIndex` only when passed.

`RepeatableFieldGroup` passes `depth: 1` only if `block.repeatableChild` is set. `RepeatableChildGroup` always passes `depth: 2` and `parentIndex: rootIndex`. So `depth` is `undefined` in blocks without `repeatableChild`.

`withRepeatableMeta` rewrites `@index`, `@first`, `@last` to plain `index`, `first`, `last` in status templates, because Handlebars data variables do not exist in a flat context.

### 4.3 Deciding whether a row opens the child level

`rowOpensChild(row, block, rowContext)` returns true when all of these hold:

1. `block.repeatableChild` and the group id exist.
2. `row[triggerField]` is a string in `triggerValues`.
3. The trigger field is not hidden for that row. If it has `status.hidden`, the template is evaluated with `{ ...rowContext, ...row }`.

It is used in four places: the UI (show the Add button or the list), prefill seeding, `pruneInactiveChildLists`, and the submit strip. A subsector row never gets this check because child rows never receive the child config. That is how depth 2 is enforced structurally.

### 4.4 Schema

In `buildZodSchemaFromDescriptor`:

- `buildRowSchemaShape(fields, groupId)` builds the row shape from base field ids. It skips buttons, submit-skipped types and status-hidden fields. Dotted ids still nest (`location.street`).
- Root row shape = `buildRowSchemaShape(...)` plus `[property]: childArray` when `repeatableChild` is set.
- `childArraySchemaForBlock` = `limitInstances(z.array(childRow), config).optional()`. `childRow` is the same shape plus `[property]: z.never(...).optional()`, so a nested list inside a child row fails with a specific message at `businessSectors.<i>.subsectors.<j>.subsectors`.
- `limitInstances` produces the messages `At least N instance(s) required` and `At most N instance(s) allowed`.

The root row must declare the child property. `z.object` strips unknown keys, and submit data is the Zod output. Without the declaration the subsectors would vanish from the payload.

A hidden block builds no schema at all, so neither root nor child is validated.

### 4.5 Prefill (`extractDefaultValues`)

Root rows are seeded as before. Then `withSeededChildRows` runs when the block has `repeatableChild`. For each root row `i` it calls `seedChildRows` on `sourceArray[i]` and keeps the result only if `rowOpensChild` is true for the seeded root row. Child rows are copied by base field id. Field `defaultValue` templates are not evaluated for child rows, because `@index` and `@outerIndex` are bound to the root list.

`seedChildRows` returns `undefined` when the source row has no child array or it is empty. In that case the key stays absent.

### 4.6 Rendering

`RepeatableFieldGroup` (root):

- `useFieldArray({ name: groupId })` for root rows, and `form.watch(groupId)` for the current rows.
- For each root row it renders `RepeatableRowFields`, then:
  - nothing, if the row does not open the child level;
  - `RepeatableChildGroup`, if it opens and `row[property]` is an array;
  - an Add button (`repeatable-child-add-<groupId>-<i>`), if it opens and the list is absent.
- The Add button calls `handleCreateChildList`, which does `form.setValue(listPath, [buildNewRowValues(...)])` and stores a pending focus path. An effect then calls `form.setFocus` once the child list has rendered.

`RepeatableChildGroup` (child list of one root row):

- Its own `useFieldArray({ name: 'businessSectors.<i>.subsectors' })`.
- A `fieldset` with a `legend`, per-row headings, unique `aria-label`s on Remove, and an Add button with the same `data-testid` pattern as the root's Add. Because the Add button is only ever in one of the two places (see above), the test id is unique.
- Child Add is disabled at `config.maxInstances`. Child Remove is disabled at `config.minInstances`. Remove flushes the draft and invalidates queries for the block.

`RepeatableRowFields` is the extracted per-row field renderer. It takes `rowPath` (`businessSectors.0` or `businessSectors.0.subsectors.1`) instead of `groupId.index`. It handles the grid layout, status templates, and autofill selection. Autofill writes to `${rowPath}.${key}`, so it works at both levels.

### 4.7 Why `RepeatableChildGroup` mounts only when the list exists

Spike finding (`src/components/nested-field-array.spike.test.tsx`): mounting `useFieldArray` on an absent key writes `[]` into the form values. That would turn "absent" into `[]` for every holding row, which breaks the child `minInstances: 1` case for rows the user never touched. So the child component mounts only when the list exists, and the first Add creates it with `setValue`.

Other spike findings:

- A nested `useFieldArray` under keyed parent rows survives a parent `remove()`. Sibling lists keep values and DOM nodes, because the child component is keyed by the parent row's `fieldArrayField.id` and the `name` prop shifts.
- `form.watch(callback)` reports `type: 'change'` for a user edit of a Controller-driven field. `setValue` never reports a `type`.

### 4.8 Clear policy (`useRepeatableChildClear`)

`form.watch((values, { name, type }) => ...)` is subscribed once per root group. It reacts only when:

- `type === 'change'` (user input), and
- `name` matches `^<groupId>\.(\d+)\.<triggerField>$`.

If the new trigger value is not in `triggerValues`, and the list exists, it calls `form.setValue(listPath, undefined, { shouldDirty: true })`, then `flushDraftSave()`. If the dropped list was non-empty it sets the polite live-region message ("Subsectors removed because the sector changed"). The message is rendered in an `sr-only` `role="status"` element (`repeatable-child-announcer-<groupId>`).

The policy never runs on `setValue`, reset, prefill, hydration or rules re-hydration, so re-hydration cannot wipe a list. It also means a programmatic change of the trigger (for example autofill) leaves a stale list in form state. See "Known gaps".

### 4.9 Submit and draft

- Submit: the Zod output keeps the nested tree. Then `omitStatusHiddenFormValues` strips (a) the whole child list when the row does not open the child level, and (b) status-hidden fields in each child row (one level). `collectChildDeletions` produces the deletions of kind `row` (whole list) and `child` (one field of one child row).
- Draft: `submitDraft` sends raw form values and does not call `omitStatusHiddenFormValues`. That is why the clear policy removes the list from form state itself.
- Saved draft load: `initialValues` in `use-form-descriptor.ts` calls `pruneInactiveChildLists(merged, descriptor, initFormContext)`. A descriptor version that changed `triggerValues` therefore drops lists that no longer apply.
- Multipart submit stringifies each root row, so the child list stays inside the row's JSON string.

## 5. Debugging playbook

### 5.1 The route returns 500 for the descriptor

Read the error cause code from the response or server log (`error.cause.code`, `name: 'RepeatableChildDescriptorError'`) and look it up in the table in [repeatable-child-rows.md](repeatable-child-rows.md#descriptor-errors). Common causes: `maxDepth` is not the number `2` (a string `"2"` fails), `triggerField` has the group prefix (`businessSectors.sector` instead of `sector`), `property` equals a field id, the group id is reused by another block.

### 5.2 "Add subsector" does not show

Check in this order:

1. Is `repeatableChild` still on the block that reaches the component? Log `block.repeatableChild` in `RepeatableFieldGroup`. `mergeDescriptorWithRules` spreads `...block`, so it should survive. A regression test covers it.
2. Is the root row value a string in `triggerValues`? Inspect `form.watch('businessSectors')`. A number or a different case fails `includes`.
3. Is `triggerField` hidden for the row? `rowOpensChild` evaluates `status.hidden` with `{ ...rowContext, ...row }`.
4. Is the list already present? Then the Add button is inside the child fieldset, not under the root row.
5. Is the block hidden or `isHidden` true? `RepeatableFieldGroup` returns `null`.

### 5.3 The subsectors are missing from the submitted payload

1. Was the schema built with the child array? `buildRowSchemaShape` plus the `[property]: childArray` merge happens only in the repeatable branch for `block.repeatableChild`. If an old client ignores `repeatableChild`, Zod strips the list silently. Check the descriptor `version` gating.
2. Did the row stop opening the child level? `omitStatusHiddenFormValues` drops the list when `rowOpensChild` is false (value not a trigger value, or trigger field hidden).
3. Was the block hidden at submit? A hidden block's value is dropped entirely.
4. Was the child field status-hidden? It is removed from each child row.

### 5.4 The subsectors disappear when the user changes something

- User changed the trigger of that row to a non-trigger value: expected (clear policy). Look for the live-region message.
- User removed a root row: its list goes with it.
- Nothing else should delete a list. If a list vanishes after a rules re-hydration, check that nothing calls `setValue` or `reset` on the group, and that `pruneInactiveChildLists` is not given a form context where the trigger field evaluates as hidden.

### 5.5 Lists reset or remount when a sibling row changes

`RepeatableChildGroup` must be keyed by the root row's `fieldArrayField.id`, not by index. In `RepeatableFieldGroup` the wrapper `div` has `key={fieldArrayField.id}`. If you restructure that markup and move the key, nested `useFieldArray` names shift and values can cross rows. The integration test `repeatable-child.integration.test.tsx` checks that sibling lists keep their DOM nodes.

### 5.6 Validation error shows on the wrong row or not at all

- Zod paths are `businessSectors.<i>.subsectors.<j>.<field>`. RHF resolves `errors.businessSectors[i].subsectors[j].<field>`.
- Child list errors (min and max) are read with `get(form.formState.errors, arrayPath)?.message` in `RepeatableChildGroup` and rendered with `role="alert"` and `repeatable-child-error-<groupId>-<i>`.
- Backend errors must use the same dot-index paths. `mapBackendErrorsToForm` passes `field` straight to `setError`.
- A child min of 1 with `[]` gives "At least 1 instance(s) required". Absent is valid.
- A `subsectors` key inside a child row fails with "<title> rows cannot hold their own <property> list".

### 5.7 A dropdown has the wrong options in subsector rows

`items` may be a Handlebars template. It is evaluated with the row context (`formContext={rowContext}` in `RepeatableRowFields`), so `depth`, `parentIndex`, `index` and the row's own values are available:

```ts
items: `{{#if (eq depth 2)}}
  [{"label":"Software","value":"software"},{"label":"Retail","value":"retail"}]
{{else}}
  [{"label":"Holding","value":"holding"},{"label":"Software","value":"software"},{"label":"Retail","value":"retail"}]
{{/if}}`
```

This is derived from reading the code and is not covered by a test yet. Pitfalls: the template must output a JSON array of `{label, value}` items (anything else yields `[]` silently, see `evaluateItemsArrayTemplate`), `depth` is `undefined` in blocks without `repeatableChild`, and the Zod schema does not restrict values to the options, so a bad value from a draft or prefill is not blocked on the client.

### 5.8 Useful inspection snippets

In the browser console of the demo form (RHF instance exposed to you in dev, or via a temporary `console.log` in `RepeatableFieldGroup`):

```ts
form.getValues('businessSectors')                    // whole tree
form.getValues('businessSectors.1.subsectors')       // one child list (undefined = absent)
form.formState.errors.businessSectors                // errors by index
```

Pure helpers can be checked in a test or a scratch script without React:

```ts
rowOpensChild({ sector: 'holding' }, block)                       // true / false
pruneInactiveChildLists(values, descriptor, formContext)          // returns the same object when nothing changes
omitStatusHiddenFormValues(descriptor, values, caseContext)       // what submit will send
```

`pruneInactiveChildLists` and `omitStatusHiddenFormValues` return the input object when nothing changes, so `===` tells you whether they did anything.

## 6. Tests (where to look)

| Area | Test file |
| ---- | --------- |
| Validator, every code | `src/utils/repeatable-child-validator.test.ts` |
| Routes (500 on bad descriptor, demo passes) | `src/app/api/form/global-descriptor/route.repeatable-child.test.ts`, `src/app/api/form/global-descriptor-demo/route.repeatable-child.test.ts` |
| Pure helpers | `src/utils/repeatable-child.test.ts` |
| Schema and defaults | `src/utils/form-descriptor-integration.repeatable-child.test.ts` |
| Submit strip | `src/utils/schema-fingerprint.repeatable-child.test.ts` |
| Saved draft prune | `src/hooks/use-form-descriptor.repeatable-child.test.tsx` |
| Nested `useFieldArray` and `watch` behaviour (spike) | `src/components/nested-field-array.spike.test.tsx` |
| Row fields component | `src/components/repeatable-row-fields.test.tsx` |
| Child list component | `src/components/repeatable-child-group.test.tsx` |
| Root group with child rows | `src/components/repeatable-field-group.repeatable-child.test.tsx` |
| End to end through the form | `src/components/repeatable-child.integration.test.tsx` |
| Regressions | `src/utils/descriptor-merger.test.ts`, `src/utils/submission-orchestrator.test.ts`, `src/hooks/use-draft-save.test.ts`, `src/app/api/demo/prefill/route.test.ts` |

Run a single file: `npx vitest run src/utils/repeatable-child.test.ts`. Tests use Vitest `describe`/`test`/`expect` with given/should names, as the rest of the suite does.

## 7. Known gaps and design decisions

- **Autofill leaves a stale list.** A programmatic change of the trigger value does not run the clear policy. The list is hidden in the UI and stripped at submit and on load, but the draft payload does not strip it. A fix would run `pruneInactiveChildLists` in the draft path.
- **Pluralisation.** The fieldset legend and the announcement append "s" to `repeatableChild.title`. This only suits English.
- **No sum rules.** "Roots total 100" and "subsectors total the parent" belong to the backend.
- **No confirmation** before dropping a list on trigger change (product question 1).
- **Same fields at both levels.** Only `items` templates, `status` templates and data sources can vary per depth.
- **`buildNewRowValues` vs the `extractDefaultValues` row builder.** They differ (date `''` vs `null`, document shape), so they are not merged. Merging them would change existing behaviour.
- **`rowOpensChild` takes the block**, not just the config, because it needs the trigger field's status.
- **Baseline test failure.** `src/components/popin-manager.test.tsx` ("given openPopin with groupId and index options...") fails on the untouched repo too. It is unrelated to this feature.
