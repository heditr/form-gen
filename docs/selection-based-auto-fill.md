# Selection-Based Auto-Fill (Descriptor-Driven)

This document explains how to configure and use the **selection-based auto-fill** feature, where choosing an option in a dropdown/autocomplete field automatically fills other fields in the same block based on the selected item's payload.

---

## 1. Concept: `autoFill` on Selection Fields

Any selection field (`dropdown` or `autocomplete`) can declare an `autoFill` configuration. The idea:

- The field loads options from **static items** or a **data source**.
- Each option (`FieldItem`) can carry a **raw payload** (`raw`) representing the full object from the API.
- When the user selects an option, the form engine:
  - Reads properties from the payload (using dot-paths, e.g. `address.city`).
  - Writes them into target fields (also addressed by dot-paths, e.g. `parentCompany.address.city`).
  - Respects disabled status and overwrite rules. Hidden targets are held until shown.

Descriptor shape on a selection field:

```ts
{
  id: 'parentCompanySelector',
  type: 'autocomplete', // or 'dropdown'
  label: 'Existing Parent Company',
  dataSource: {
    url: '/api/data-sources/parent-companies',
    itemsTemplate: '{"label":"{{item.name}} ({{item.registrationNumber}})","value":"{{item.id}}"}',
  },
  validation: [],
  autoFill: {
    mappings: [
      { from: 'name', to: 'parentCompany.name' },
      { from: 'registrationNumber', to: 'parentCompany.registrationNumber' },
      { from: 'address.line1', to: 'parentCompany.address.line1' },
      { from: 'address.city', to: 'parentCompany.address.city' },
      { from: 'address.country', to: 'parentCompany.address.country' },
    ],
    overwrite: true,          // default: true
    respectHidden: true,      // default: true
    respectDisabled: true,    // default: true
  },
}
```

### 1.1 `AutoFillConfig` and `AutoFillMapping`

- **`AutoFillMapping`**:
  - `from`: dot-path in the selected payload (e.g. `"address.city"`).
  - `to`: target field id / path in form data (e.g. `"parentCompany.address.city"`).

- **`AutoFillConfig`**:
  - `mappings: AutoFillMapping[]` – required mapping list.
  - `overwrite?: boolean`:
    - `true` (default): always write the mapped value into the target field.
    - `false`: do **not** overwrite a target field if it already has a non-empty value in the current form data.
  - `respectHidden?: boolean`:
    - `true` (default): hold a target that is hidden when the option is chosen. The value is not written into flat-field form values while it stays hidden. When the field becomes visible, the held value is applied if the same selection is still set and the user has not cleared that target.
    - `false`: write the mapped value into live values immediately, including targets that are currently hidden.
  - `respectDisabled?: boolean`:
    - `true` (default): skip targets whose fields are currently disabled. Disabled targets are not held.

---

## 2. Data Sources and `FieldItem.raw`

Dynamic data sources run through `response-transformer` which produces `FieldItem` objects:

```ts
export interface FieldItem {
  label: string;
  value: string | number | boolean;
  raw?: Record<string, unknown>; // full API record, when available
}
```

For JSON-style `itemsTemplate`:

```ts
itemsTemplate: '{"label":"{{item.name}} ({{item.registrationNumber}})","value":"{{item.id}}"}'
```

the transformer:

- Parses the JSON to get `label` and `value`.
- Sets `raw` to the original `item` object from the API response.

When the user selects an option:

- `AutocompleteField` / `DropdownField` call `onAutoFillSelection(fieldId, payload)`.
- `payload` is:
  - `item.raw` when present and object-like.
  - Otherwise `{ label, value }` as a fallback.

---

## 3. Runtime Flow (Block + Auto-Fill Helper)

The **`Block`** component wires UI selections to the pure helper `buildAutoFillPatchFromSelection`:

1. A selection field inside a block fires `onAutoFillSelection(fieldId, selectedPayload)`.
2. `Block` builds a minimal `GlobalFormDescriptor` for that block:

   ```ts
   const descriptorForBlock = {
     blocks: [block],
     submission: { url: '', method: 'POST' },
   };
   ```

3. It computes hidden/disabled target ids for **non-repeatable** fields using `evaluateHiddenStatus` / `evaluateDisabledStatus`.
4. It reads current form values via `form.getValues()`.
5. It calls:

   ```ts
   const { patch, deferredPatch } = buildAutoFillPatchFromSelection({
     descriptor: descriptorForBlock,
     selectionFieldId,
     selectedPayload,
     currentValues,
     hiddenFieldIds,
     disabledFieldIds,
   });
   ```

6. It applies the live patch with `setValue(key, value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })`.
7. When `respectHidden` is true, hidden targets are stored in a hold keyed by field id, source field id, and source value. `applyMembershipChanges` writes that hold when the field becomes visible, unless a user stash exists or `getValues(sourceFieldId)` no longer equals the stored source value. Clearing the selector drops the hold.

A selection inside a repeatable row, including a nested repeatable rendered in a repeatable popin, does not use `Block.handleAutoFillSelection`. `RepeatableFieldGroup` reduces `group.{index}.selector` to the base id, maps `to` paths as base ids on that row, and writes `group.{index}.{key}`. A visible sibling fills as soon as the option is chosen. `status.hidden` templates that use `@index` are rewritten to `index` before the hidden check, the same rewrite used for render. The popin instance descriptor leaves the nested block unchanged, so this is that block's own repeatable group.

Per-field hidden inside a row is not a form-membership hide. The mapped value is written onto the row even while that input is hidden, and a hold of `{ sourceValue }` remembers it. The input stays empty in the UI until the status shows it, then it reads the row value. Clearing the selector before the user edits the value removes it. A value the user cleared after seeing it is left alone.

`Block.handleAutoFillSelection` still does not target fields inside a nested repeatable group.

**Important**:

- Disabled targets are skipped when `respectDisabled` is `true`.
- `respectHidden: true` (default) holds hidden targets until they are visible. `respectHidden: false` writes them into live values immediately.
- When `overwrite: false`, existing non-empty values are preserved.

`@outerIndex` is not an alias inside `repeatableDefaultSource`. Add inside the popin does not receive the outer index, so a remap template on that new row returns the field type default.

---

## 4. Demo: `/demo-with-submit`

The **`DemoWithSubmitPage`** uses `/api/form/global-descriptor-demo` which includes a showcase block:

- Block id: `parent-company-auto-fill`.
- Visible only when `entityType === "corporation"`.
- Contains:
  - `parentCompanySelector` (autocomplete, backed by `/api/data-sources/parent-companies`).
  - Detail fields wired via `autoFill.mappings`:
    - `parentCompany.name`
    - `parentCompany.registrationNumber`
    - `parentCompany.address.line1`
    - `parentCompany.address.city`
    - `parentCompany.address.country`

The data source `/api/data-sources/parent-companies` returns rich company objects with `id`, `name`, `registrationNumber`, and nested `address` fields, so selecting a company clearly demonstrates the auto-fill behavior.

---

## 5. Usage Guidelines

- **Good use cases**:
  - Reusing existing entities (e.g. parent companies, clients, addresses) where selecting one should pre-populate multiple related fields.
  - Reducing user typing while still allowing edits after auto-fill.

- **Keep in mind**:
  - Always define corresponding target fields (with matching `to` paths) in the same block.
  - Prefer JSON `itemsTemplate` when you want `FieldItem.raw` to carry the full API record.
  - Use `overwrite: false` when user-entered values should win over auto-fill on subsequent selections.

