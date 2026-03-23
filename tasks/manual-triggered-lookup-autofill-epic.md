# Manual-Triggered Lookup Autofill Epic

**Status**: 📋 PLANNED  
**Goal**: Support a descriptor-driven source text field that performs manual lookup on button click, locks on success, enables a target field for user corrections with backend sync on blur, and clears/disables target when source is cleared.

## Overview

WHY users need a controlled lookup flow for sensitive identifiers where typing alone must not trigger network traffic, while successful lookup should lock the source value and enable downstream correction on a target field that synchronizes with backend on blur and resets safely when source is cleared.

---

## Descriptor Contract for Manual Lookup Fields

Define metadata for fields that trigger lookup requests only on explicit user action and map lookup responses into target fields.

**Requirements**:
- Given a text field configured for manual lookup, should not initiate network calls during ordinary typing.
- Given a field with manual lookup metadata, should describe the lookup endpoint and payload template using Handlebars expressions resolved from form values.
- Given a successful lookup response, should describe how response data is transformed through Handlebars templates into one or more target field values without conditional only-when-empty flags.
- Given a source-target lookup relationship, should describe target field lifecycle rules where target is disabled when empty and enabled after successful autofill.
- Given a lookup configuration without required template variables, should fail safely with clear field-level error semantics.

---

## Manual Lookup Execution and Source Field Locking

Implement the runtime behavior for the lookup action button, success/error states, and source field locking/clearing semantics.

**Requirements**:
- Given a user clicks the lookup action on a configured field, should execute exactly one request using the resolved Handlebars endpoint/payload.
- Given the lookup request succeeds, should mark the source field as locked/disabled and replace the lookup action affordance with a clear/reset affordance.
- Given the lookup request fails, should keep the source field editable and expose recoverable error state without losing user input.
- Given a user activates clear/reset after a prior successful lookup, should unlock the source field and clear any lookup-bound state according to descriptor rules.
- Given source clear/reset is triggered from the clear button after a successful lookup, should clear the mapped target field value and disable the target field.

---

## Target Field Autofill and Backend Sync on User Edits

Apply lookup-derived values to target fields and propagate subsequent manual edits of autofilled targets back to backend through templated requests.

**Requirements**:
- Given a successful lookup with mapped output, should populate configured target fields and enable those target fields for user edits.
- Given a user edits a field that was autofilled by lookup, should trigger an update request to backend on blur using Handlebars-templated endpoint/payload built from current form values.
- Given multiple edits on an autofilled target, should process updates deterministically so backend state reflects the latest accepted user input.
- Given backend update failure for an edited autofilled field, should preserve user-entered value locally and surface retryable error state.
- Given the source field is cleared after prior success, should clear the target value and disable the target until the next successful lookup.

---

## Integration and Regression Test Coverage

Add focused tests validating descriptor parsing, manual trigger behavior, lock/clear transitions, autofill application, and backend sync on target edits.

**Requirements**:
- Given a configured manual lookup field, should assert no network call occurs while typing and exactly one call occurs on explicit action.
- Given lookup success and reset flows, should assert source field lock/clear transitions plus target enable/disable transitions and target clear-on-source-clear behavior.
- Given user edits to autofilled targets, should assert update requests are produced from Handlebars templates with expected resolved values and are fired on blur.
- Given lookup/update failures, should assert error handling does not discard user input and supports recovery paths.
