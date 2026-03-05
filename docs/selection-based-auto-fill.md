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
  - Respects hidden/disabled status and overwrite rules.

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
    - `true` (default): skip targets whose field ids are currently hidden (per status templates).
  - `respectDisabled?: boolean`:
    - `true` (default): skip targets whose fields are currently disabled.

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
   const patch = buildAutoFillPatchFromSelection({
     descriptor: descriptorForBlock,
     selectionFieldId,
     selectedPayload,
     currentValues,
     hiddenFieldIds,
     disabledFieldIds,
   });
   ```

6. It applies the returned patch back into the form with `setValue(key, value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })`.

**Important**:

- Only **non-repeatable fields** in the block are currently considered for auto-fill.
- Hidden/disabled targets are skipped when `respectHidden` / `respectDisabled` are `true`.
- When `overwrite: false`, existing non-empty values are preserved.

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

