# Mixed Width Grid Layout Epic

**Status**: 📋 PLANNED  
**Goal**: Enable `third` width behavior in 2-column grid blocks (including a full `third/third/third` triplet that still renders as **three** columns in that row) and `half` width behavior in 3-column grid blocks (`half/half` pairs), with strict homogeneous buffering while improving layout algorithm readability.

## Overview

WHY the current strict width-to-column matching limits descriptor flexibility during POC iteration and forces fallback rows that are hard to reason about; this epic expands layout behavior for additional widths but keeps deterministic homogeneous packing rules (`half` with `half`, `third` with `third`) and restructures the slot algorithm into clearer, composable units so future layout evolution is safer and easier to maintain.

---

## Define New Width Semantics

Lock exact rules for `third` in `2`-column blocks and `half` in `3`-column blocks, including deterministic overflow behavior.

**Requirements**:
- Given a 2-column block, should treat `half` and `third` as supported widths without mixing them in the same buffered row.
- Given a 3-column block, should buffer only homogeneous width groups (`half/half` and `third/third/third`) and never mix widths in one row.
- Given a leftover field that cannot complete its homogeneous pack, should render that field as-is with its native width semantics.

---

## Refactor Layout Engine Structure

Restructure `buildBlockLayoutRows` into smaller pure helpers for width normalization, buffering, slot building, and grouped-row emission.

**Requirements**:
- Given existing layout paths, should preserve field ordering semantics during refactor.
- Given nested branching in current logic, should reduce conditional depth and duplicated slot creation code.
- Given future layout rule updates, should allow localized changes without touching unrelated branches.

---

## Implement Ungrouped Homogeneous Width Packing

Implement ungrouped-row behavior for new combinations with strict homogeneous buffering, including `half` behavior in 3-column contexts and `third` behavior in 2-column contexts.

**Requirements**:
- Given ungrouped fields in 2-column mode, should buffer only `half/half` pairs and never place a `half` beside a `third`.
- Given ungrouped fields in 3-column mode, should buffer `half/half` pairs and `third/third/third` triplets as separate homogeneous flows.
- Given a trailing ungrouped field that remains alone, should render it as its own row using its width (`third`, `half`, or `full`).
- Given ungrouped `third/third/third` in a **2-column** block, should emit a single row with three `third`-sized slots; that row may override the block’s column count for layout only so the three fields sit in **three** columns (not a 2-col grid with a stray third in the next row).

---

## Row-level grid override (2-col block, 3× `third`)

The block’s `layout.columns` is still `2` for most rows, but a homogeneous `third/third/third` triplet is an exception: the row that contains those three fields must use a **3-column** grid on medium+ breakpoints so all three appear side by side in one row.

**Requirements**:
- Given a 2-column block and three consecutive ungrouped `third` fields, should produce one layout row with three columns for those fields (e.g. `LayoutRow` carries an optional `rowGridColumns?: 2 | 3` or equivalent, and `block.tsx` / `repeatable-field-group.tsx` apply `md:grid-cols-3` for that row only).
- Given a 2-column block, should not force `third/third/third` to reuse only the block’s 2-col grid in a way that leaves the third field on a new row.
- Given other rows in the same block, should keep using the block’s `columns` for those rows (typically `md:grid-cols-2`).

---

## Implement Grouped Homogeneous Width Support

Extend grouped row emission to support additional widths with homogeneous grouping rules while preserving current group ordering guarantees.

**Requirements**:
- Given grouped fields in 2-column mode, should support `third` widths while preventing `half` and `third` from being placed side-by-side in one row.
- Given grouped fields in 3-column mode, should support `half` widths with deterministic homogeneous row outcomes.
- Given unsupported role/width combinations, should use a documented deterministic fallback.

---

## Expand and Update Tests

Add and update tests for new width behavior across grouped and ungrouped paths, including ordering and flush edge cases.

**Requirements**:
- Given each new width-column combination, should add explicit tests that define expected rows and slots.
- Given existing intended behaviors, should keep legacy tests passing unless behavior is intentionally redefined.
- Given buffering and group transitions, should verify deterministic ordering and trailing flush behavior.

---

## Update Layout Algorithm Documentation

Update layout docs to reflect the new compatibility matrix and homogeneous buffering decision rules.

**Requirements**:
- Given updated algorithm logic, should document the new decision tree accurately.
- Given contributors authoring descriptors, should include examples for 2-col+third and 3-col+half patterns with no mixed-width rows.
- Given fallback logic, should describe exactly when full-width rows are still emitted.

---

## Packing Matrix

Define explicit packing rules for implementation and tests.

**Requirements**:
- Given a 2-column grid, should pack `half/half` as one row (`left`,`right`) and pack `third/third` as one row (`left`,`right`).
- Given a 2-column grid, should never place `half` next to `third` in the same row.
- Given a 2-column grid, should support **three** consecutive `third` fields as one row; that row must use a **3-column** row layout (override) so the triplet does not look like a 2-column block with only two slots filled.
- Given a 3-column grid, should pack `third/third/third` as one row (`col1`,`col2`,`col3`) using the block’s 3-col grid.
- Given a 3-column grid, should pack `half/half` as a homogeneous row with deterministic slot-span behavior (e.g. two columns used in a 3-col grid, as implemented).
- Given a 3-column grid, should never mix `half` and `third` in the same row.
- Given leftover homogeneous fields that do not complete a pack, should render each leftover field alone using native width semantics.

---

## Validate Rendering Integration

Verify row/slot outputs render correctly in both standard and repeatable block renderers.

**Requirements**:
- Given new slot/colSpan outputs, should render consistently in `block.tsx` and `repeatable-field-group.tsx`.
- Given a row with `rowGridColumns === 3` inside a 2-column block, should apply `md:grid-cols-3` to that row’s wrapper (or equivalent) so `third/third/third` displays as three columns.
- Given responsive grid classes, should avoid visual regressions in spacing and stacking.
- Given descriptor compatibility, should avoid requiring schema/type changes on `FieldDescriptor` unless explicitly justified (row metadata may live on `LayoutRow` only).
