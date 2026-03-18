## Goal

Allow `FieldDescriptor.validation` (validation rules array) and `FieldDescriptor.items` (static option arrays for `dropdown` / `autocomplete` / `radio`) to be **expressible as Handlebars templates** so the descriptor can dynamically add/remove rules or items based on context.

This should preserve backwards compatibility with existing descriptors where `validation` and `items` are plain arrays.

---

## Proposed descriptor shape changes

### `FieldDescriptor.items`

Current:
- `items?: FieldItem[]`

Proposed:
- `items?: FieldItem[] | string`

Where the `string` is a Handlebars template that **evaluates to JSON** for a `FieldItem[]`.

Example (template returns a JSON array):

```txt
{{#if (eq caseContext.country "US")}}
  [{"label":"SSN","value":"ssn"},{"label":"EIN","value":"ein"}]
{{else}}
  [{"label":"National ID","value":"nid"}]
{{/if}}
```

Practical tip: for non-trivial arrays, prefer building the array as real data and using the `json` helper:

```txt
{{json caseContext.relationshipItems "[]"}}
```

### `FieldDescriptor.validation`

Current:
- `validation: ValidationRule[]`

Proposed:
- `validation: ValidationRule[] | string`

Where the `string` is a Handlebars template that **evaluates to JSON** for a `ValidationRule[]`.

Example (template returns a JSON array of rules):

```txt
[
  {"type":"required","message":"Required"},
  {{#if (eq caseContext.country "US")}}
    {"type":"pattern","value":"^\\d{3}-\\d{2}-\\d{4}$","message":"Invalid SSN"}
  {{else}}
    {"type":"minLength","value":6,"message":"Too short"}
  {{/if}}
]
```

Notes:
- `pattern.value` should be serialized as a **string**, not a `RegExp`, to keep templates JSON-serializable.
- This aligns with existing typing that already allows `RegExp | string` but keeps templates practical.

---

## Authoring guidelines (what works best)

- **Return a JSON array string**: templates must output a JSON array, e.g. `[...]`.
- **Use the `json` helper when possible**: it avoids quoting/escaping mistakes and preserves quotes.
- **Keep rules serializable**:
  - `required`: `{ "type": "required", "message": "..." }`
  - `minLength/maxLength`: `value` must be a number
  - `pattern`: `value` must be a string (regex source), not `/.../` or `RegExp`
- **On evaluation failure**: the engine falls back to `[]` (no items / no validations), so ensure the template can’t accidentally output non-JSON for common states.

---

## Where evaluation happens (design)

### New utility: “Handlebars JSON evaluator”

Add a small utility that:
- Detects whether a value is a template string (contains `{{`), otherwise treats it as plain JSON text only if explicitly requested.
- Evaluates with `evaluateTemplate(template, context)`.
- Trims output; if empty, returns a safe fallback (`[]` for arrays).
- Parses JSON (for `items` and `validation` templates).
- Validates/coerces shape lightly:
  - `items`: array of `{ label, value, raw? }`
  - `validation`: array of supported rules, with `pattern.value` treated as string (or converted from `/.../` style if we choose to support it later).

### Integrations

We want evaluation to occur in **one place** before:
- Option items are rendered in selection fields
- Validation rules are converted into react-hook-form rules and/or Zod schema

Proposed integration points:
- **Selection items**: normalize `FieldDescriptor.items` into `FieldItem[]` inside `FieldWrapper` (or the individual field components) using `formContext`.
- **Validation rules**: normalize `FieldDescriptor.validation` into `ValidationRule[]` *before* schema construction so both RHF and Zod see the same evaluated rules.

This keeps the rest of the engine working with a canonical shape (`FieldItem[]` and `ValidationRule[]`) after normalization.

---

## Hydration / SSR impact (especially `validation`)

### Why `validation` is hydration-sensitive here

`src/components/form-container.tsx` derives a React `key` (`formKey`) from:
- `mergedDescriptor.blocks[].fields[].validation` (types + values)
- `JSON.stringify(caseContext)`

That `key` forces `FormInner` to remount so the Zod resolver is re-created when validation changes.

If we make `field.validation` a **template string** that is evaluated:
- During SSR with one context (or with missing Handlebars helpers), but
- During client hydration with a different context (or helpers registered),

then:
- The computed `formKey` can differ between SSR and the client’s first render
- React may log hydration mismatch warnings, and the form could remount unexpectedly on load

### Current helper registration increases this risk

Handlebars helpers are registered in `src/components/providers.tsx` inside a `useEffect`.
- `useEffect` does not run during SSR.
- Any SSR-time Handlebars evaluation that relies on helpers (e.g. `eq`, `and`, `json`) may produce different output than the client.

### Mitigations (proposed)

We will keep initial render deterministic by ensuring **the evaluated `validation` array is stable at hydration time**:

- **Mitigation A (preferred)**: Evaluate `validation` templates using a context that is stable across SSR + client hydration:
  - Use `caseContext` (and optionally “discriminant-only” `formData`) for template evaluation.
  - Avoid evaluating validation from rapidly-changing `formData` fields (typing) because it would churn `formKey`.

- **Mitigation B**: Make helper registration SSR-safe for templates that must run during SSR:
  - Register helpers at module initialization time in a shared place, or otherwise ensure helpers are available during SSR renders that evaluate templates.
  - (This requires care: `providers.tsx` is a client module; we’ll likely move helper registration into a non-React module imported by both server and client execution paths.)

- **Mitigation C**: Compute `formKey` from *raw templates* rather than evaluated arrays (only if needed):
  - This avoids SSR/client mismatch but means validation changes driven by template evaluation would not remount the form automatically.
  - Likely acceptable only if validation templates are intended to depend primarily on `caseContext` changes (rehydration), not on arbitrary `formData`.

The implementation will pick A + B (if needed) to keep correctness and predictable remounting.

---

## Test plan (high-signal)

- `items` template:
  - Given a field with `items` as a template string, should evaluate to a `FieldItem[]` based on `caseContext`.
  - Given an invalid JSON output, should fall back to `[]` and not crash rendering.

- `validation` template:
  - Given a field with `validation` as a template string, should evaluate to `ValidationRule[]` and feed schema/rhf validation correctly.
  - Given `pattern.value` returned as string, should be handled consistently (no `RegExp` required).
  - Given SSR + hydration, should not produce mismatched `formKey` for the initial render (covered by ensuring helper availability and stable context usage).

