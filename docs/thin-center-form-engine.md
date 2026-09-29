# Thin-Center Form Engine

This document is the **source of truth** for the form engine's performance-oriented architecture. It shows how data moves at runtime between files, from the first descriptor load through typing, hide/show, rehydration, and popins.

Older docs that describe `formKey` remounts or per-keystroke Redux `formData` mirroring are obsolete—see the [migration notes](#migration-from-remount-centric-docs) at the end. Hook internals live in [use-form-descriptor.md](./use-form-descriptor.md).

## Goals

- **RHF owns live values** — keystrokes stay in react-hook-form; Redux does not mirror every change.
- **Live Zod via `schemaRef`** — visibility and rule changes refresh validation without remounting the form.
- **Thin center** — `FormValuesWatcher` runs side effects only; presentation subscribes through `FormStatusProvider`, not a render-prop.
- **Popin sessions** — separate RHF instance mounted only while the dialog is open; `trigger()` before Validate/merge/POST.
- **Hide/show contract** — when `status.hidden` is true, fields are removed from values, schema, and errors; when shown again, the stashed or default value is restored. Rules sit in the schema and run on the next edit or an explicit submit.

## State ownership

| Concern | Owner | Notes |
|--------|--------|-------|
| Field values | react-hook-form | Authoritative during editing |
| Validation errors | react-hook-form | Per-field via `useFieldError` |
| Descriptor / merged rules | Redux | Updated by rehydration |
| `caseContext` | Redux | Discriminant fields only sync from RHF |
| `formData` snapshot | Redux | **Discriminant changes only** — not every keystroke |
| Data-source cache | Redux | Fetched URLs + template context from caller |
| UI visibility/disabled | `FormStatusProvider` | One deferred watch → status map |

`savedFormData` (the Redux `formData` snapshot) is read **once**, when `useForm` is created. Later snapshot updates do not reset the live form, because the form is not remounted.

## File roles

Read this table first. The diagrams below use these file names as the nodes.

| File | Role in the circulation |
|------|-------------------------|
| `src/app/page.tsx` | Mounts the page and calls `useGlobalDescriptor()` |
| `src/hooks/use-form-query.ts` | Fetches the global descriptor and dispatches it into Redux |
| `src/store/form-dux.ts` | Holds `mergedDescriptor`, `caseContext`, the discriminant `formData` snapshot, and `dataSourceCache` |
| `src/components/form-container.tsx` | Selects Redux state, creates the main form, and owns the discriminant callback |
| `src/hooks/use-form-descriptor.ts` | Builds mount defaults and the RHF instance. Does **not** talk to Redux |
| `src/utils/form-descriptor-integration.ts` | `extractDefaultValues` at mount; `buildZodSchemaFromDescriptor` whenever the schema is rebuilt |
| `src/hooks/use-live-zod-resolver.ts` | `schemaRef` clock, `applyMembershipChanges` (hide/show of **values**), `useFormMembershipSync` |
| `src/utils/schema-fingerprint.ts` | Which fields are validation targets, and the diff between the previous and next set. Walkthrough: [schema-fingerprint.md](./schema-fingerprint.md) |
| `src/utils/template-evaluator.ts` | Handlebars for defaults, hidden/disabled/readonly, and URLs |
| `src/hooks/use-deferred-form-values.ts` | `form.watch` deferred to a microtask, so subscribers do not update during `Controller` render |
| `src/components/form-values-watcher.tsx` | Effects only (renders `null`): draft on every change; discriminant callback only when a discriminant field changed |
| `src/hooks/use-draft-save.ts` | Debounced, dirty-field draft POST. `flushDraftSave` runs before rehydration |
| `src/context/form-status-context.tsx` | One status map (`hidden` / `disabled` / `readonly`) for blocks and fields. Does **not** change values |
| `src/components/form-presentation.tsx` | Reads block status from the map and renders `Block` |
| `src/components/block.tsx` | Reads field status (`statusMode="context"` on the main form) and renders fields |
| `src/components/field-wrapper.tsx` | Skips hidden fields; delegates to the typed field component |
| `src/hooks/use-field-error.ts` | One `useFormState` subscription per field |
| `src/hooks/use-debounced-rehydration.ts` | Writes `caseContext`, then POSTs rules after 500ms |
| `src/hooks/use-debounced-documents-rehydration.ts` | Same discriminant trigger, documents endpoint |
| `src/components/popin-manager.tsx` | Dialog shell. Mounts a popin session only while open |
| `src/components/popin-form-session.tsx` | Second RHF instance. Validate merges into the main form or POSTs `popinSubmit` |
| `src/utils/popin-form-context.ts` | Seeds a repeatable row and builds the popin Handlebars context |

Two different subscribers both hear value changes. They do different jobs:

- **`form-status-context.tsx`** decides what is painted.
- **`useFormMembershipSync`** decides what stays inside react-hook-form (values, schema, errors).

## Architecture overview

Data enters through Redux, becomes a react-hook-form instance inside `useFormDescriptor`, then fans out. The slow loop (rules) is the only path back into Redux `formData`.

```mermaid
flowchart TB
  subgraph load ["Load"]
    page["page.tsx"]
    query["use-form-query.ts"]
    redux["form-dux.ts"]
  end

  subgraph mount ["Mount — once"]
    container["form-container.tsx"]
    hook["use-form-descriptor.ts"]
    defaults["form-descriptor-integration.ts"]
    live["use-live-zod-resolver.ts"]
    finger["schema-fingerprint.ts"]
    rhf["react-hook-form"]
  end

  subgraph everyChange ["Every value change"]
    deferred["use-deferred-form-values.ts"]
    watcher["form-values-watcher.tsx"]
    status["form-status-context.tsx"]
    membership["useFormMembershipSync"]
  end

  subgraph paint ["Paint"]
    presentation["form-presentation.tsx"]
    block["block.tsx"]
    field["field-wrapper.tsx + Controller"]
    err["use-field-error.ts"]
    templates["template-evaluator.ts"]
  end

  subgraph slow ["Slow loop — discriminant only"]
    draft["use-draft-save.ts"]
    rehydrate["use-debounced-rehydration.ts"]
  end

  page --> query
  query -->|"descriptor"| redux
  redux -->|"mergedDescriptor, caseContext, formData snapshot"| container
  container --> hook
  hook --> defaults
  defaults -->|"defaultValues"| hook
  hook --> live
  live --> finger
  live -->|"resolver + schemaRef"| rhf
  hook -->|"useForm"| rhf

  rhf -->|"watch"| deferred
  rhf -->|"watch"| membership
  membership -->|"unregister / setValue"| rhf
  deferred --> watcher
  deferred --> status
  status --> templates
  status -->|"status map"| presentation
  presentation --> block
  block --> field
  field -->|"keystroke"| rhf
  rhf -->|"field error"| err
  err --> field

  watcher -->|"every change"| draft
  watcher -->|"discriminant fields only"| container
  container -->|"flush draft, then snapshot + context"| rehydrate
  rehydrate -->|"mergedDescriptor"| redux
```

## Scenario: initialization

The form exists only after Redux has a descriptor. `useFormDescriptor` turns that descriptor into defaults and a live resolver. Membership then strips fields that are already hidden. The watcher records a baseline and does not treat it as a user edit.

```mermaid
sequenceDiagram
  participant Page as page.tsx
  participant Query as use-form-query.ts
  participant Redux as form-dux.ts
  participant Container as form-container.tsx
  participant Hook as use-form-descriptor.ts
  participant Defaults as form-descriptor-integration.ts
  participant Live as use-live-zod-resolver.ts
  participant RHF as react-hook-form
  participant Member as useFormMembershipSync
  participant Watcher as form-values-watcher.tsx
  participant Status as form-status-context.tsx

  Page->>Query: useGlobalDescriptor()
  Query->>Query: GET /api/form/global-descriptor
  Query->>Redux: loadGlobalDescriptor
  Note over Redux: globalDescriptor = mergedDescriptor<br/>formData = {} · caseContext = {}

  Redux->>Container: selectors
  Container->>Hook: descriptor, savedFormData, caseContext
  Hook->>Hook: initFormContext for template defaults only
  Hook->>Defaults: extractDefaultValues(scope main)
  Defaults-->>Hook: defaultValues
  Hook->>Hook: merge savedFormData over defaults
  Hook->>Live: descriptor, caseContext, defaults
  Live-->>Hook: resolver, applyMembershipChanges, refreshSchema
  Hook->>RHF: useForm(defaultValues, resolver, mode onChange)
  Hook->>Member: subscribe

  Member->>RHF: getValues
  Member->>Member: applyMembershipChanges
  Note over Member: First pass hides already-hidden fields.<br/>Does not validate visible fields.

  RHF-->>Watcher: deferred values
  Note over Watcher: previousValues is null → store baseline<br/>onFormChange only, no discriminant

  RHF-->>Status: deferred values
  Status->>Status: evaluate hidden / disabled / readonly
  Status-->>Container: children paint from the status map
```

What each file contributes on this pass:

- **`use-form-query.ts`** is the only network call. Redux is empty until it returns.
- **`form-container.tsx`** passes the snapshot in as `savedFormData`. It does not create the form itself.
- **`use-form-descriptor.ts`** merges defaults and saved values, then calls `useForm` once.
- **`use-live-zod-resolver.ts`** holds `schemaRef`. The schema is rebuilt later in place; the `useForm` instance stays.
- **`useFormMembershipSync`** runs an immediate membership pass so hidden defaults never sit in `getValues()`.
- **`form-values-watcher.tsx`** stores the first values and stops. That observation is not a discriminant change.
- **`form-status-context.tsx`** builds the first status map from those same values plus `caseContext`.

## Scenario: ordinary keystroke

A non-discriminant edit stays in react-hook-form. Three listeners hear it. Redux `formData` is not one of them.

```mermaid
flowchart LR
  user["User types"]
  field["field-wrapper.tsx<br/>Controller"]
  rhf["react-hook-form<br/>values + onChange validate"]
  resolver["use-live-zod-resolver.ts<br/>resolver"]
  finger["schema-fingerprint.ts"]
  schema["form-descriptor-integration.ts<br/>buildZodSchemaFromDescriptor"]
  err["use-field-error.ts"]
  member["useFormMembershipSync<br/>applyMembershipChanges"]
  deferred["use-deferred-form-values.ts"]
  watcher["form-values-watcher.tsx"]
  draft["use-draft-save.ts"]
  status["form-status-context.tsx"]
  ui["form-presentation.tsx<br/>block.tsx"]
  redux["form-dux.ts formData"]

  user --> field --> rhf
  rhf --> resolver
  resolver --> finger
  finger -->|"fingerprint changed"| schema
  finger -->|"unchanged"| resolver
  schema --> resolver
  rhf --> err --> field

  rhf --> member
  member -->|"targets unchanged: return"| member

  rhf --> deferred
  deferred --> watcher
  watcher -->|"not a discriminant"| draft
  deferred --> status
  status -->|"status bits unchanged:<br/>memo Block / FieldWrapper skip"| ui

  watcher -.->|"no dispatch"| redux
```

- **`use-field-error.ts`** re-renders only the field whose error changed.
- **`useFormMembershipSync`** compares validation targets. If the set is the same, it does nothing.
- **`form-values-watcher.tsx`** calls `onFormChange` → **`use-draft-save.ts`**. Draft save is debounced and skipped when the form is not dirty.
- **`form-status-context.tsx`** rebuilds the status map. Unchanged `hidden` / `disabled` / `readonly` objects are reused, so memoized blocks and fields skip render.
- **`form-dux.ts`** `formData` is untouched.

## Scenario: hide and show

Visibility is two channels that both read the new values. Neither channel calls the other.

```mermaid
flowchart TB
  rhf["react-hook-form values"]
  templates["template-evaluator.ts"]

  subgraph uiChannel ["UI channel — what is painted"]
    deferred["use-deferred-form-values.ts"]
    status["form-status-context.tsx"]
    presentation["form-presentation.tsx"]
    block["block.tsx"]
    wrapper["field-wrapper.tsx"]
  end

  subgraph valueChannel ["Value channel — what the form contains"]
    sync["useFormMembershipSync"]
    apply["applyMembershipChanges"]
    finger["schema-fingerprint.ts<br/>diffValidationTargets"]
    stash["hiddenValueStashRef"]
  end

  rhf --> deferred --> status
  status --> templates
  status --> presentation --> block --> wrapper
  wrapper -->|"hidden: render null"| wrapper

  rhf --> sync --> apply
  apply --> finger
  apply --> templates
  finger -->|"hide"| stash
  stash -->|"unregister + clearErrors"| rhf
  finger -->|"show"| stash
  stash -->|"setValue from stash, else default"| rhf
```

Hide:

1. **`schema-fingerprint.ts`** marks the field absent from the next validation targets and present in status-hidden ids.
2. **`applyMembershipChanges`** stashes `getValues(fieldId)`, then `unregister` (drop the value) and `clearErrors`.
3. **`field-wrapper.tsx`** returns `null` because the status map says `hidden`.

Show:

1. The diff says the field is newly visible. The first pass at mount does **not** treat every visible field as newly shown.
2. **`applyMembershipChanges`** writes the stash, otherwise `defaultValuesByFieldId`, otherwise `''`.
3. It does not `trigger()` on show. Validation runs on the next user edit or an explicit submit.
4. The status map flips `hidden` to false, so the field mounts again and its `Controller` binds the restored value.

`refreshSchemaFromDescriptor` rebuilds `schemaRef` when the descriptor identity changes. The resolver also rebuilds `schemaRef` on the next validation if the fingerprint changed. Both paths keep the same `useForm` instance.

## Scenario: discriminant change

A discriminant field (country, process type, and anything flagged `isDiscriminant`) is the only edit that writes the Redux snapshot and asks the backend for new rules. Values already in react-hook-form stay there.

```mermaid
sequenceDiagram
  participant Field as field Controller
  participant RHF as react-hook-form
  participant Watcher as form-values-watcher.tsx
  participant Draft as use-draft-save.ts
  participant Container as form-container.tsx
  participant Extract as context-extractor.ts
  participant Redux as form-dux.ts
  participant Rules as use-debounced-rehydration.ts
  participant Docs as use-debounced-documents-rehydration.ts
  participant Hook as use-form-descriptor.ts
  participant Live as use-live-zod-resolver.ts

  Field->>RHF: set value
  RHF-->>Watcher: deferred values
  Note over Watcher: haveDiscriminantFieldsChanged<br/>wait until the next macrotask

  Watcher->>Draft: onFormChange
  Watcher->>Container: onDiscriminantChange(values)

  Container->>Draft: flushDraftSave
  Container->>Redux: syncFormDataToContext
  Container->>Extract: updateCaseContext
  Extract-->>Container: next caseContext
  Container->>Rules: rehydrate
  Container->>Docs: rehydrate

  Rules->>Redux: updateCaseContextValues immediately
  Note over Rules: 500ms debounce, then POST /api/rules/context
  Rules->>Redux: applyRulesUpdate → mergedDescriptor
  Docs->>Redux: documents merged into descriptor

  Redux-->>Hook: new mergedDescriptor prop
  Note over Hook: same useForm instance<br/>savedFormData is not reapplied
  Hook->>Live: refreshSchemaFromDescriptor
  Live->>Live: rebuild schemaRef from new targets
  Note over RHF: values unchanged
```

- **`form-values-watcher.tsx`** compares the previous and current values with `haveDiscriminantFieldsChanged`. Draft notification runs before the discriminant callback, in the same turn.
- **`form-container.tsx`** `handleDiscriminantChange` flushes the draft, writes the snapshot, derives context, then calls both rehydrate hooks.
- **`use-debounced-rehydration.ts`** updates `caseContext` in Redux immediately and POSTs rules after 500ms. A newer discriminant change cancels the pending POST.
- **`use-form-descriptor.ts`** receives the new descriptor as an argument. It does not call `useForm` again.
- **`useFormMembershipSync`** sees the new descriptor and calls `refreshSchemaFromDescriptor`.

## Scenario: popin

The dialog mounts a second form. The main form keeps running underneath. Closing the dialog unmounts the session.

```mermaid
sequenceDiagram
  participant UI as block.tsx / button
  participant Manager as popin-manager.tsx
  participant Ctx as popin-form-context.ts
  participant Session as popin-form-session.tsx
  participant Hook as use-form-descriptor.ts
  participant Popin as popin react-hook-form
  participant Main as main react-hook-form

  UI->>Manager: openPopin(blockId, groupId?, index?)
  Manager->>Manager: resolve block, build popin descriptor
  Manager->>Manager: popinLoad fetch when configured
  Manager->>Session: mount while dialog is open

  Session->>Main: useWatch + getValues
  Session->>Ctx: getRepeatablePopinInstanceValues
  Ctx-->>Session: row clone, or nothing in create mode
  Session->>Hook: validationScope popin, formData, savedFormData, statusValues
  Note over Hook: statusValues = live main values<br/>so a main-form checkbox can hide a popin field
  Hook->>Popin: second useForm + membership

  Session->>Ctx: buildPopinFormContext
  Ctx-->>Session: main values under popin values
  Note over Session: popin keys win, so address.country<br/>does not read the main country

  Session->>Session: Block statusMode local
  Note over Session: popin status uses popinFormContext,<br/>not the main status map

  UI->>Session: Validate
  Session->>Popin: trigger()
  alt repeatable row
    Session->>Popin: omit hidden values
    Session->>Main: setValue(groupId, nextArray)
  else popinSubmit
    Session->>Session: POST payload from main + popin values
    Session->>Manager: invalidate query keys
  end
  Session->>Manager: onClose unmounts the session
```

- **`popin-manager.tsx`** owns open/close and the load request. It does not own field values.
- **`popin-form-session.tsx`** calls the same **`use-form-descriptor.ts`** with `validationScope: 'popin'`, so only popin blocks enter defaults and the Zod schema.
- **`statusValues`** is the live main-form watch. Membership on the popin form can hide a popin field because of a checkbox that lives on the main form.
- **`popin-form-context.ts`** overlays popin values on top of main values for templates inside the dialog.
- Validate always `trigger()`s the popin form first. A repeatable row is written back with `mainForm.setValue`. A `popinSubmit` block POSTs, then invalidates its query keys and the default `['form', 'data-source']` key.

## Scenario: data-source options

Dropdowns and autocompletes ask the container to load options. The field does not fetch by itself. The cache lives in Redux so a second field with the same URL can reuse it.

```mermaid
flowchart LR
  field["dropdown / autocomplete field"]
  container["form-container.tsx<br/>loadDataSource"]
  thunk["form-thunks.ts<br/>fetchDataSourceThunk"]
  loader["data-source-loader.ts<br/>template-evaluator.ts"]
  redux["form-dux.ts<br/>dataSourceCache"]
  field2["field re-renders options"]

  field -->|"fieldPath + url"| container
  container --> thunk
  thunk --> loader
  loader -->|"evaluated URL, items"| redux
  redux --> field2
```

## Render isolation

These pieces keep a keystroke from re-rendering the whole tree:

- **`form-status-context.tsx`** — one deferred watch builds the block/field map and reuses status objects when the bits are unchanged.
- **`memo(Block)`**, **`memo(FieldWrapper)`** — skip re-render when status is unchanged.
- **`use-field-error.ts`** — per-field `useFormState`, instead of every field reading `form.formState.errors`.
- **Repeatable groups** — `form.watch(groupId)` once per group, not per row.
- **`use-deferred-form-values.ts`** — `FormValuesWatcher` and `FormStatusProvider` each subscribe here, so their `setState` runs after `Controller` render.

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
- Shown field: present in values; its rules are in the schema and run on the next edit or submit.
