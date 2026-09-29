# Schema fingerprint — how validation membership is decided

This document explains [`src/utils/schema-fingerprint.ts`](../src/utils/schema-fingerprint.ts): which fields participate in the live Zod schema, how that decision becomes a string the resolver can compare, and how hidden values are stripped before submit.

It does **not** paint the UI. Visibility on screen is the status map in `FormStatusProvider`. This file is the membership clock for validation and for values that must leave the payload.

For the hook that consumes the fingerprint, see [use-form-descriptor.md](./use-form-descriptor.md). For the two channels (paint vs values), see [thin-center-form-engine.md](./thin-center-form-engine.md).

---

## 1. Role

`schema-fingerprint.ts` answers three questions:

| Question | Function |
|----------|----------|
| Which fields are in Zod right now? | `collectValidationTargets` |
| Did that set, or their rules, change? | `buildSchemaFingerprint` |
| Which ids appeared or disappeared? | `diffValidationTargets` |

Two related helpers are not part of the fingerprint string:

| Question | Function |
|----------|----------|
| Which ids are status-hidden, including file and document? | `collectStatusHiddenFieldIds` |
| Which keys must be deleted from a submit payload? | `omitStatusHiddenFormValues` |
| Flat id list for the submit orchestrator | `getActiveValidationTargetIds` |

`use-live-zod-resolver` stores the fingerprint string. On the next validate, a matching string reuses the existing Zod schema. A different string calls `buildZodSchemaFromDescriptor` again.

---

## 2. The fingerprint string

`buildSchemaFingerprint` concatenates three facts:

```ts
`${descriptorIdentity}::${contextHash}::${targetsHash}`
```

| Segment | Example | Meaning |
|---------|---------|---------|
| Descriptor identity | `v0:block1` | `descriptor.version` (or `v0`) plus block ids joined by commas. `no-descriptor` when the descriptor is null. |
| Context | `{}` | `JSON.stringify(caseContext)` |
| Targets | `country:none\|ssn:required:` | Each target is `id:ruleFingerprint`, sorted, then joined with `\|` |

Targets are sorted before joining, so field order in the descriptor does not change the string.

### Rule fingerprint

`buildRuleFingerprint` evaluates `field.validation` with `evaluateValidationArrayTemplate`, then encodes each rule:

| Rule | Encoding |
|------|----------|
| No rules, or an empty array | `none` |
| `{ type: 'required' }` | `required:` (no `value` property, so the part after the colon is empty) |
| `{ type: 'minLength', value: 2 }` | `minLength:2` |
| `{ type: 'pattern', value: '^[0-9]+$' }` | `pattern:^[0-9]+$` (pattern values are always stringified) |
| Several rules | Joined with commas: `required:,minLength:2` |

A Handlebars string in `validation` is evaluated against the same form context before encoding. A static array is used as-is.

---

## 3. Debugger walkthrough: country hides SSN

The fixture is the one in `src/utils/schema-fingerprint.test.ts`.

```ts
blocks: [{
  id: 'block1',
  fields: [
    { id: 'country', type: 'text', validation: [] },
    {
      id: 'ssn',
      type: 'text',
      validation: [{ type: 'required' }],
      status: {
        hidden: '{{#if (eq formData.country "US")}}false{{else}}true{{/if}}',
      },
    },
  ],
}]
```

The user has typed `country = "US"`. A value change reaches the resolver and `applyMembershipChanges`.

### Step 1. Build the template context

`buildFormContextFromValues({ country: 'US' }, {})` produces:

```ts
{
  country: 'US',
  caseContext: {},
  formData: { country: 'US' },
}
```

Hidden templates read `formData.country` and `caseContext.*` from this object. Spreading the values onto the root is what lets a row template say `country` instead of `formData.country`.

### Step 2. Walk blocks and drop hidden fields

`collectValidationTargets(descriptor, context, 'main')`:

1. Block `block1` is included because `includeInMainValidation` is not `false`. Scope `'popin'` includes every block.
2. The block itself has no `status.hidden`, so the block stays.
3. `country` is not a button, not a file or document, not a repeatable-group field, and not hidden. It is a target.
4. The SSN template evaluates to the string `"false"`. `evaluateHiddenStatus` returns false, so SSN stays.

Skipped types never become targets: `button`, and `file` / `document` (`isSubmitSkippedFieldType`). A visible file field stays in the form values. It is absent from Zod.

### Step 3. Encode each field's rules

- `country` has `validation: []` → `none`
- `ssn` has `[{ type: 'required' }]` → `required:`

Targets:

```ts
[
  { id: 'country', ruleFingerprint: 'none' },
  { id: 'ssn', ruleFingerprint: 'required:' },
]
```

### Step 4. Fingerprint

```text
v0:block1::{}::country:none|ssn:required:
```

### Step 5. User changes country to `"FR"`

