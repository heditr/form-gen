# Nested Outer Index Default Epic

**Status**: ✅ COMPLETED (2026-10-21)  
**Goal**: Let nested repeatable defaults address the open popin row, and hold hidden selection autoFill until the target is shown.

## Overview

WHY a nested repeatable inside a repeatable popin cannot tell the open parent row from the inner row, so a default template cannot remap case-context keys that differ from field ids, and a selection made while a sibling is hidden is dropped before the user reveals that field. This epic adds `@outerIndex` for the open popin row and keeps autoFill values for hidden targets until they become visible, unless the selection changed or the user cleared the field.

---

## Bind outer index in default templates

Evaluate `@outerIndex` as the open popin row and `@index` as the inner row when extracting nested repeatable defaults.

**Requirements**:
- Given a template with `@outerIndex` and `@index`, should bind the open popin row first and the inner row second
- Given a template with only `@outerIndex`, should resolve that path
- Given an unbound or negative `@outerIndex`, should return the field type default
- Given popin scope and remapped case keys, should seed each inner row from the open contact
- Given create mode, should leave the nested array empty
- Given main scope, should omit the nested group key

---

## Hold hidden autoFill until shown

Keep selection autoFill for targets that are hidden when the option is chosen, and apply it when the field becomes visible.

**Requirements**:
- Given a hidden autoFill target, should record the mapped value without writing it into live flat-field values
- Given that target later shown and the same selection still set, should apply the held value
- Given the selector cleared or the user already emptied the target, should leave the target empty
- Given a hidden sibling on a repeatable row, should store the mapped value on the row and show it when the field becomes visible
- Given `respectHidden` false, should write the mapped value into live values immediately

---
