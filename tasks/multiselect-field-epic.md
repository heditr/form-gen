# Multiselect Field Epic

**Status**: 📋 PLANNED  
**Goal**: Add a `multiselect` field type that lets users pick multiple values from a list, fully integrated with the descriptor-driven form engine.

## Overview

KYC forms frequently require selecting multiple values — onboarding countries, applicable document types, industry sectors — but the engine only supports single-select `dropdown` today. This epic adds a `multiselect` field type end-to-end: type system, Zod schema, a polished popover-based component with chips + search, and a live demo. No existing field types are broken.

---

## Task A: Extend types and Zod schema

Add `'multiselect'` to the descriptor type system and Zod validation pipeline.

**Requirements**:
- Given `FieldType`, should include `'multiselect'` as a valid value
- Given `FieldDefaultValue<'multiselect'>`, should resolve to `string[]`
- Given `FieldValueType` for a multiselect field, should resolve to `string[]`
- Given `convertToZodSchema` called with `fieldType: 'multiselect'`, should return a `z.array(z.string())` base schema
- Given `convertToZodSchema` with `required` rule and `fieldType: 'multiselect'`, should enforce `minLength(1)` on the array

---

## Task B: Create `multiselect-field.tsx` component + tests (TDD)

Implement a popover-style multiselect using the same inline absolute-dropdown pattern as `AutocompleteField` — no new dependencies needed.

**Requirements**:
- Given static items, should render a trigger showing a placeholder or selected count/labels
- Given user opens the dropdown, should show a searchable list of checkboxes
- Given user checks an item, should add it to the selected values array and keep dropdown open
- Given user unchecks an item, should remove it from the selected values array
- Given selected values, should display them as comma-separated chips/badges inside the trigger
- Given a `dataSource` config, should load options dynamically and show a loading state
- Given `isDisabled: true`, should disable the trigger and prevent interaction
- Given a validation error, should display the error message and apply error styling
- Given `required` in validation, should show the asterisk indicator on the label
- Given keyboard interaction (Escape), should close the dropdown
- Given the component, should register values with react-hook-form as `string[]`

---

## Task C: Register `multiselect` in `FieldWrapper`

Wire the new component into the field renderer switch.

**Requirements**:
- Given a field with `type: 'multiselect'`, should render `MultiselectField` with correct props
- Given a field with any other type, should be unaffected

---

## Task D: Add multiselect demo to the global descriptor

Demonstrate the new field type in the existing demo descriptor.

**Requirements**:
- Given the demo page loads, should include at least one `multiselect` field with static items
- Given the demo page loads, should include at least one `multiselect` field with a `required` validation rule

---