The same walk runs. The SSN template now evaluates to `"true"`. `collectValidationTargets` skips `ssn`.

```ts
[{ id: 'country', ruleFingerprint: 'none' }]
```

New fingerprint:

```text
v0:block1::{}::country:none
```

The resolver sees a different string and rebuilds Zod without SSN. An empty SSN no longer fails `required`.

### Step 6. Diff drives unregister and restore

`diffValidationTargets(previous, next)` compares ids only:

- `newlyVisible` — ids in `next` that are absent from `previous`
- `newlyHidden` — ids in `previous` that are absent from `next`

| | Previous (`US`) | Next (`FR`) |
|---|-----------------|-------------|
| ids | `country`, `ssn` | `country` |
| `newlyHidden` | | `['ssn']` |
| `newlyVisible` | | `[]` |

`use-live-zod-resolver` stashes the current SSN value, `unregister`s the field, and clears its error. Switching back to `US` puts `ssn` in `newlyVisible` and `setValue`s the stash, or the descriptor default. The first pass treats every visible field as newly visible and does **not** validate, so mount does not show errors.

`collectStatusHiddenFieldIds` is a second list, used only for values. It includes file and document fields. A hidden file must leave the values even though it was never a Zod target. Treating "missing from Zod targets" as "hidden" would wipe a visible file upload.

---

## 4. Repeatable groups

A repeatable block does not emit one target per column. `collectValidationTargets` emits **one target per group id**.

Visible, non-button, non-file columns are folded into that group's `ruleFingerprint`:

```text
addressType:none|country:none|state:required:|street:none
```

Column ids are stripped of the `groupId.` prefix (`addresses.country` → `country`) before encoding. If every column is hidden, the group is omitted.

`collectStatusHiddenFieldIds` is coarser for groups: it pushes the group id when the block is hidden, or when every non-button field in the group is hidden. It does not list per-row keys.

Per-row deletion lives in `omitStatusHiddenFormValues`. For each row it overlays that row onto the parent context (`overlayRowContext`), so a row's `country` wins over a parent `country`. Address `state` can hide on a US row and stay on a FR row in the same array.

---

## 5. Submit path

`omitStatusHiddenFormValues` does not build a fingerprint. It walks the same hidden rules and deletes keys that are present and hidden:

| Case | Deletion |
|------|----------|
| Hidden non-repeatable field | Delete the path. Dotted ids use `deleteNestedValue`. |
| Fully hidden repeatable block | Delete the whole group array. |
| Hidden column inside a row | Delete only that row's key, using the row overlay as context. |

Buttons, file, and document fields are skipped. Fields that belong to a repeatable group are handled on the row path, not as top-level paths.

If nothing present is hidden, the function returns the original object and does not clone. `File`, `Blob`, and `Date` values are kept by reference when a clone is required.

`getActiveValidationTargetIds` is the flat id list the submit orchestrator uses: the same target walk, ids only. It threads `caseContext` into the template context, so a field hidden on `caseContext.country` is absent unless that context is passed.

---

## 6. What changes the fingerprint

The string changes when any of these change:

- Descriptor version, or the list of block ids
- `caseContext` (the whole object is stringified, even if no field's visibility changed)
- A field entering or leaving the target list (hidden, shown, or a block excluded from main validation)
- A field's evaluated rules (`required` added, `minLength` value changed, pattern string changed)

It does not change when the user types into a field whose rules and visibility stay the same. Typing `"U"` then `"US"` into country changes the fingerprint only at the moment SSN's hidden template flips.

---

## 7. Call sites

| Caller | What it uses |
|--------|----------------|
| [`src/hooks/use-live-zod-resolver.ts`](../src/hooks/use-live-zod-resolver.ts) | Targets, fingerprint, status-hidden ids, and the hide/show diff. The resolver rebuilds Zod when the fingerprint changes. `applyMembershipChanges` unregisters hidden fields and restores shown ones. |
| [`src/utils/submission-orchestrator.ts`](../src/utils/submission-orchestrator.ts) | `getActiveValidationTargetIds` for submit-time checks, `omitStatusHiddenFormValues` so hidden keys are not posted. |
| [`src/components/popin-form-session.tsx`](../src/components/popin-form-session.tsx) | `omitStatusHiddenFormValues` on the popin payload. |
| [`src/app/demo-with-submit/page.tsx`](../src/app/demo-with-submit/page.tsx) | Same omit helper on the demo submit path. |

---

## 8. Related docs

- [use-form-descriptor.md](./use-form-descriptor.md) — hook that owns the resolver and membership sync
- [thin-center-form-engine.md](./thin-center-form-engine.md) — paint channel vs value channel
- [case-context-usage.md](./case-context-usage.md) — how `caseContext` is shaped and consumed
- [nested-field-paths-and-schema-tree.md](./nested-field-paths-and-schema-tree.md) — dotted paths that `deleteNestedValue` walks
