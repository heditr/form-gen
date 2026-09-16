# Repeatable Popin Main-Form Status Demo Epic

**Status**: ✅ IMPLEMENTED (2026-09-16) — pending user confirmation before archive  
**Goal**: Prove end to end that a repeatable popin can hide fields from main-form values and prefill from a backend load route.

## Overview

Why this matters: KYC collections edited in a popin still depend on case-level answers (entity type, jurisdiction). Operators need those dependencies and backend-seeded defaults to work together without colliding with the popin row's own fields, so applicants are not shown the wrong questions or left with an empty dialog.

---

## Repeatable Popin Load

Load object data when a repeatable popin opens in create mode, without overwriting an existing row on edit.

**Requirements**:
- Given a repeatable popin with `popinLoad`, should fetch the load URL when the dialog opens for create
- Given load data and create mode, should fill matching popin fields
- Given load data and edit mode, should keep the existing row values

---

## Main-Form Status in Repeatable Popin

Evaluate popin field hidden status against live main-form values that are not fields in the popin itself.

**Requirements**:
- Given a popin field whose hidden template references a main-form key, should hide or show from that main-form value
- Given the popin row has a colliding key, should still let the popin value win for that key

---

## Signatory Load Route

Add a demo backend route that returns suggested signatory values from main-form query params.

**Requirements**:
- Given `entityType` and `country` query params, should return role, email, and title defaults that match that context
- Given an individual entity, should not suggest corporation-only title or ownership

---

## Demo Descriptor

Add an authorized-signatories repeatable popin to the demo form that wires hidden templates and `popinLoad` to the new route.

**Requirements**:
- Given the demo descriptor, should include a repeatable popin whose field hidden templates depend on main-form `entityType` and `country`
- Given the demo descriptor, should load new signatory rows from `/api/demo/signatory-load`
