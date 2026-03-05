# Selection-Based Auto-Fill Epic

**Status**: 📋 PLANNED  
**Goal**: Enable descriptor-driven, type-safe auto-filling of related fields when a user selects an item from a data-sourced field, while respecting field visibility and disabled status.

## Overview

Currently, selecting an option in data-sourced fields (such as dropdowns or autocompletes) only updates that field’s value, even when the selected item represents a richer object (e.g., an existing entity with multiple attributes). To reduce repetitive data entry and ensure consistency, we need a generic, descriptor-driven way to map properties from the selected object into other fields in the same block (or related blocks), integrated with the existing form-descriptor engine, while preserving state, respecting hidden/disabled field status, and maintaining backend authority and re-hydration semantics.

---

## Descriptor-Driven Auto-Fill Mapping

Design how form descriptors express “when field X selection has object payload P, map P’s properties into fields Y/Z/etc.” in a generic, reusable way.

**Requirements**:
- Given a form descriptor with a data-sourced selection field and a list of target fields, should express, in metadata only, which properties of the selected object populate which target fields.
- Given a valid selection value that includes additional structured data, should compute a pure mapping from selection payload to a form value patch without mutating unrelated values.
- Given a selection is cleared or changed to another option, should recompute the mapping so that target fields reflect the new selection and no longer depend on the old one.
- Given target fields are marked as hidden or disabled by the merged descriptor, should honor that status when applying auto-fill mappings according to a clear rule (e.g., skip writing to hidden/disabled fields by default, or allow explicit override via descriptor configuration).

---

## Integration with Form Engine & React Hook Form

Wire the auto-fill mapping into the existing form-descriptor integration so it plays nicely with validation, re-hydration, and state preservation.

**Requirements**:
- Given a user selects an item in a configured selection field, should update only the mapped fields through the form engine (e.g., via react-hook-form APIs), preserving user-entered values in unrelated fields.
- Given backend re-hydration runs after discriminant/context changes, should not silently override user-edited values that diverged from the originally auto-filled values unless the backend explicitly dictates different values.
- Given validation errors arise on auto-filled fields, should surface them like any other field errors without requiring special-case handling in the UI.
- Given a field is disabled or hidden at the time of selection, should ensure that auto-fill behavior is consistent with field status (e.g., do not unexpectedly enable or reveal fields solely because of auto-fill unless the descriptor or backend rules explicitly change that status).

---

## UX, Conflict Handling, and Field Status

Define expected behavior when auto-fill conflicts with existing user input, partial data, or field status (hidden/disabled).

**Requirements**:
- Given a user manually edits an auto-filled field after selection, should treat the user’s change as the source of truth on the client until/unless backend re-hydration overrides it.
- Given a user changes selection after manually editing auto-filled fields, should either re-apply the mapping and overwrite those fields or preserve manual edits, based on a clear, documented rule configurable in the descriptor.
- Given a user navigates between blocks or jurisdictions, should avoid surprising resets of auto-filled data unless driven by descriptor rule changes from the backend.
- Given a field is hidden due to rules or context, should not surface its value changes in the UI in a way that confuses the user, while still allowing backend-authoritative data to be stored if configured.
- Given a field is disabled, should avoid prompting the user to interact with it as a result of auto-fill and ensure that disabled state remains consistent before and after auto-fill operations.

---

## Testing & TDD Coverage

Add tests around the form-descriptor integration to validate auto-fill behavior end-to-end before implementing.

**Requirements**:
- Given a descriptor defining a selection field with auto-fill mappings and a mock data source, should assert that selecting a specific item populates the expected fields in the form state.
- Given selection change and clear scenarios, should assert that mapped fields update or clear according to the configured rules while other fields remain unchanged.
- Given common edge cases (missing property in payload, null/undefined selection, partial data from backend), should handle them gracefully without runtime errors.
- Given fields with hidden or disabled status in the descriptor, should verify that auto-fill behavior respects these statuses according to the configured rules (e.g., skip updates by default vs. explicitly allowed).

