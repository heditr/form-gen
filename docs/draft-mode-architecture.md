# Draft Mode Architecture

## Purpose

Draft mode adds descriptor-driven autosave for the **main form**. On each main-form value change, the engine can send a debounced HTTP draft request, but only when the relevant changed fields are valid.

This behavior is configured in the descriptor through `draft` and is independent from final submission (`submission`).

## Configuration Model

Draft mode is declared in `src/types/form-descriptor.ts`:

- `DraftConfig` extends `SubmissionConfig`
- `GlobalFormDescriptor.draft?: DraftConfig`
- `SubFormDescriptor.draft?: DraftConfig` (currently supported at type level)

`DraftConfig` fields:

- `url`
- `method`
- `payloadTemplate?`
- `headers?`
- `auth?`
- `debounceMs?` (default `1000`)

## Runtime Components

### 1) Change Detection Layer

File: `src/components/form-values-watcher.tsx`

`FormValuesWatcher` now exposes two callbacks:

- `onDiscriminantChange(formData)` for rehydration/context behavior
- `onFormChange(formData)` for generic form-wide side effects (draft mode uses this)

`useWatch` subscribes to form values and forwards updates through `onFormChange`.

### 2) Main Form Wiring

File: `src/components/form-container.tsx`

Main form flow initializes draft save like this:

- `useDraftSave({ form, draftConfig: mergedDescriptor?.draft })`
- Passes `saveDraft` into `FormValuesWatcher` as `onFormChange`

If `mergedDescriptor?.draft` is undefined, draft save is a no-op.

### 3) Draft Save Hook

File: `src/hooks/use-draft-save.ts`

`useDraftSave` implements draft-mode control logic:

1. Receive latest form values from `onFormChange`
2. Debounce saves (`draftConfig.debounceMs ?? 1000`)
3. Deduplicate identical payloads (`JSON.stringify` hash comparison)
4. Validate only dirty fields (`form.trigger(dirtyPaths)`) before HTTP call
5. If invalid: skip HTTP call
6. If valid: call `submitDraft(...)`

Important behavior:

- Draft mode skips initial load when the form is not dirty (`formState.isDirty === false`)
- Draft mode validates only dirty fields, avoiding untouched-field errors
- Draft mode does not override or force RHF error display policy
- Validation UI remains controlled by RHF mode (`onChange`, `onBlur`, etc.)
- Network calls happen only for valid snapshots
- If a debounced save is pending during unmount/remount, the hook flushes that pending save to avoid dropped draft requests

#### Remount/rehydration note

In flows where descriptor/rules changes can remount the form (for example discriminant changes such as `entityType` in demo pages), a pending debounced draft save could previously be lost.  
`useDraftSave` now flushes pending debounced work in cleanup, so entity-type transitions do not silently cancel draft API calls.

### 4) HTTP Execution

File: `src/utils/submission-orchestrator.ts`

`submitDraft` reuses the same request pipeline as submission:

- payload template evaluation
- JSON vs multipart selection
- request construction (`headers`, `auth`, method/body)
- success/error callback handling

This keeps draft and submit transport behavior aligned.

## Why Draft Mode Affects Main Form Only

Draft autosave is intentionally connected only to the main-form watcher path.

### Main form path (draft enabled)

- `FormContainer` creates main RHF form (`useFormDescriptor`)
- `FormValuesWatcher` observes that form
- `onFormChange -> saveDraft` drives autosave

### Popin path (draft not enabled)

File: `src/components/popin-manager.tsx`

Popins use a **separate** RHF instance (`popinForm`) managed inside `PopinManager`.

Key constraints that keep draft out of popins:

- Popin form values are local while dialog is open
- Popin changes are not wired to main-form `onFormChange`
- Popin side effects happen on explicit Validate/Submit actions, not every field change
- No `useDraftSave` wiring exists for `popinForm`

Result: typing in popin fields does not trigger draft autosave.

## End-to-End Flow

```mermaid
flowchart TD
  descriptor[DescriptorWithDraftConfig] --> formContainer[FormContainer]
  formContainer --> watcher[FormValuesWatcher]
  watcher -->|onFormChange(formData)| draftHook[useDraftSave]
  draftHook --> debounce[DebounceAndDedupe]
  debounce --> dirtyCheck{formState.isDirty?}
  dirtyCheck -->|no| skipDirty[Skip]
  dirtyCheck -->|yes| validate[form.trigger(dirtyPaths)]
  validate -->|invalid| skip[SkipDraftHttpCall]
  validate -->|valid| submitDraft[submitDraft]
  debounce --> unmount{UnmountWithPendingDebounce?}
  unmount -->|yes| flush[FlushPendingSave]
  flush --> validate
  submitDraft --> request[BuildRequestAndFetch]
```

## Demo Configuration

The demo descriptor route includes draft config:

- `src/app/api/form/global-descriptor-demo/route.ts`
  - `draft.url = '/api/form/draft'`
  - `draft.method = 'PUT'`
  - `draft.debounceMs = 1000`

Demo endpoint:

- `src/app/api/form/draft/route.ts`

## Testing Coverage

Draft mode is covered by:

- `src/hooks/use-draft-save.test.ts`
  - valid vs invalid behavior
  - debounce behavior
  - dedupe behavior
  - dirty-only validation targeting
  - unmount/remount pending-save flush
  - optional config no-op
- `src/utils/submission-orchestrator.test.ts`
  - `submitDraft` request and error handling
- `src/components/form-values-watcher.test.tsx`
  - `onFormChange` callback behavior

These tests ensure draft mode is reliable and does not regress existing submit/popin behavior.
