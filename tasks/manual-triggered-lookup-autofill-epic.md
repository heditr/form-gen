# Manual-Triggered Lookup Autofill Epic

**Status**: 📋 PLANNED  
**Goal**: Support a descriptor-driven text field that performs a manual lookup on button click, locks the source field on success, auto-fills a target field via Handlebars mapping, and syncs target edits back to backend.

## Overview

WHY users need a controlled lookup flow for sensitive identifiers where typing alone must not trigger network traffic, while successful lookup should reliably prefill related data and keep backend systems synchronized when that data is later corrected by the user.

---

## Descriptor Contract for Manual Lookup Fields

Define metadata for fields that trigger lookup requests only on explicit user action and map lookup responses into target fields.

**Requirements**:
- Given a text field configured for manual lookup, should not initiate network calls during ordinary typing.
- Given a field with manual lookup metadata, should describe the lookup endpoint and payload template using Handlebars expressions resolved from form values.
- Given a successful lookup response, should describe how response data is transformed through Handlebars templates into one or more target field values.
- Given a lookup configuration without required template variables, should fail safely with clear field-level error semantics.

---

## Manual Lookup Execution and Source Field Locking

Implement the runtime behavior for the lookup action button, success/error states, and source field locking/clearing semantics.

**Requirements**:
- Given a user clicks the lookup action on a configured field, should execute exactly one request using the resolved Handlebars endpoint/payload.
- Given the lookup request succeeds, should mark the source field as locked/disabled and replace the lookup action affordance with a clear/reset affordance.
- Given the lookup request fails, should keep the source field editable and expose recoverable error state without losing user input.
- Given a user activates clear/reset after a prior successful lookup, should unlock the source field and clear any lookup-bound state according to descriptor rules.

---

## Target Field Autofill and Backend Sync on User Edits

Apply lookup-derived values to target fields and propagate subsequent manual edits of autofilled targets back to backend through templated requests.

**Requirements**:
- Given a successful lookup with mapped output, should populate configured target fields that were previously empty according to descriptor policy.
- Given a user edits a field that was autofilled by lookup, should trigger an update request to backend using Handlebars-templated endpoint/payload built from current form values.
- Given multiple edits on an autofilled target, should process updates deterministically so backend state reflects the latest accepted user input.
- Given backend update failure for an edited autofilled field, should preserve user-entered value locally and surface retryable error state.

---

## Integration and Regression Test Coverage

Add focused tests validating descriptor parsing, manual trigger behavior, lock/clear transitions, autofill application, and backend sync on target edits.

**Requirements**:
- Given a configured manual lookup field, should assert no network call occurs while typing and exactly one call occurs on explicit action.
- Given lookup success and reset flows, should assert source field lock/clear transitions and target autofill behavior remain consistent.
- Given user edits to autofilled targets, should assert update requests are produced from Handlebars templates with expected resolved values.
- Given lookup/update failures, should assert error handling does not discard user input and supports recovery paths.
