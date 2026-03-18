# Handlebars Array Evaluation Epic

**Status**: 📋 PLANNED  
**Goal**: Evaluate `FieldDescriptor.validation` and selection `FieldDescriptor.items` as Handlebars expressions to dynamically add/remove rules and options while avoiding SSR/hydration mismatches, especially around the form remount key derived from validation rules.

## Overview

Why: conditional validation and conditional option lists are core to multi‑jurisdiction KYC flows, but today `validation` and `items` are static arrays; enabling Handlebars templating for these arrays unlocks descriptor-only changes while requiring careful handling to keep client hydration stable since the form key is derived from validation rules.

---

## Update Type Definitions

Expand `FieldDescriptor.validation` and `FieldDescriptor.items` to support Handlebars template strings in addition to arrays.

**Requirements**:
- Given existing descriptors with array `validation` and `items`, should remain backwards compatible without changes
- Given `validation` or `items` as template strings, should be accepted by TypeScript types and runtime normalization

---

## Implement Array Template Normalization Utilities

Create utilities to evaluate Handlebars templates that return JSON arrays for `items` and `validation`, with safe fallbacks on errors.

**Requirements**:
- Given a template string and form context, should evaluate and parse JSON into an array
- Given invalid template output or invalid JSON, should return a safe fallback and not throw during rendering
- Given `pattern` rule values, should support JSON-serializable string representation

---

## Integrate Items Template Evaluation

Normalize `items` templates into concrete `FieldItem[]` before rendering selection fields.

**Requirements**:
- Given a selection field with `items` template, should render options consistent with evaluated array
- Given context changes that affect the template condition, should update rendered options without losing unrelated form state

---

## Integrate Validation Template Evaluation (Hydration-Safe)

Normalize `validation` templates into concrete `ValidationRule[]` before schema / RHF rule construction, with a hydration-safe strategy.

**Requirements**:
- Given a field with `validation` template, should apply the evaluated rules for client validation
- Given SSR + client hydration, should not compute different initial validation-derived form keys for the same initial context
- Given `caseContext` changes due to rehydration, should update validation rules and remount resolver predictably

---

## Add Tests

Add unit/integration tests for template evaluation and the key hydration-sensitive behaviors.

**Requirements**:
- Given `items` template evaluation, should parse to `FieldItem[]` and fall back safely on errors
- Given `validation` template evaluation, should parse to `ValidationRule[]` and fall back safely on errors
- Given validation changes driven by context, should trigger the expected remount behavior without hydration warnings in initial render path

