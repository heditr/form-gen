# Repeatable Block Address — Backend Example

Example of a **repeatable address block** filled from the backend at **initial page load** using **Handlebars** and **case prefill**: addresses live in `casePrefill.addresses` → `caseContext.addresses`, and the descriptor uses `repeatableDefaultSource: 'addresses'` so the repeatable block is populated from context when default values are computed.

**Live demo:** The demo page (`/demo`) loads case prefill from `GET /api/demo/prefill` (which returns `casePrefill` including `addresses`). The descriptor from `GET /api/form/global-descriptor-demo` sets `repeatableDefaultSource: 'addresses'` on the addresses block so the form shows the backend list at load. Use **Load backend addresses** to refetch prefill and refresh the list.

## 1. Descriptor: repeatable address block and Handlebars default source

The form uses a **non-repeatable template block** (`address-block`) plus a **repeatable block** that references it (`addresses-block`). The repeatable block’s fields are resolved from `address-block`; the repeatable group ID is derived from the block id (e.g. `addresses-block` → `addresses`).

```json
{
  "blocks": [
    {
      "id": "address-block",
      "title": "Address",
      "description": "A single address entry",
      "fields": [
        { "id": "street", "type": "text", "label": "Street Address", "validation": [{ "type": "required", "message": "Street address is required" }] },
        { "id": "city", "type": "text", "label": "City", "validation": [{ "type": "required", "message": "City is required" }] },
        { "id": "zip", "type": "text", "label": "ZIP/Postal Code", "validation": [{ "type": "required", "message": "ZIP/Postal code is required" }] }
      ]
    },
    {
      "id": "addresses-block",
      "title": "Addresses",
      "description": "Add multiple addresses (repeatable field group)",
      "repeatable": true,
      "repeatableBlockRef": "address-block",
      "minInstances": 1,
      "maxInstances": 5,
      "repeatableDefaultSource": "addresses",
      "fields": []
    }
  ]
}
```

This structure is already used in `GET /api/form/global-descriptor-demo`.

### Alternative: per-field defaultValues with `@index`

You can also fill each row from context by using **`@index`** in field `defaultValue` templates. When `repeatableDefaultSource` is set and the source array exists, if any field has a `defaultValue` containing the literal `@index`, the engine builds one row per array index and replaces `@index` with that index (0, 1, 2, …) before evaluating the Handlebars template. So `{{caseContext.addresses.@index.street}}` becomes `{{caseContext.addresses.0.street}}` for the first row, etc.

Example descriptor (inline fields, no `repeatableBlockRef`):

```json
{
  "blocks": [
    {
      "id": "addresses-block",
      "title": "Addresses",
      "repeatable": true,
      "repeatableDefaultSource": "addresses",
      "fields": [
        {
          "id": "street",
          "type": "text",
          "label": "Street",
          "repeatableGroupId": "addresses",
          "defaultValue": "{{caseContext.addresses.@index.street}}",
          "validation": []
        },
        {
          "id": "city",
          "type": "text",
          "label": "City",
          "repeatableGroupId": "addresses",
          "defaultValue": "{{caseContext.addresses.@index.city}}",
          "validation": []
        }
      ]
    }
  ]
}
```

- You still need **`repeatableDefaultSource: 'addresses'`** so the engine knows which key in `caseContext` holds the array (and thus the row count).
- For each row index `i`, `@index` in the template string is replaced by `i` before evaluation.
- If a field has no `defaultValue` or no `@index`, the value is taken from the corresponding item in the source array (e.g. `caseContext.addresses[i][fieldId]`) or a type default.

## 2. Backend response: different addresses

When loading a case or prefill, the backend can return form data that includes an **array of addresses**. The property name must match the repeatable group id: **`addresses`** (from `addresses-block`).

### Example: GET /api/demo/prefill

The repo includes **`GET /api/demo/prefill`**, which returns **case prefill** (not form data). The repeatable block is filled at initial load from `caseContext.addresses` via `repeatableDefaultSource`:

**Response body:**

```json
{
  "casePrefill": {
    "incorporationCountry": "US",
    "processType": "standard",
    "needSignature": true,
    "addresses": [
      { "street": "123 Main St", "city": "New York", "zip": "10001" },
      { "street": "456 Oak Ave", "city": "Boston", "zip": "02101" },
      { "street": "789 Harbor Dr", "city": "San Francisco", "zip": "94102" }
    ]
  }
}
```

The app calls `initializeCaseContextFromPrefill({ casePrefill })` so `caseContext.addresses` is set; `extractDefaultValues(descriptor, formContext)` then uses `repeatableDefaultSource: 'addresses'` to set the repeatable block’s default value from `caseContext.addresses`.

### Alternative: GET /api/cases/123 returning formData

If you prefer to prefill by syncing form data (no Handlebars for the repeatable block), the backend can return form data and you call `syncFormDataToContext({ formData })`:

**Response body:**

```json
{
  "caseId": "case-123",
  "formData": {
    "name": "Acme Corp",
    "entityType": "corporation",
    "addresses": [
      { "street": "123 Main St", "city": "New York", "zip": "10001" },
      { "street": "456 Oak Ave", "city": "Boston", "zip": "02101" }
    ]
  }
}
```

Each object in `addresses` corresponds to one instance of the repeatable block. Field keys (`street`, `city`, `zip`) must match the field `id`s in `address-block`.

### Minimal backend example (Next.js route) — case prefill (Handlebars path)

```typescript
// app/api/demo/prefill/route.ts or app/api/cases/[id]/route.ts
import { NextResponse } from 'next/server';
import type { CasePrefill } from '@/types/form-descriptor';

export async function GET() {
  const casePrefill: CasePrefill = {
    incorporationCountry: 'US',
    processType: 'standard',
    needSignature: true,
    addresses: [
      { street: '123 Main St', city: 'New York', zip: '10001' },
      { street: '456 Oak Ave', city: 'Boston', zip: '02101' },
      { street: '789 Harbor Dr', city: 'San Francisco', zip: '94102' },
    ],
  };

  return NextResponse.json({ casePrefill });
}
```

## 3. Filling the repeatable block at initial page load

1. Backend returns **case prefill** (e.g. `GET /api/demo/prefill`) with an `addresses` array.
2. App dispatches `initializeCaseContextFromPrefill({ casePrefill })` so `caseContext.addresses` is set.
3. The descriptor’s addresses block has **`repeatableDefaultSource: 'addresses'`** (or a Handlebars template that evaluates to that key).
4. When the form builds default values, `extractDefaultValues(descriptor, formContext)` reads `caseContext.addresses` and uses it as the default for the repeatable group, so the Addresses block shows the backend list at initial load.

No need to call `syncFormDataToContext` for addresses when using this path; the repeatable block is filled via Handlebars/defaults from case context.

## 4. Form data shape summary

| Source              | Shape                                                                 |
|---------------------|-----------------------------------------------------------------------|
| Descriptor          | `address-block` (template) + `addresses-block` (repeatable, `repeatableDefaultSource: 'addresses'`) |
| Repeatable group id | `addresses` (from block id `addresses-block`)                         |
| Case prefill (Handlebars path) | `casePrefill.addresses` → `caseContext.addresses`; default values read from context at load |
| Backend formData (alternative) | `formData.addresses`: array of `{ street, city, zip }` when using `syncFormDataToContext` |

Different addresses from the backend are just different elements in the `addresses` array; the repeatable block will show one card/section per element.
