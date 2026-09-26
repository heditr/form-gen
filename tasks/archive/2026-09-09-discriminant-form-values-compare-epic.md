# Discriminant Form Values Compare Epic

**Status**: ✅ COMPLETED (2026-09-09)  
**Goal**: Detect discriminant changes by comparing previous vs current form values by field id, not form data vs CaseContext.

## Overview

Why: rehydration must fire only when the user actually changes a discriminant field; comparing against CaseContext conflates detection with derived API context and causes false positives/negatives when context is empty, stale, or keyed differently from form fields.

---

## Rewrite haveDiscriminantFieldsChanged

Change the pure utility to compare previous and next form snapshots by discriminant `field.id`.

**Requirements**:
- Given previous and next form values differ on a discriminant field id, should return true
- Given only non-discriminant fields change, should return false
- Given a discriminant value clears to undefined, should treat that as a change vs prior defined value
- Given empty discriminant fields list, should return false

---

## Update FormValuesWatcher Detection

Track previous form values and gate `onDiscriminantChange` using form→form comparison.

**Requirements**:
- Given a discriminant field value changes between watches, should invoke `onDiscriminantChange`
- Given only non-discriminant values change, should not invoke `onDiscriminantChange`
- Given `caseContext` is empty or out of sync with form defaults, should not falsely trigger on first non-discriminant edit

---

## Update Call Sites

Remove redundant CaseContext-based change gates from containers; keep `updateCaseContext` for payload building.

**Requirements**:
- Given discriminant change already detected by the watcher, should sync form data and rehydrate without re-comparing against CaseContext
- Given demo and form-container handlers, should use the same apply-only pattern
