# Popin Isolation Epic

**Status**: ✅ COMPLETED (2024-12-19)  
**Goal**: Improve popin implementation with isolated React Hook Form instance and proper query invalidation

## Overview

Previously, popins shared the same React Hook Form instance as the main form, which caused validation conflicts and state pollution. This epic improved popin isolation by creating a separate form instance for each popin while maintaining access to original form values and caseContext. When a popin successfully submits, queries are invalidated to refresh the original form values, ensuring data consistency.

---

## Create Isolated Popin Form Instance

Create a separate React Hook Form instance for the popin block using useFormDescriptor hook, scoped only to fields within the popin block.

**Requirements**:
- Given a popin block opens, should create a new React Hook Form instance scoped to popin block fields
- Given popin form instance, should have access to original form values for template evaluation
- Given popin form instance, should have access to caseContext for template evaluation
- Given popin form instance, should only validate fields within the popin block

---

## Update Popin Submit Handler

Modify the popin submit handler to use the isolated popin form instance values instead of the main form values.

**Requirements**:
- Given popin form submits successfully, should use popin form values for payload evaluation
- Given popin submit succeeds, should close popin and invalidate queries
- Given popin submit fails, should display errors on popin form fields

---

## Invalidate Queries on Successful Submit

When popin successfully submits, invalidate relevant TanStack Query queries to refresh the original form values. Query invalidation does not occur when popin is cancelled to avoid unnecessary refreshes.

**Requirements**:
- Given popin closes after successful submit, should invalidate form data queries to refresh original form
- Given popin closes via cancel, should not invalidate queries (no data changes occurred)
- Given query invalidation, should not cause unnecessary re-renders or flicker

---

## Implementation Summary

### Changes Made

1. **PopinManagerProvider** (`src/components/popin-manager.tsx`):
   - Created isolated React Hook Form instance using `useFormDescriptor` hook
   - Built minimal descriptor containing only the popin block fields
   - Popin form has access to main form values and `caseContext` for template evaluation
   - Popin form resets with `popinLoadData` when loaded
   - Query invalidation occurs only after successful submit, not on cancel

2. **FormContainer** (`src/components/form-container.tsx`):
   - Added `caseContext` prop to `PopinManagerProvider`

3. **Tests** (`src/components/popin-manager.test.tsx`):
   - Added mocks for `useFormDescriptor` and `useQueryClient`
   - Updated all test cases to include `caseContext` prop

### Key Benefits

- **Better Isolation**: Popin form state is completely separate from main form
- **No Validation Conflicts**: Popin fields validate independently
- **Data Consistency**: Query invalidation refreshes original form only when data changes
- **Template Access**: Popin can still reference main form values and `caseContext`
