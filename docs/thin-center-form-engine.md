# Thin-Center Form Engine

This document is the **source of truth** for the form engine's performance-oriented architecture. Older docs that describe `formKey` remounts or per-keystroke Redux `formData` mirroring are obsolete—see the [migration notes](#migration-from-remount-centric-docs) at the end.

## Goals

- **RHF owns live values** — keystrokes stay in react-hook-form; Redux does not mirror every change.
- **Live Zod via `schemaRef`** — visibility and rule changes refresh validation without remounting the form.
- **Thin center** — `FormValuesWatcher` runs side effects only; presentation subscribes through `FormStatusProvider`, not a render-prop.
- **Popin sessions** — separate RHF instance mounted only while the dialog is open; `trigger()` before Validate/merge/POST.
- **Hide/show contract** — when `status.hidden` is true, fields are removed from values, schema, and errors; when shown again, values are restored and all rules run.

## State ownership

| Concern | Owner | Notes |
|--------|--------|-------|
| Field values | react-hook-form | Authoritative during editing |
| Validation errors | react-hook-form | Per-field via `useFieldError` |
| Descriptor / merged rules | Redux | Updated by rehydration |
| `caseContext` | Redux | Discriminant fields only sync from RHF |
| `formData` snapshot | Redux | **Discriminant changes only** — not every keystroke |
| Data-source cache | Redux | Fetched URLs + template context from caller |
| UI visibility/disabled | `FormStatusProvider` | One `useWatch` → status map |

## Main form flow

```
FormContainer
├── useFormDescriptor (mount defaults + live resolver)
├── FormValuesWatcher (discriminant + draft effects only)
├── FormStatusProvider (status map for blocks/fields)
├── PopinManagerProvider (dialog shell)
└── FormPresentation → Block → FieldWrapper → fields
```

### Discriminant rehydration

1. User edits a discriminant field.
2. `FormValuesWatcher` detects change via `haveDiscriminantFieldsChanged`.
3. Redux receives a **one-shot** `syncFormDataToContext` snapshot.
4. Debounced rules/documents POST updates `mergedDescriptor`.
5. `useLiveZodResolver.refreshSchemaFromDescriptor` updates `schemaRef` — **no remount**.

### Live schema / membership

`use-live-zod-resolver.ts`:

- **`schemaRef`** — Zod object rebuilt when the validation fingerprint changes.
- **`applyMembershipChanges`** — on hide: stash value, `unregister`, `clearErrors`; on show: `setValue` + `trigger`.
- **`useFormMembershipSync`** — `form.watch` drives membership; initial hidden defaults are stripped on first pass.

## Popin flow

`PopinManagerProvider` renders `PopinFormSession` only when the dialog is open.

1. `useFormDescriptor` with `validationScope: 'popin'`.
2. Live `popinFormContext` from main `useWatch` + popin values (no shadowing live popin keys).
3. **Validate**: `await popinForm.trigger()` → merge to main form or POST `popinSubmit`.
4. On successful `popinSubmit`: invalidate configured query keys **plus** default `['form', 'data-source']`.

## Render isolation (Phase D)

- **`FormStatusProvider`** — single watch builds block/field hidden/disabled map with referential stability.
- **`memo(Block)`**, **`memo(FieldWrapper)`** — skip re-render when status unchanged.
- **`useFieldError`** — per-field `useFormState` subscription instead of reading `form.formState.errors` on every field.
- **Repeatable groups** — `form.watch(groupId)` once per group, not per row.

## Key files

| File | Role |
|------|------|
| `src/components/form-container.tsx` | Narrow selectors, discriminant sync, no `formKey` |
| `src/hooks/use-form-descriptor.ts` | Mount defaults + wires live resolver |
| `src/hooks/use-live-zod-resolver.ts` | Schema clock + membership |
| `src/utils/schema-fingerprint.ts` | Active validation targets |
| `src/context/form-status-context.tsx` | UI status map |
| `src/components/form-values-watcher.tsx` | Effects only |
| `src/components/popin-form-session.tsx` | Popin RHF + validate |
| `src/utils/template-evaluator.ts` | Handlebars compile cache |

## Migration from remount-centric docs

The following documents described the old `formKey` / full-tree render-prop pattern. They should be read through this lens:

- `docs/form-dataflow.md` — overview still valid; ignore `formKey` and per-keystroke `formData` sections.
- `docs/architecture-redux-react-hook-form.md` — hybrid split still valid; remount is removed.
- `docs/form-initialization-data-flow.md` — init path unchanged; resolver is live after mount.
- `docs/handlebars-array-evaluation.md` — SSR `formKey` mismatch section is obsolete.
- `docs/integration-plan-react-redux-thunk.md` — data-source thunk accepts `templateContext` from caller.

## Success criteria

- Non-discriminant keystroke: no Redux `formData` dispatch, no remount, dependent status subscribers only.
- Discriminant change: values preserved; schema refreshes after rules merge.
- Hidden field: absent from `getValues()`, schema, and `formState.errors`.
- Shown field: present in values; all validation rules invoked.
