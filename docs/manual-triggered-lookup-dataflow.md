# Manual-Triggered Lookup Dataflow

This document describes the architecture and runtime flow for the manual-triggered lookup feature implemented on text fields.

## Goal

Enable a source text field to perform lookup only on explicit button click, lock after successful resolution (including configured resilient backend errors), auto-fill target fields, and sync target edits back to backend on blur.

## Descriptor Model

The feature is descriptor-driven through `FieldDescriptor` extensions:

- `manualLookup`
  - `request`: URL/method/payload template
  - `autoFillTargets`: mapping from lookup result template to target field ids
  - `resilientErrors`: backend error signatures treated as successful lookup outcomes
  - `prefillOnMount`: optional auto-lookup when source is prefilled on initial render
- `autoFilledUpdate`
  - URL/method/payload template used when target field is blurred after edit

## Runtime Components

Primary runtime is in `src/components/text-field.tsx`:

- Source field logic:
  - Lookup trigger button (loop icon)
  - Clear button after lock
  - Local lock/error state
- Target lifecycle logic:
  - Uses form-level unlock flag `__lookupUnlocked.<targetFieldId>`
  - Empty target is disabled unless unlocked
  - Blur dispatches update request through `autoFilledUpdate`

## Source Field Flow

1. User types in source field (no request fired).
2. User clicks lookup button.
3. Request URL/payload is resolved via Handlebars against current form values.
4. Response handling:
   - `2xx`: treated as success; source locks; targets are auto-filled.
   - Non-`2xx` matching `resilientErrors`: treated as success; source locks; targets are unlocked and may stay empty.
   - Other errors: show lookup error; source remains editable.
5. Clear button:
   - Clears source and mapped targets.
   - Resets target unlock flags to `false`.
   - Unlocks source for manual typing.

## Prefilled Source Flow

For backend-prefilled source scenarios:

1. Static source default is seeded if current source value is empty.
2. If `prefillOnMount` is enabled and source has value, lookup runs automatically once.
3. Source enters locked state and targets are auto-filled/unlocked.
4. If user clears source, default is not re-seeded in the same interaction cycle.

## Target Field Flow

1. Target field is disabled when empty and not unlocked.
2. Target becomes unlocked through source lookup success/resilient-success.
3. User edits target.
4. On blur, update request is sent using templated URL + payload.
5. On update failure, value is preserved and retryable error is displayed.

## Form-State Contract

The feature uses hidden internal form-state keys:

- `__lookupUnlocked.<targetFieldId>`: boolean
  - `true`: target can stay enabled even if empty (resilient/manual correction path)
  - `false`: empty target is disabled

These keys are implementation details and not intended for descriptor authors.

## Demo Coverage

`src/app/api/form/global-descriptor-demo/route.ts` includes two demo flows:

- Manual lookup pair (`registrationNumberLookup` -> `companyNameLookup`)
- Prefilled + mount-lookup pair (`registrationNumberLookupPrefilled` -> `companyNameLookupPrefilled`)

Demo API endpoints:

- `GET /api/demo/company-lookup`
- `PATCH /api/demo/company-update/[registration]`

## Testing

Focused behavioral tests live in `src/components/text-field.test.tsx` and cover:

- click-only lookup triggering
- lock/clear transitions
- resilient error as success
- target empty/enable behavior via unlock flags
- prefill-on-mount lookup
- no default-value reseed after user clear
- blur-triggered target update calls
